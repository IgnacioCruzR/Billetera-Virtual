import type { FinancialRecords } from '../dashboard/model.ts'
import type { MicroExpenseDetectionConfig } from '../micro-expenses/micro-expense-model.ts'
import { createHealthCalculator, healthWindows } from './health-assessment.ts'
import { recommendHealth } from './health-recommendations.ts'
import type { FinancialHealthAssessment, FinancialHealthHistory, FinancialHealthMethodology, FinancialHealthPeriod, FinancialHealthRecommendation, FinancialHealthScenario, FinancialHealthSimulationResult, HealthRange } from './health-model.ts'
import type { CashFlowItem } from '../commitments/commitment-model.ts'

export interface FinancialHealthRepository {
  methodology: FinancialHealthMethodology
  assessment(period: FinancialHealthPeriod): FinancialHealthAssessment
  history(period: FinancialHealthPeriod, report: FinancialHealthAssessment): FinancialHealthHistory
  recommendations(report: FinancialHealthAssessment): FinancialHealthRecommendation[]
  pendingPayments(range: HealthRange): CashFlowItem[]
  simulate(report: FinancialHealthAssessment, scenario: FinancialHealthScenario): FinancialHealthSimulationResult
}

export function createMockHealthRepository(records: FinancialRecords, today: string, criteria: MicroExpenseDetectionConfig, timeZone: string): FinancialHealthRepository {
  const calculator = createHealthCalculator(records, today, criteria, timeZone)
  return {
    methodology: calculator.method,
    assessment: period => calculator.evaluate(healthWindows(period, today).range),
    history: calculator.history, recommendations: recommendHealth, pendingPayments: calculator.pendingPayments, simulate: calculator.simulate,
  }
}

export type HealthDataState = { status: 'loading' | 'error' } | {
  status: 'ready'
  report: FinancialHealthAssessment
  history: FinancialHealthHistory
  recommendations: FinancialHealthRecommendation[]
}

export function loadHealth(repository: FinancialHealthRepository, period: FinancialHealthPeriod, recordsStatus: 'loading' | 'error' | 'ready'): HealthDataState {
  if (recordsStatus !== 'ready') return { status: recordsStatus }
  try {
    const report = repository.assessment(period)
    return { status: 'ready', report, history: repository.history(period, report), recommendations: repository.recommendations(report) }
  } catch {
    return { status: 'error' }
  }
}
