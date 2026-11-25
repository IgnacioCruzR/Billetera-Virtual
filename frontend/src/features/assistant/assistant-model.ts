import type { ProjectionHorizon } from '../commitments/commitment-model.ts'
import type { FinancialRecords } from '../dashboard/model.ts'
import type { FinancialHealthPeriod, HealthRange } from '../health/health-model.ts'
import type { MicroExpenseDetectionConfig } from '../micro-expenses/micro-expense-model.ts'
import type { SavingsScenario } from '../savings/savings-model.ts'

export const analysisCatalog = {
  situation: { title: 'Situación financiera', description: 'Revisa tu balance, dinero libre y obligaciones en un mismo informe.', sources: ['Movimientos efectivos', 'Cuentas y reservas', 'Presupuestos y compromisos', 'Evaluación de salud financiera'] },
  opportunities: { title: 'Oportunidades de ahorro', description: 'Explora patrones y simula reducir consumos marcados como prescindibles.', sources: ['Candidatos, patrones y clasificaciones', 'Consumo presupuestario', 'Cortes comparables disponibles'] },
  purchase: { title: 'Capacidad de compra', description: 'Compara el impacto de una compra sobre una cuenta y su presupuesto.', sources: ['Saldo libre y reservas por cuenta', 'Cobros y pagos pendientes', 'Presupuesto del mes de la compra'] },
  budgets: { title: 'Optimización presupuestaria', description: 'Identifica límites en riesgo y gastos que aún no tienen planificación.', sources: ['Límites y gastos efectivos', 'Ritmo y proyección de cierre', 'Consumo de un corte anterior equivalente'] },
  health: { title: 'Interpretación de salud financiera', description: 'Entiende qué aportan los cinco pilares y qué datos te faltan.', sources: ['Puntuaciones, ponderaciones y metodología vigentes', 'Calidad de datos y comparación histórica'] },
  savings: { title: 'Plan de ahorro', description: 'Compara el aporte previsto con un escenario adicional para una meta.', sources: ['Meta y aportes efectivos', 'Dinero libre y compromisos próximos', 'Escenario de gastos hormiga de la sesión'] },
} as const

export type FinancialAnalysisType = keyof typeof analysisCatalog
export const analysisTypes = Object.keys(analysisCatalog) as FinancialAnalysisType[]
export const isAnalysisType = (value: unknown): value is FinancialAnalysisType => typeof value === 'string' && Object.hasOwn(analysisCatalog, value)

export interface PurchaseImpactScenario {
  name: string; amount: number; date: string; accountId: string; categoryId: string; minimumFree: number; horizon: ProjectionHorizon
}
export type FinancialAnalysisParameters = {
  situation: { period: FinancialHealthPeriod }
  opportunities: { period: 'month' | 'previous' | 'quarter'; categoryId?: string; reduction: number }
  purchase: PurchaseImpactScenario
  budgets: { period: 'month' | 'previous'; categoryId?: string }
  health: { period: FinancialHealthPeriod }
  savings: { goalId: string; targetDate?: string; monthly?: number; scenarioId?: string }
}
export type FinancialAnalysisRequest = { [T in FinancialAnalysisType]: { requestId: string; type: T; parameters: FinancialAnalysisParameters[T] } }[FinancialAnalysisType]
export interface FinancialAnalysisConsent { preference: 'unset' | 'allowed' | 'declined' | 'revoked'; updatedOn?: string }
export const mayGenerateAnalysis = (enabled: boolean, preference: FinancialAnalysisConsent['preference'], origin: 'demo' | 'ai') =>
  enabled && preference !== 'revoked' && (origin === 'demo' || preference === 'allowed')
