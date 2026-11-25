import { isIsoDate } from '../../lib/calendar.ts'
import { parseBudgetPeriod } from '../budgets/budget-calculations.ts'
import { healthPeriods } from '../health/health-model.ts'
import type { AnalysisContext, FinancialAnalysisAction } from './assistant-model.ts'

export const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const validId = (value: unknown) => value === undefined || (typeof value === 'string' && value.length > 0 && value.length <= 128)
const validDate = (value: unknown) => value === undefined || (typeof value === 'string' && isIsoDate(value))

export function parseAction(value: unknown): FinancialAnalysisAction | undefined {
  if (!isObject(value)) return
  const { kind, accountId, budgetId, goalId, commitmentId, categoryId, month, period, from, to } = value
  switch (kind) {
    case 'OPEN_TRANSACTIONS':
      if (validId(categoryId) && validDate(from) && validDate(to) && ((from === undefined && to === undefined) || (typeof from === 'string' && typeof to === 'string' && from <= to))) {
        return { kind, categoryId: categoryId as string | undefined, from: from as string | undefined, to: to as string | undefined }
      }
      return
    case 'OPEN_BUDGET_DETAIL': if (validId(budgetId)) return { kind, budgetId: budgetId as string | undefined }; return
    case 'OPEN_COMMITMENTS': if (validId(commitmentId)) return { kind, commitmentId: commitmentId as string | undefined }; return
    case 'OPEN_SAVINGS_GOAL': if (validId(goalId)) return { kind, goalId: goalId as string | undefined }; return
    case 'OPEN_ACCOUNTS': if (validId(accountId)) return { kind, accountId: accountId as string | undefined }; return
    case 'OPEN_MICRO_EXPENSE_SIMULATOR':
      if (month === undefined || (typeof month === 'string' && parseBudgetPeriod(month))) return { kind, month }
      return
    case 'OPEN_FINANCIAL_HEALTH': {
      const match = healthPeriods.find(item => item.id === period)
      if (period === undefined || match) return { kind, period: match?.id }
      return
    }
  }
}

function link(route: string, label: string, query?: Record<string, string>) {
  const params = new URLSearchParams(query).toString()
  return { href: '#' + route + (params ? '?' + params : ''), label }
}

export function resolveAction(value: unknown, context: AnalysisContext) {
  const action = parseAction(value)
  if (!action) return null
  const { records, categories, today } = context
  switch (action.kind) {
    case 'OPEN_TRANSACTIONS': {
      if (action.categoryId && !categories.some(category => category.id === action.categoryId)) return null
      if (action.to && action.to > today) return null
      const filters: Record<string, string> = {}
      if (action.from && action.to) { filters.desde = action.from; filters.hasta = action.to }
      if (action.categoryId) { filters.categoria = action.categoryId; filters.tipo = 'gasto' }
      return link('movimientos', 'Abrir Movimientos', filters)
    }
    case 'OPEN_BUDGET_DETAIL': {
      if (!action.budgetId) return link('presupuestos', 'Abrir Presupuestos')
      const budget = records.budgets.find(item => item.id === action.budgetId)
      return budget ? link('presupuestos', 'Abrir detalle del presupuesto', { presupuesto: budget.id, mes: budget.period }) : null
    }
    case 'OPEN_COMMITMENTS':
      if (!action.commitmentId) return link('compromisos', 'Abrir Cobros y pagos')
      return records.commitments.some(item => item.id === action.commitmentId) ? link('compromisos', 'Abrir compromiso', { compromiso: action.commitmentId }) : null
    case 'OPEN_SAVINGS_GOAL':
      if (!action.goalId) return link('metas', 'Abrir planificador de Metas de ahorro', { plan: '1' })
      return records.savingsGoals.some(item => item.id === action.goalId && !['finalizada', 'cancelada'].includes(item.status))
        ? link('metas', 'Abrir planificador de la meta', { plan: '1', meta: action.goalId }) : null
    case 'OPEN_ACCOUNTS':
      if (!action.accountId) return link('cuentas', 'Abrir Mis cuentas')
      return records.accounts.some(item => item.id === action.accountId) ? link('cuentas', 'Abrir cuenta', { cuenta: action.accountId }) : null
    case 'OPEN_MICRO_EXPENSE_SIMULATOR':
      if (action.month && action.month > today.slice(0, 7)) return null
      return link('hormiga', 'Abrir simulador de Gastos hormiga', { simulador: 'prescindibles', ...(action.month ? { mes: action.month } : {}) })
    case 'OPEN_FINANCIAL_HEALTH':
      return link('salud', 'Abrir Salud financiera', action.period ? { periodo: action.period } : undefined)
  }
}
