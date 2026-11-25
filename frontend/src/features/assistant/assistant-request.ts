import { isIsoDate, shiftDays } from '../../lib/calendar.ts'
import { projectionHorizons, type ProjectionHorizon } from '../commitments/commitment-model.ts'
import { healthPeriods } from '../health/health-model.ts'
import { isAnalysisType, type AnalysisContext, type AnalysisDraft, type FinancialAnalysisRequest, type FinancialAnalysisType } from './assistant-model.ts'

export const eligibleGoals = (context: AnalysisContext) => context.records.savingsGoals.filter(goal => !['cancelada', 'finalizada'].includes(goal.status))
export const eligibleAccounts = (context: AnalysisContext) => context.records.accounts.filter(account => account.status === 'activa' && account.openedOn <= context.today)

export function initialDraft(type: FinancialAnalysisType, today: string, defaults?: AnalysisContext['defaults']): AnalysisDraft {
  const period = defaults?.analysisPeriod ?? 'month'
  if (type === 'purchase') return { date: today, minimumFree: String(defaults?.minimumFree ?? 0), horizon: String(defaults?.horizon ?? 30) }
  if (type === 'opportunities') return { period: ['month', 'previous', 'quarter'].includes(period) ? period : 'month', reduction: '25' }
  if (type === 'budgets') return { period: period === 'previous' ? period : 'month' }
  return type === 'savings' ? {} : { period }
}

const amountLimit = 999_999_999_999
function integer(raw = '', minimum = 0, maximum = amountLimit) {
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null
}

export function validateAnalysis(type: unknown, draft: AnalysisDraft, context: AnalysisContext, requestId: string):
  { request: FinancialAnalysisRequest; errors?: never } | { request?: never; errors: Partial<Record<keyof AnalysisDraft | 'type', string>> } {
  const errors: Partial<Record<keyof AnalysisDraft | 'type', string>> = {}
  if (!isAnalysisType(type)) return { errors: { type: 'Selecciona un tipo de análisis válido.' } }
  const categoryId = draft.categoryId || undefined
  const validCategory = context.categories.some(item => item.id === categoryId)
  const period = healthPeriods.find(item => item.id === draft.period)?.id
  const name = draft.name?.trim() ?? ''
  if (type === 'purchase') {
    const amount = integer(draft.amount, 1)
    const minimumFree = integer(draft.minimumFree)
    const horizon = projectionHorizons.find(value => String(value) === draft.horizon) as ProjectionHorizon | undefined
    const date = draft.date ?? ''
    const accountId = draft.accountId ?? ''
    if (amount === null) errors.amount = 'Ingresa un monto entero positivo en CLP.'
    if (minimumFree === null) errors.minimumFree = 'Ingresa una reserva mínima en CLP, desde cero.'
    if (!horizon) errors.horizon = 'Selecciona un horizonte válido.'
    if (!isIsoDate(date) || date < context.today || (horizon && date > shiftDays(context.today, horizon))) errors.date = 'Usa una fecha desde hoy hasta el final del horizonte.'
    if (!eligibleAccounts(context).some(item => item.id === accountId)) errors.accountId = 'Selecciona una cuenta activa disponible.'
    if (!context.categories.some(item => item.id === categoryId && item.status !== 'archivada')) errors.categoryId = 'Selecciona una categoría de gasto activa.'
    if (name.length > 120) errors.name = 'Usa hasta 120 caracteres.'
    if (Object.keys(errors).length) return { errors }
    return { request: { requestId, type, parameters: { name, amount: amount!, minimumFree: minimumFree!, horizon: horizon!, date, accountId, categoryId: categoryId! } } }
  }
  if (type === 'savings') {
    const goalId = draft.goalId ?? ''
    const targetDate = draft.targetDate || undefined
    const monthly = draft.monthly ? integer(draft.monthly, 1) : undefined
    const scenarioId = draft.scenarioId || undefined
    if (!eligibleGoals(context).some(goal => goal.id === goalId)) errors.goalId = 'Selecciona una meta disponible.'
    if (targetDate && (!isIsoDate(targetDate) || targetDate < context.today)) errors.targetDate = 'Usa una fecha objetivo desde hoy.'
    if (monthly === null) errors.monthly = 'Ingresa un aporte mensual entero positivo en CLP.'
    if (scenarioId && !context.scenarios.some(item => item.id === scenarioId)) errors.scenarioId = 'El escenario ya no está disponible.'
    if (Object.keys(errors).length) return { errors }
    return { request: { requestId, type, parameters: { goalId, targetDate, monthly: monthly ?? undefined, scenarioId } } }
  }
  if (!period) return { errors: { period: 'Selecciona un período válido.' } }
  if (type === 'situation' || type === 'health') return { request: { requestId, type, parameters: { period } } }
  if (categoryId && !validCategory) errors.categoryId = 'Selecciona una categoría de gasto válida.'
  if (type === 'budgets') {
    if (period !== 'month' && period !== 'previous') return { errors: { ...errors, period: 'Selecciona el mes actual o el anterior.' } }
    return Object.keys(errors).length ? { errors } : { request: { requestId, type, parameters: { period, categoryId } } }
  }
  if (period !== 'month' && period !== 'previous' && period !== 'quarter') return { errors: { ...errors, period: 'Selecciona un período compatible con Gastos hormiga.' } }
  const reduction = integer(draft.reduction, 0, 100)
  if (reduction === null) errors.reduction = 'Usa un porcentaje entre 0 y 100.'
  return Object.keys(errors).length ? { errors } : { request: { requestId, type, parameters: { period, categoryId, reduction: reduction! } } }
}

export function matchesRequestResources(request: FinancialAnalysisRequest, context: AnalysisContext) {
  const draft = Object.fromEntries(Object.entries(request.parameters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))
  return Boolean(validateAnalysis(request.type, draft, context, request.requestId).request)
}
