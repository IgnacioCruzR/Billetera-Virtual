import { budgetPeriod, daysInBudgetPeriod, parseBudgetPeriod, shiftBudgetPeriod } from '../budgets/budget-calculations.ts'
import { accountReservation, reservationEffect } from './savings-ledger.ts'
import { shiftDays } from '../../lib/calendar.ts'
import type { FinancialRecords } from '../dashboard/model.ts'
import type { SavingsGoalHistory, SavingsProjection, SavingsReservationOperation } from './savings-model.ts'

export function scheduledContribution(today: string, months: number) {
  const month = parseBudgetPeriod(today.slice(0, 7))
  if (!month || !Number.isSafeInteger(months) || months < 0) return null
  const next = shiftBudgetPeriod(month, months)
  if (!next) return null
  const day = Math.min(Number(today.slice(8)), daysInBudgetPeriod(next))
  return `${next}-${String(day).padStart(2, '0')}`
}

export function projectSavings(target: number, reserved: number, monthly: number, today: string, targetDate?: string): SavingsProjection {
  const remaining = Math.max(0, target - reserved)
  const months = remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null
  let availableDeposits: number | null = null
  if (targetDate) {
    const gap = (Number(targetDate.slice(0, 4)) - Number(today.slice(0, 4))) * 12 + Number(targetDate.slice(5, 7)) - Number(today.slice(5, 7))
    const last = gap > 0 ? scheduledContribution(today, gap) : null
    availableDeposits = last ? gap - Number(last > targetDate) : 0
  }
  return {
    remaining, months, estimatedDate: months === null ? null : scheduledContribution(today, months),
    requiredMonthly: remaining === 0 ? 0 : availableDeposits ? Math.ceil(remaining / availableDeposits) : null,
    availableDeposits,
  }
}

export function habitualContribution(history: SavingsGoalHistory, today: string) {
  if (history.goal.monthlyPlan !== null) return { amount: history.goal.monthlyPlan, source: 'plan' as const }
  const months = monthlyActivity(history.operations, today, 4).slice(0, -1)
  const canEstimate = months.filter(month => month.net > 0).length >= 2
  return { amount: canEstimate ? Math.max(0, Math.round(months.reduce((sum, month) => sum + month.net, 0) / months.length)) : 0, source: canEstimate ? 'history' as const : 'unknown' as const }
}

export function monthlyActivity(operations: SavingsReservationOperation[], today: string, count = 6) {
  const current = budgetPeriod(today.slice(0, 4), today.slice(5, 7))!
  return Array.from({ length: count }, (_, index) => shiftBudgetPeriod(current, index - count + 1)).flatMap(month => {
    if (!month) return []
    let additions = 0
    let releases = 0
    for (const item of operations) if (item.date <= today && item.date.startsWith(month)) {
      if (item.type === 'aporte') additions += item.amount
      else releases += item.amount
    }
    return [{ month, additions, releases, net: additions - releases }]
  })
}

export function historicalProgress(history: SavingsGoalHistory, today: string) {
  const dates = new Map<string, { additions: number; releases: number; delta: number }>([
    [history.goal.createdOn, { additions: 0, releases: 0, delta: 0 }], [today, { additions: 0, releases: 0, delta: 0 }],
  ])
  for (const operation of history.operations) {
    const row = dates.get(operation.date) ?? { additions: 0, releases: 0, delta: 0 }
    const effect = reservationEffect(operation)
    row.delta += effect
    row.additions += Math.max(0, effect)
    row.releases += Math.max(0, -effect)
    dates.set(operation.date, row)
  }
  let reserved = 0
  let accumulated = 0
  return [...dates.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => {
    reserved += row.delta
    accumulated += row.additions
    return { date, reserved, accumulated, releases: row.releases }
  })
}

export function accountsWithUpcomingShortfall(records: FinancialRecords, today: string) {
  const end = shiftDays(today, 7)
  const accounts = records.accounts.filter(account => account.status === 'activa')
  return accounts.filter(account => {
    const payments = records.commitments.reduce((sum, item) => sum + (
      item.status === 'pendiente' && item.type === 'pago' && item.accountId === account.id && item.dueDate <= end ? item.amount : 0
    ), 0)
    return payments > Math.max(0, accountReservation(account, records, today).free)
  })
}
