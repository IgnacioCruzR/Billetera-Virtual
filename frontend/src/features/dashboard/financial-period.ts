import { shiftDays } from '../../lib/calendar.ts'
import { budgetBounds, daysInBudgetPeriod, parseBudgetPeriod, shiftBudgetPeriod } from '../budgets/budget-calculations.ts'
import type { BudgetPeriod } from '../budgets/budget-model.ts'
import type { Period } from './model.ts'

export function dashboardPeriod(period: Period, cutoff: string) {
  const month = parseBudgetPeriod(cutoff.slice(0, 7))!
  const size = period === 'year' ? Number(month.slice(5)) : period === 'quarter' ? 3 : 1
  const start = shiftBudgetPeriod(month, 1 - size) ?? month
  const current = { from: budgetBounds(start).from, to: cutoff }
  const priorEnd = shiftBudgetPeriod(month, period === 'year' ? -12 : -size)
  const priorStart = priorEnd && shiftBudgetPeriod(priorEnd, 1 - size)
  const elapsedDay = Number(cutoff.slice(8))
  const comparable = priorEnd && priorStart && elapsedDay <= daysInBudgetPeriod(priorEnd)
    ? { from: budgetBounds(priorStart).from, to: shiftDays(budgetBounds(priorEnd).from, elapsedDay - 1) }
    : null
  return { current, comparable, start, month, size }
}

export function dashboardPeriodEndDates(period: Period, cutoff: string) {
  const { current, month, size } = dashboardPeriod(period, cutoff)
  if (period === 'month') return Array.from({ length: Number(cutoff.slice(8)) }, (_, index) => shiftDays(current.from, index))
  return Array.from({ length: size }, (_, index) => shiftBudgetPeriod(month, index + 1 - size))
    .filter((value): value is BudgetPeriod => value !== null)
    .map(value => value === month ? cutoff : budgetBounds(value).to)
}
