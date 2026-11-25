import type { Movement } from '../dashboard/model.ts'
import { daysBetween } from '../../lib/calendar.ts'
import { budgetBounds, daysInBudgetPeriod, parseBudgetPeriod, shiftBudgetPeriod } from '../budgets/budget-calculations.ts'
import type { BudgetPeriod } from '../budgets/budget-model.ts'
import { isAnalyzed, microExpenseHistory, normalizeDescription } from './micro-expense-detection.ts'
import type { DateRange, MicroExpenseFilters, MicroExpenseHistory, MicroExpensePeriod, MicroExpenseSummary, SavingsScenario, SavingsSimulation, SpendingPattern } from './micro-expense-model.ts'

const percentage = (amount: number, total: number) => total > 0 ? amount / total * 100 : null
const variation = (current: number, previous: number) => percentage(current - previous, previous)
const amountOf = (entries: MicroExpenseHistory[]) => entries.reduce((sum, entry) => sum + entry.movement.amount, 0)
const inRange = (date: string, range: DateRange) => date >= range.from && date <= range.to

function monthWindow(month: BudgetPeriod, today: string) {
  const { from, to: end } = budgetBounds(month)
  const to = end > today ? today : end
  return { month, from, to, days: daysInBudgetPeriod(month), observedDays: daysBetween(from, to) + 1, partial: to < end }
}

export function defaultMicroPeriod(today: string): MicroExpensePeriod {
  return { month: today.slice(0, 7), range: 'month' }
}

export function analyzeMicroExpenses(movements: Movement[], detected: ReadonlySet<string>, selection: MicroExpensePeriod, today: string) {
  const end = parseBudgetPeriod(selection.month)!
  const count = selection.range === 'year' ? Number(end.slice(5, 7)) : selection.range === 'quarter' ? 3 : 1
  const periods = Array.from({ length: count }, (_, index) => shiftBudgetPeriod(end, index - count + 1))
    .flatMap(month => month ? [monthWindow(month, today)] : [])
  const selectedEnd = periods.at(-1)!
  const firstPrior = shiftBudgetPeriod(periods[0].month, -count)
  const lastPrior = shiftBudgetPeriod(end, -count)
  const range = { from: periods[0].from, to: selectedEnd.to }
  const sameCutoff = lastPrior && (!selectedEnd.partial || selectedEnd.observedDays <= daysInBudgetPeriod(lastPrior))
  const previous = firstPrior && lastPrior && sameCutoff ? {
    from: budgetBounds(firstPrior).from,
    to: selectedEnd.partial ? `${lastPrior}-${String(selectedEnd.observedDays).padStart(2, '0')}` : budgetBounds(lastPrior).to,
  } : null
  const effective = movements.filter(item => item.date <= today)
  const expenses = effective.flatMap(item => item.type === 'gasto' ? [microExpenseHistory(item, detected)] : [])
  const history = expenses.filter(entry => inRange(entry.movement.date, range))
  const included = history.filter(isAnalyzed)
  const priorIncluded = previous ? expenses.filter(entry => inRange(entry.movement.date, previous) && isAnalyzed(entry)) : []
  const amount = amountOf(included)
  const discretionary = included.filter(item => item.status === 'prescindible')
  const necessaryCount = included.filter(item => item.status === 'necesario').length
  const pendingCount = included.length - discretionary.length - necessaryCount
  const dayCount = daysBetween(range.from, range.to) + 1
  const income = effective.reduce((sum, item) => sum + (item.type === 'ingreso' && inRange(item.date, range) ? item.amount : 0), 0)
  const weights = new Map(periods.map(month => [month.month, (month.days / month.observedDays) / periods.length]))
  const monthValue = (entry: MicroExpenseHistory) => entry.movement.amount * (weights.get(entry.movement.date.slice(0, 7) as BudgetPeriod) ?? 0)
  function monthlyFor(entries: MicroExpenseHistory[]) {
    if (!entries.length) return null
    const dates = new Set(entries.filter(item => inRange(item.movement.date, selectedEnd)).map(item => item.movement.date))
    if (selectedEnd.partial && (selectedEnd.observedDays < 7 || dates.size < 2)) return null
    return Math.round(entries.reduce((sum, entry) => sum + monthValue(entry), 0))
  }
  const monthlyEstimate = monthlyFor(included)
  const summary: MicroExpenseSummary = {
    amount, count: included.length, average: included.length ? Math.round(amount / included.length) : null,
    perWeek: included.length * 7 / dayCount, expenseShare: percentage(amount, amountOf(history)), incomeShare: percentage(amount, income),
    variation: variation(amount, amountOf(priorIncluded)), discretionary: amountOf(discretionary), discretionaryCount: discretionary.length,
    pendingCount, necessaryCount, monthlyEstimate, annualEstimate: monthlyEstimate === null ? null : monthlyEstimate * 12,
  }
  const priorByPattern = new Map<string, number>()
  for (const entry of priorIncluded) priorByPattern.set(entry.patternId, (priorByPattern.get(entry.patternId) ?? 0) + entry.movement.amount)
  const grouped = new Map<string, MicroExpenseHistory[]>()
  for (const entry of included) {
    const group = grouped.get(entry.patternId) ?? []
    group.push(entry)
    grouped.set(entry.patternId, group)
  }
  const patterns: SpendingPattern[] = Array.from(grouped, ([id, group]) => {
    const { description, categoryId } = group[0].movement
    const total = amountOf(group)
    return {
      id, categoryId, name: description.trim() || 'Gasto sin descripción', count: group.length, amount: total,
      average: Math.round(total / group.length), share: percentage(total, amount) ?? 0, perWeek: group.length * 7 / dayCount,
      variation: variation(total, priorByPattern.get(id) ?? 0),
    }
  }).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'es'))
  const categories = new Map<string, number>()
  const weekdays = Array<number>(7).fill(0)
  for (const entry of included) {
    const { categoryId, date, amount } = entry.movement
    categories.set(categoryId, (categories.get(categoryId) ?? 0) + amount)
    weekdays[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]++
  }
  const evolution = Array.from({ length: 6 }, (_, index) => shiftBudgetPeriod(end, index - 5)).flatMap(month => {
    if (!month) return []
    const window = monthWindow(month, today)
    const rows = expenses.filter(item => inRange(item.movement.date, window) && isAnalyzed(item))
    return [{ ...window, total: amountOf(rows), discretionary: amountOf(rows.filter(item => item.status === 'prescindible')) }]
  })
  return { summary, range, previous, patterns, history, included, categories, weekdays, evolution, monthValue, monthlyFor, partial: selectedEnd.partial }
}


