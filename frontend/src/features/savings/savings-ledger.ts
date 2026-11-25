import { balanceOn, registeredBalance } from '../accounts/account-balances.ts'
import type { Account, FinancialRecords } from '../dashboard/model.ts'
import type { AccountReservationSummary, SavingsGoal, SavingsGoalHistory, SavingsReservationOperation, SavingsSummary } from './savings-model.ts'

type Ledger = Pick<FinancialRecords, 'reservations'>
export const reservationEffect = (item: SavingsReservationOperation) => item.type === 'aporte' ? item.amount : -item.amount

export function reservedAt(records: Ledger, date: string, accountId?: string, goalId?: string) {
  return records.reservations.reduce((sum, operation) => sum + (
    operation.date <= date && (!accountId || accountId === operation.accountId) && (!goalId || goalId === operation.goalId)
      ? reservationEffect(operation) : 0
  ), 0)
}

export function accountReservation(account: Account, records: FinancialRecords, date: string): AccountReservationSummary {
  const balance = balanceOn(account, records, date)
  const reserved = reservedAt(records, date, account.id)
  return { balance, reserved, free: balance - reserved }
}

export function goalHistory(goal: SavingsGoal, records: Ledger, today: string): SavingsGoalHistory {
  const operations = records.reservations.filter(item => item.goalId === goal.id && item.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.recordedAt.localeCompare(b.recordedAt))
  const byAccount = new Map<string, number>()
  for (const operation of operations) byAccount.set(operation.accountId, (byAccount.get(operation.accountId) ?? 0) + reservationEffect(operation))
  const reserved = [...byAccount.values()].reduce((total, amount) => total + amount, 0)
  const attained = goal.status === 'finalizada' || goal.status === 'alcanzada'
  return {
    goal, operations, byAccount, reserved, remaining: Math.max(0, goal.target - reserved), progress: reserved / goal.target * 100,
    overdue: Boolean(goal.targetDate && goal.targetDate < today && !attained && goal.status !== 'cancelada'),
  }
}

export function summarizeSavings(records: FinancialRecords, today: string): SavingsSummary {
  const active = records.savingsGoals.filter(item => item.status === 'en-progreso')
  const target = active.reduce((sum, goal) => sum + goal.target, 0)
  const activeReserved = active.reduce((sum, goal) => sum + reservedAt(records, today, undefined, goal.id), 0)
  const reserved = reservedAt(records, today)
  const registered = registeredBalance(records, today)
  const free = registered - reserved
  const eligible = records.accounts.reduce((sum, account) => sum + (account.status === 'activa' ? Math.max(0, accountReservation(account, records, today).free) : 0), 0)
  const month = today.slice(0, 7)
  const netThisMonth = records.reservations.reduce((sum, item) => sum + (item.date <= today && item.date.startsWith(month) ? reservationEffect(item) : 0), 0)
  const financialSurplus = records.movements.reduce((sum, item) => {
    if (item.type === 'transferencia' || item.date > today || !item.date.startsWith(month)) return sum
    return sum + (item.type === 'ingreso' ? item.amount : -item.amount)
  }, 0)
  return {
    reserved, target, activeReserved, progress: target > 0 ? activeReserved / target * 100 : null,
    activeCount: active.length, reachedCount: records.savingsGoals.filter(item => item.status === 'alcanzada' || item.status === 'finalizada').length,
    netThisMonth, registered, free, availableForNew: Math.max(0, Math.min(free, eligible)), financialSurplus,
  }
}

function checkpoints(records: FinancialRecords, from: string, to: string) {
  return new Set([from, to, ...records.movements.map(item => item.date), ...records.adjustments.map(item => item.date), ...records.reservations.map(item => item.date)]
    .filter(date => date >= from && date <= to))
}

export function contributionCapacity(records: FinancialRecords, account: Account, from: string, today: string) {
  let capacity = Infinity
  for (const date of checkpoints(records, from, today)) {
    capacity = Math.min(capacity, accountReservation(account, records, date).free, registeredBalance(records, date) - reservedAt(records, date))
  }
  return Math.max(0, capacity)
}

export function releaseCapacity(records: FinancialRecords, accountId: string, goalId: string, from: string, today: string) {
  return Math.max(0, Math.min(...[...checkpoints(records, from, today)].map(date => reservedAt(records, date, accountId, goalId))))
}

export function movementCapacity(records: FinancialRecords, account: Account, from: string, today: string, isTransfer: boolean, editingId?: string) {
  let limit = Infinity
  let hasReservations = false
  for (const date of checkpoints(records, from, today)) {
    const reserved = reservedAt(records, date, account.id)
    hasReservations ||= reserved > 0
    if (isTransfer || reserved > 0) limit = Math.min(limit, balanceOn(account, records, date, editingId) - reserved)
  }
  return { limit, hasReservations }
}

export function worsensReservation(before: FinancialRecords, after: FinancialRecords, from: string, today: string) {
  const guarded = new Set(before.reservations.map(item => item.accountId))
  if (!guarded.size) return false
  const dates = new Set([...checkpoints(before, from, today), ...checkpoints(after, from, today)])
  for (const account of before.accounts.filter(item => guarded.has(item.id))) for (const date of dates) {
    const reserved = reservedAt(before, date, account.id)
    if (reserved <= 0) continue
    const balance = balanceOn(account, before, date)
    if (balanceOn(account, after, date) < Math.min(balance, reserved)) return true
  }
  return false
}
