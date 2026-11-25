import { useMemo } from 'react'
import { formatDate } from '@/lib/utils'
import { getPeriodEndDates, getPeriodRange, totals } from '@/features/movements/movement-data'
import { registeredBalance } from '@/features/accounts/account-balances'
import { summarizeSavings } from '@/features/savings/savings-ledger'
import { accountsWithUpcomingShortfall } from '@/features/savings/savings-planning'
import { parseBudgetPeriod, summarizeBudgets } from '@/features/budgets/budget-calculations'
import { DEFAULT_HORIZON, pendingItems, projectCashFlow } from '@/features/commitments/cash-flow'
import { analyzeMicroExpenses, defaultMicroPeriod } from '@/features/micro-expenses/micro-expense-analysis'
import { expenseCategories, healthPreview, monthAt, shiftDays } from './mock-data'
import type { ChartPoint, FinancialRecords, Movement, Period } from './model'

function within(items: Movement[], from: string, to: string) {
  return items.filter(item => item.date >= from && item.date <= to)
}

function variation(current: number, previous: number) {
  return previous === 0 ? null : (current - previous) / Math.abs(previous) * 100
}

function chartPoints(period: Period, records: FinancialRecords, from: string): ChartPoint[] {
  let start = from

  return getPeriodEndDates(period).map(end => {
    const { income, expense, net } = totals(within(records.movements, start, end))
    start = shiftDays(end, 1)
    return {
      date: end, label: formatDate(end, period === 'month' ? { day: 'numeric', month: 'short' } : { month: 'short' }),
      balance: registeredBalance(records, end), income, expense, savings: net,
    }
  })
}

function getDashboardSnapshot(period: Period, records: FinancialRecords, detected: ReadonlySet<string>, today: string) {
  const { movements } = records
  const { from, to } = getPeriodRange(period)
  const priorOffset = period === 'year' ? -12 : period === 'quarter' ? -3 : -1
  const priorLength = period === 'year' ? Number(today.slice(5, 7)) : -priorOffset
  const previous = totals(within(movements, `${monthAt(priorOffset - priorLength + 1)}-01`, shiftDays(`${monthAt(priorOffset + 1)}-01`, -1)))
  const periodMovements = within(movements, from, to)
  const monthStart = `${monthAt(0)}-01`
  const { income, expense } = totals(periodMovements)
  const commitments = pendingItems(records.commitments)
  const savings = summarizeSavings(records, today)
  const balance = savings.registered
  const projection = projectCashFlow(commitments, balance, today, DEFAULT_HORIZON, savings.reserved)
  const lastClosing = registeredBalance(records, shiftDays(monthStart, -1))
  const { summary: smallExpenses } = analyzeMicroExpenses(movements, detected, defaultMicroPeriod(today), today)

  const categoryExpense = (categoryId: string, items: Movement[]) => items.reduce((sum, item) => (
    item.type === 'gasto' && item.categoryId === categoryId ? sum + item.amount : sum
  ), 0)

  return {
    today, balance, income, expense, projected: projection.finalBalance, projection,
    incomeVariation: variation(income, previous.income), expenseVariation: variation(expense, previous.expense),
    balanceVariation: variation(balance, lastClosing), chart: chartPoints(period, records, from),
    distribution: expenseCategories.map(category => ({ ...category, amount: categoryExpense(category.id, periodMovements) })),
    budgets: summarizeBudgets(records.budgets, movements, parseBudgetPeriod(monthAt(0))!, today).items,
    commitments, health: healthPreview,
    smallExpenses, savings, savingsShortfall: accountsWithUpcomingShortfall(records, today).length > 0,
  }
}

export type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>
export type DashboardBudget = DashboardSnapshot['budgets'][number]

export function useDashboard(period: Period, records: FinancialRecords, detected: ReadonlySet<string>, today: string) {
  return useMemo(() => getDashboardSnapshot(period, records, detected, today), [period, records, detected, today])
}