export type MicroExpenseAnalysis = ReturnType<typeof analyzeMicroExpenses>

export function filterMicroHistory(history: MicroExpenseHistory[], filters: MicroExpenseFilters) {
  const search = normalizeDescription(filters.search)
  return history.filter(({ movement, status, patternId }) =>
    (!filters.includedOnly || isAnalyzed({ status }))
    && (!search || normalizeDescription(movement.description).includes(search))
    && (!filters.account || movement.accountId === filters.account)
    && (!filters.category || movement.categoryId === filters.category)
    && (!filters.from || movement.date >= filters.from)
    && (!filters.to || movement.date <= filters.to)
    && (!filters.minimum || movement.amount >= Number(filters.minimum))
    && (!filters.maximum || movement.amount <= Number(filters.maximum))
    && (!filters.classification || status === filters.classification)
    && (!filters.patternId || patternId === filters.patternId),
  ).sort((a, b) => b.movement.date.localeCompare(a.movement.date))
}

export const emptySavingsScenario: SavingsScenario = {
  patternIds: [], includeDiscretionary: false, movementIds: [], reduction: 25, patternReductions: {},
}

export function simulateSavings(analysis: MicroExpenseAnalysis, scenario: SavingsScenario): SavingsSimulation {
  const patterns = new Set(scenario.patternIds)
  const movements = new Set(scenario.movementIds)
  const selected = analysis.history.filter(entry => movements.has(entry.movement.id)
    || (isAnalyzed(entry) && patterns.has(entry.patternId)) || (scenario.includeDiscretionary && entry.status === 'prescindible'))
  const base = analysis.monthlyFor([...analysis.included, ...selected.filter(entry => !isAnalyzed(entry))])
  const monthly = base === null ? null : Math.round(selected.reduce((sum, entry) => {
    const rate = isAnalyzed(entry) && patterns.has(entry.patternId) ? scenario.patternReductions[entry.patternId] ?? scenario.reduction : scenario.reduction
    return sum + analysis.monthValue(entry) * (rate / 100)
  }, 0))
  return {
    selectedCount: selected.length, baseMonthly: base, monthly,
    quarterly: monthly === null ? null : monthly * 3, halfYear: monthly === null ? null : monthly * 6, annual: monthly === null ? null : monthly * 12,
    reducedMonthly: base === null || monthly === null ? null : base - monthly,
  }
}
