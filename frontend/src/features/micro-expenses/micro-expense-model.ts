import type { Movement, Period } from '../dashboard/model.ts'

export type MicroExpenseClassification = 'automatica' | 'necesario' | 'prescindible' | 'excluido'
export type MicroExpenseStatus = 'sin-clasificacion' | 'posible' | Exclude<MicroExpenseClassification, 'automatica'>
export type ClassificationSource = 'automática' | 'manual' | 'sin asignar'
export type ExpenseMovement = Extract<Movement, { type: 'gasto' }>
export const classificationOptions = [
  { id: 'automatica', label: 'Automática' },
  { id: 'necesario', label: 'Gasto pequeño necesario' },
  { id: 'prescindible', label: 'Gasto pequeño prescindible' },
  { id: 'excluido', label: 'Excluido del análisis' },
] as const

export const classificationLabels: Record<MicroExpenseStatus, string> = {
  posible: 'Posible gasto hormiga', necesario: 'Gasto pequeño necesario', prescindible: 'Gasto pequeño prescindible',
  excluido: 'Excluido del análisis', 'sin-clasificacion': 'Sin clasificación',
}

export interface MicroExpenseDetectionConfig {
  enabled: boolean
  maximumAmount: number
  minimumCount: number
  excludedCategoryIds: string[]
  frequencyView: 'weekday' | 'pattern'
}
export interface MicroExpenseDetectionResult { candidateIds: ReadonlySet<string> }
export interface MicroExpensePeriod { month: string; range: Period }
export interface DateRange { from: string; to: string }
export interface MicroExpenseHistory {
  movement: ExpenseMovement
  status: MicroExpenseStatus
  source: ClassificationSource
  patternId: string
}
export interface MicroExpenseFilters {
  search: string
  account: string
  category: string
  from: string
  to: string
  minimum: string
  maximum: string
  classification: MicroExpenseStatus | ''
  patternId: string
  includedOnly: boolean
}
export interface SpendingPattern {
  id: string
  name: string
  categoryId: string
  count: number
  amount: number
  average: number
  share: number
  perWeek: number
  variation: number | null
}
export interface MicroExpenseSummary {
  amount: number
  count: number
  average: number | null
  perWeek: number
  expenseShare: number | null
  incomeShare: number | null
  variation: number | null
  pendingCount: number
  necessaryCount: number
  discretionaryCount: number
  discretionary: number
  monthlyEstimate: number | null
  annualEstimate: number | null
}
export interface SavingsScenario {
  patternIds: string[]
  includeDiscretionary: boolean
  movementIds: string[]
  reduction: number
  patternReductions: Record<string, number>
}
export interface SavingsSimulation {
  selectedCount: number
  baseMonthly: number | null
  monthly: number | null
  quarterly: number | null
  halfYear: number | null
  annual: number | null
  reducedMonthly: number | null
}
export interface MicroExpenseRecommendation {
  id: 'review' | 'pattern' | 'share' | 'variation' | 'saving'
  title: string
  detail: string
  action: 'history' | 'pattern' | 'simulator'
}
