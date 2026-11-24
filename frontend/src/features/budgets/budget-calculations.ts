import type { Movement } from '@/features/dashboard/model.ts'
import type { Budget, BudgetAlertKind, BudgetFormData, BudgetHistory, BudgetPeriod, BudgetPhase, BudgetProjection, BudgetRisk, BudgetStatus, BudgetSummary } from './budget-model.ts'

export const DEFAULT_WARNING_THRESHOLD = 80

export function parseBudgetPeriod(value: string): BudgetPeriod | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value.startsWith('0000')) return null
  return value as BudgetPeriod
}

export function budgetPeriod(year: string | number, month: string | number) {
  return /^\d{4}$/.test(String(year)) ? parseBudgetPeriod(`${year}-${String(month).padStart(2, '0')}`) : null
}

export function shiftBudgetPeriod(period: BudgetPeriod, offset: number) {
  const [year, month] = period.split('-').map(Number)
  const index = year * 12 + month - 1 + offset
  return budgetPeriod(String(Math.floor(index / 12)).padStart(4, '0'), (index % 12) + 1)
}

export function daysInBudgetPeriod(period: BudgetPeriod) {
  const [year, month] = period.split('-').map(Number)
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function budgetPhase(period: BudgetPeriod, today: string): BudgetPhase {
  const month = today.slice(0, 7)
  return period < month ? 'closed' : period > month ? 'future' : 'current'
}

export function budgetBounds(period: BudgetPeriod) {
  return { from: `${period}-01`, to: `${period}-${daysInBudgetPeriod(period)}` }
}

type Expense = Extract<Movement, { type: 'gasto' }>

export function expensesInBudgetPeriod(movements: Movement[], period: BudgetPeriod, today: string): Expense[] {
  const { from, to } = budgetBounds(period)
  return movements.filter((item): item is Expense => item.type === 'gasto' && item.date >= from && item.date <= to && item.date <= today)
}

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (spent > limit) return 'exceeded'
  if (spent === limit) return 'limit'
  return spent * 5 >= limit * 4 ? 'near' : 'within'
}

export function budgetAlert(spent: number, budget: Budget): BudgetAlertKind | null {
  if (spent > budget.limit) return 'exceeded'
  if (spent === budget.limit) return 'limit'
  return spent * 100 >= budget.limit * budget.warningThreshold ? 'threshold' : null
}

export function budgetAlertMessage(kind: BudgetAlertKind, threshold: number) {
  if (kind === 'threshold') return `Alcanzaste tu umbral de advertencia del ${threshold} %.`
  return kind === 'limit' ? 'Alcanzaste el límite mensual.' : 'El consumo superó el límite mensual.'
}

export function budgetProjection(budget: Budget, expenses: Expense[], today: string): BudgetProjection {
  const phase = budgetPhase(budget.period, today)
  const totalDays = daysInBudgetPeriod(budget.period)
  const elapsedDays = phase === 'future' ? 0 : phase === 'closed' ? totalDays : Number(today.slice(8))
  const remainingDays = totalDays - elapsedDays
  const spent = expenses.reduce((sum, item) => sum + item.amount, 0)
  const dailyAverage = elapsedDays ? spent / elapsedDays : null
  const activeDays = new Set(expenses.map(item => item.date)).size
  const projected = phase === 'current' && elapsedDays >= 3 && remainingDays > 0 && activeDays >= 2 && dailyAverage !== null
    ? dailyAverage * totalDays : null
  const consumedAhead = spent * totalDays > budget.limit * elapsedDays
  const risk: BudgetRisk = spent > budget.limit ? 'exceeded' : spent === budget.limit ? 'at-limit'
    : phase === 'future' ? 'planned' : !remainingDays ? 'closed'
      : projected !== null ? (consumedAhead ? 'projected-excess' : 'on-pace')
        : consumedAhead ? 'ahead' : 'insufficient'

  return {
    phase, totalDays, elapsedDays, remainingDays, timePercentage: elapsedDays / totalDays * 100,
    dailyAverage, projected, dailyMargin: remainingDays ? Math.floor(Math.max(0, budget.limit - spent) / remainingDays) : null,
    concentrated: phase === 'current' && expenses.some(item => item.amount * 4 > spent * 3), risk,
  }
}

