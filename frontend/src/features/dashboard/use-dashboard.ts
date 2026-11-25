import { filterCategories, readCategories } from '@/features/categories/category-model'
import { useMemo } from 'react'
import { formatDate } from '@/lib/utils'
import { totals } from '@/features/movements/movement-data'
import { registeredBalance } from '@/features/accounts/account-balances'
import { summarizeSavings } from '@/features/savings/savings-ledger'
import { accountsWithUpcomingShortfall } from '@/features/savings/savings-planning'
import { budgetBounds, summarizeBudgets } from '@/features/budgets/budget-calculations'
import { pendingItems, projectCashFlow } from '@/features/commitments/cash-flow'
import type { ProjectionHorizon } from '@/features/commitments/commitment-model'
import { analyzeMicroExpenses, defaultMicroPeriod } from '@/features/micro-expenses/micro-expense-analysis'
import { shiftDays } from '@/lib/calendar'
import { dashboardPeriod, dashboardPeriodEndDates } from './financial-period'
import type { ChartPoint, FinancialRecords, Movement, Period } from './model'

function within(items: Movement[], from: string, to: string) {
  return items.filter(item => item.date >= from && item.date <= to)
}

function variation(current: number, previous: number) {
  return previous === 0 ? null : (current - previous) / Math.abs(previous) * 100
}

function chartPoints(period: Period, records: FinancialRecords, from: string, cutoff: string): ChartPoint[] {
  let start = from

  return dashboardPeriodEndDates(period, cutoff).map(end => {
    const { income, expense, net } = totals(within(records.movements, start, end))
    start = shiftDays(end, 1)
    return {
      date: end, label: formatDate(end, period === 'month' ? { day: 'numeric', month: 'short' } : { month: 'short' }),
      balance: registeredBalance(records, end), income, expense, savings: net,
    }
  })
}

function getDashboardSnapshot(period: Period, records: FinancialRecords, detected: ReadonlySet<string>, today: string, horizon: ProjectionHorizon) {
  const { movements } = records
  const { current: { from, to }, comparable, month } = dashboardPeriod(period, today)
  const previous = comparable && records.accounts.some(item => item.openedOn <= comparable.from)
    ? totals(within(movements, comparable.from, comparable.to)) : null
  const periodMovements = within(movements, from, to)
  const monthStart = budgetBounds(month).from
  const { income, expense } = totals(periodMovements)
  const commitments = pendingItems(records.commitments)
  const savings = summarizeSavings(records, today)
  const balance = savings.registered
  const projection = projectCashFlow(commitments, balance, today, horizon, savings.reserved)
  const lastClosing = registeredBalance(records, shiftDays(monthStart, -1))
  const { summary: smallExpenses } = analyzeMicroExpenses(movements, detected, defaultMicroPeriod(today), today)

  const categoryExpense = (categoryId: string, items: Movement[]) => items.reduce((sum, item) => (
    item.type === 'gasto' && item.categoryId === categoryId ? sum + item.amount : sum
  ), 0)

  return {
    today, balance, income, expense, projected: projection.finalBalance, projection,
    incomeVariation: previous && variation(income, previous.income), expenseVariation: previous && variation(expense, previous.expense),
    balanceVariation: variation(balance, lastClosing), chart: chartPoints(period, records, from, today),
    distribution: filterCategories(readCategories(records), 'gasto').map(category => ({ ...category, amount: categoryExpense(category.id, periodMovements) })),
    budgets: summarizeBudgets(records.budgets, movements, month, today).items,
    commitments,
    smallExpenses, savings, savingsShortfall: accountsWithUpcomingShortfall(records, today).length > 0,
  }
}

export type DashboardSnapshot = ReturnType<typeof getDashboardSnapshot>
export type DashboardBudget = DashboardSnapshot['budgets'][number]

export function useDashboard(period: Period, records: FinancialRecords, detected: ReadonlySet<string>, today: string, horizon: ProjectionHorizon) {
  return useMemo(() => getDashboardSnapshot(period, records, detected, today, horizon), [period, records, detected, today, horizon])
}