export type FinancialAnalysisStatus = 'available' | 'insufficient' | 'incomplete'
export type AnalysisFailureCode = 'communication' | 'mcp' | 'provider' | 'timeout' | 'rate-limit' | 'cancelled' | 'consent' | 'invalid'
export type AnalysisPriority = 'Alta' | 'Media' | 'Normal'
export interface FinancialAnalysisSummary { text: string }
export type FinancialAnalysisMetric = {
  id: string; label: string; source: 'verified' | 'hypothesis'
} & (
  | { unit: 'clp' | 'percent' | 'count' | 'score' | 'points'; value: number | null }
  | { unit: 'date'; value: string | null }
)
export interface FinancialAnalysisEvidence { metricIds: string[]; text: string; sensitive?: boolean }
export type FinancialAnalysisAction =
  | { kind: 'OPEN_TRANSACTIONS'; categoryId?: string; from?: string; to?: string }
  | { kind: 'OPEN_BUDGET_DETAIL'; budgetId?: string }
  | { kind: 'OPEN_COMMITMENTS'; commitmentId?: string }
  | { kind: 'OPEN_MICRO_EXPENSE_SIMULATOR'; month?: string }
  | { kind: 'OPEN_SAVINGS_GOAL'; goalId?: string }
  | { kind: 'OPEN_FINANCIAL_HEALTH'; period?: FinancialHealthPeriod }
  | { kind: 'OPEN_ACCOUNTS'; accountId?: string }
export interface FinancialAnalysisRisk { title: string; priority: AnalysisPriority; evidence: FinancialAnalysisEvidence }
export interface FinancialAnalysisRecommendation extends FinancialAnalysisRisk {
  description: string; benefit?: string; action?: FinancialAnalysisAction;
}
export interface FinancialAnalysisDataQuality { available: string[]; missing: string[] }
export interface PurchaseForecast {
  after: number; final: number; minimum: number; minimumDate: string; firstDeficit: string | null; minimumMargin: number;
}
export interface PurchaseImpactResult {
  accountBalance: number; reserved: number; free: number; amount: number; date: string; minimumFree: number;
  expected: PurchaseForecast; conservative: PurchaseForecast; total: PurchaseForecast; totalConservative: PurchaseForecast;
  budget: { id: string; limit: number; used: number; remainingBefore: number; remainingAfter: number } | null;
  trend: { date: string; expected: number; conservative: number }[];
}
export interface FinancialAnalysisResult {
  requestId: string; type: FinancialAnalysisType; status: FinancialAnalysisStatus; origin: 'demo' | 'ai'; generatedAt: string;
  range: HealthRange; templateVersion: string; summary: FinancialAnalysisSummary; metrics: FinancialAnalysisMetric[];
  strengths: FinancialAnalysisEvidence[]; risks: FinancialAnalysisRisk[]; opportunities: FinancialAnalysisEvidence[];
  recommendations: FinancialAnalysisRecommendation[]; quality: FinancialAnalysisDataQuality;
  assumptions: string[]; limitations: string[]; purchase?: PurchaseImpactResult;
}
export interface AnalysisContext {
  records: FinancialRecords; criteria: MicroExpenseDetectionConfig; today: string; timeZone: string;
  categories: ReadonlyArray<{ id: string; name: string; status?: 'activa' | 'archivada' }>; scenarios: readonly SavingsScenario[];
  defaults?: { analysisPeriod: FinancialHealthPeriod; horizon: ProjectionHorizon; minimumFree: number | null };
}
export interface FinancialAnalysisHistoryItem { request: FinancialAnalysisRequest; result: FinancialAnalysisResult; contextVersion: symbol }
export type AnalysisDraft = Partial<Record<'period' | 'name' | 'amount' | 'date' | 'accountId' | 'categoryId' | 'minimumFree' | 'horizon' | 'goalId' | 'targetDate' | 'monthly' | 'scenarioId' | 'reduction', string>>
export const analysisStatusLabels: Record<FinancialAnalysisStatus, string> = { available: 'Disponible', insufficient: 'Información insuficiente', incomplete: 'Respuesta incompleta' }