export function summarizeBudgets(budgets: Budget[], movements: Movement[], period: BudgetPeriod, today: string) {
  const expenses = expensesInBudgetPeriod(movements, period, today)
  const spentByCategory = new Map<string, number>()
  for (const item of expenses) spentByCategory.set(item.categoryId, (spentByCategory.get(item.categoryId) ?? 0) + item.amount)
  const items = budgets.filter(budget => budget.period === period).map(budget => {
    const used = spentByCategory.get(budget.categoryId) ?? 0
    return { ...budget, used, remaining: budget.limit - used, percentage: used / budget.limit * 100, status: budgetStatus(used, budget.limit),
      projection: budgetProjection(budget, expenses.filter(expense => expense.categoryId === budget.categoryId), today) }
  })
  const plannedCategories = new Set(items.map(item => item.categoryId))
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0)
  const unbudgeted = Array.from(spentByCategory).filter(([id]) => !plannedCategories.has(id))
    .map(([categoryId, spent]) => ({ categoryId, spent, share: spent / totalExpense * 100 })).sort((a, b) => b.spent - a.spent)
  const limit = items.reduce((sum, item) => sum + item.limit, 0)
  const spent = items.reduce((sum, item) => sum + item.used, 0)
  const summary: BudgetSummary = {
    limit, spent, remaining: limit - spent, exceededCount: items.filter(item => item.status === 'exceeded').length,
    totalExpense, unbudgetedSpent: totalExpense - spent, unbudgeted,
  }
  return { items, summary, expenses }
}

export type BudgetView = ReturnType<typeof summarizeBudgets>['items'][number]

export function budgetHistory(budgets: Budget[], movements: Movement[], period: BudgetPeriod, today: string): BudgetHistory[] {
  return Array.from({ length: 6 }, (_, index) => shiftBudgetPeriod(period, index - 5)).flatMap(month => {
    if (!month) return []
    const { items, summary } = summarizeBudgets(budgets, movements, month, today)
    const phase = budgetPhase(month, today)
    return [{ period: month, phase, limit: items.length ? summary.limit : null,
      spent: items.length && phase !== 'future' ? summary.spent : null, remaining: items.length && phase !== 'future' ? summary.remaining : null }]
  })
}

export function consumptionPoints(budget: BudgetView, expenses: Expense[]) {
  const { totalDays, elapsedDays, dailyAverage, projected } = budget.projection
  const byDay = new Map<number, number>()
  for (const item of expenses) {
    const day = Number(item.date.slice(8))
    byDay.set(day, (byDay.get(day) ?? 0) + item.amount)
  }
  let cumulative = 0
  return Array.from({ length: totalDays + 1 }, (_, day) => {
    cumulative += byDay.get(day) ?? 0
    return { day, actual: elapsedDays && day <= elapsedDays ? cumulative : null, limit: budget.limit,
      plan: Math.round(budget.limit * day / totalDays), projection: projected !== null && dailyAverage !== null && day >= elapsedDays ? Math.round(dailyAverage * day) : null }
  })
}

export function conflictingBudgets(budgets: Budget[], source: Budget[], destination: BudgetPeriod) {
  const existing = new Set(budgets.filter(item => item.period === destination).map(item => item.categoryId))
  return source.filter(item => existing.has(item.categoryId))
}

export function validateBudget(draft: Omit<BudgetFormData, 'period'> & { period: string }, budgets: Budget[], expenseIds: string[], today: string, editing?: Budget) {
  const errors: Partial<Record<keyof BudgetFormData, string>> = {}
  const period = parseBudgetPeriod(draft.period)
  if (!expenseIds.includes(draft.categoryId)) errors.categoryId = 'Selecciona una categoría de gasto válida.'
  if (!Number.isSafeInteger(draft.limit) || draft.limit < 1 || draft.limit > 999_999_999_999) errors.limit = 'Ingresa un límite entero entre 1 y 999.999.999.999 CLP.'
  if (!period) errors.period = 'Selecciona un mes y un año válidos.'
  else if (budgetPhase(period, today) === 'closed') errors.period = 'Selecciona el mes actual o uno futuro.'
  else if (editing && (draft.period !== editing.period || draft.categoryId !== editing.categoryId)) errors.period = 'La categoría y el período se conservan al editar.'
  else if (budgets.some(budget => budget.id !== editing?.id && budget.categoryId === draft.categoryId && budget.period === draft.period)) {
    errors.categoryId = 'Ya existe un presupuesto para esta categoría y período.'
  }
  if (!Number.isInteger(draft.warningThreshold) || draft.warningThreshold < 1 || draft.warningThreshold > 100) {
    errors.warningThreshold = 'Ingresa un porcentaje entero entre 1 y 100.'
  }
  if (draft.description.trim().length > 160) errors.description = 'Usa hasta 160 caracteres.'
  return errors
}
