import type { BudgetPeriod } from '../budgets/budget-model.ts'
import type { CashFlowItem, ProjectionHorizon } from '../commitments/commitment-model.ts'

export const healthPeriods = [
  { id: 'month', label: 'Este mes' }, { id: 'previous', label: 'Mes anterior' }, { id: 'quarter', label: 'Últimos tres meses' },
  { id: 'half-year', label: 'Últimos seis meses' }, { id: 'year', label: 'Últimos doce meses' },
] as const
export type FinancialHealthPeriod = typeof healthPeriods[number]['id']
export type PillarId = 'savings' | 'budget' | 'balance' | 'micro' | 'payments'
export type FinancialHealthScore = number | null
export type FinancialHealthStatus = 'Muy favorable' | 'Favorable' | 'En desarrollo' | 'Requiere atención' | 'Atención prioritaria'
export type EvaluationState = 'insufficient' | 'partial' | 'provisional' | 'complete' | 'reconstructed'
export interface HealthRange { from: string; to: string }
export interface FinancialHealthMethodology {
  version: string
  weights: Record<PillarId, number>
  savingsReference: number
  discretionaryReference: number
  budgetCoverageMinimum: number
  horizon: ProjectionHorizon
}
export interface FinancialHealthPillar {
  id: PillarId
  weight: number
  score: FinancialHealthScore
  points: FinancialHealthScore
  state: 'available' | 'provisional' | 'unavailable'
  reason?: string
}
export interface FinancialHealthDataQuality {
  state: EvaluationState
  coverage: number
  available: number
  observed: boolean
  closed: boolean
  reconstructed: boolean
  notes: string[]
}
export interface HealthBudget {
  id: string
  categoryId: string
  period: BudgetPeriod
  used: number
  limit: number
  risk: boolean
}
export interface HealthPayments { timely: number; late: number; overdue: number; unknown: boolean }
export interface HealthCashFlow {
  total: number
  safe: number
  minimum: number
  final: number
  firstDeficit: string | null
}
export interface FinancialHealthIndicator {
  income: number
  expense: number
  net: number
  savingsRate: number | null
  registered: number | null
  reserved: number | null
  free: number | null
  goalProgress: number | null
  emergencyMonths: number | null
  budgetLimit: number
  budgetedSpend: number
  unbudgetedSpend: number
  unbudgetedCategories: string[]
  budgetCoverage: number | null
  exceeded: number
  budgetRisk: number
  discretionary: number
  discretionaryShare: number | null
  reviewCount: number
  reviewShare: number | null
  classifiedCount: number
  expenseCount: number
  payments: HealthPayments
  overdue: number
  accountsAtRisk: string[]
  upcoming: CashFlowItem[]
  cashFlow: HealthCashFlow | null
  conservative: HealthCashFlow | null
}
export interface FinancialHealthAssessment {
  range: HealthRange
  evaluatedOn: string
  timeZone: string
  version: string
  score: FinancialHealthScore
  status: FinancialHealthStatus | null
  pillars: FinancialHealthPillar[]
  quality: FinancialHealthDataQuality
  indicators: FinancialHealthIndicator
  budgets: HealthBudget[]
}
export interface FinancialHealthHistory {
  points: FinancialHealthAssessment[]
  previous: FinancialHealthAssessment | null
  comparable: boolean
  difference: number | null
  pillarChanges: Record<PillarId, number | null>
}
export interface FinancialHealthScenario {
  income: number
  expense: number
  reduction: number
  free: number
  categoryId: string
  categoryAmount: number | null
  omittedPayments: string[]
}
export interface FinancialHealthSimulationResult {
  base: FinancialHealthAssessment
  scenario: FinancialHealthAssessment
  difference: number | null
  affected: { id: PillarId; difference: number | null }[]
  potentialSaving: number
}
export interface FinancialHealthRecommendation {
  id: string
  title: string
  description: string
  pillar: PillarId
  priority: 'Alta' | 'Media' | 'Oportunidad'
  evidence: string
  count?: number
  amount?: number
  date?: string
  benefit: string
  href: string
  action: string
}
