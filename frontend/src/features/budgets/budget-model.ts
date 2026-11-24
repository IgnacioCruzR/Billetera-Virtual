export type BudgetPeriod = `${number}-${number}`
export type BudgetStatus = 'within' | 'near' | 'limit' | 'exceeded'
export type BudgetRisk = 'on-pace' | 'ahead' | 'projected-excess' | 'at-limit' | 'exceeded' | 'insufficient' | 'planned' | 'closed'
export type BudgetPhase = 'future' | 'current' | 'closed'
export type BudgetAlertKind = 'threshold' | 'limit' | 'exceeded'

export interface BudgetFormData {
  categoryId: string
  period: BudgetPeriod
  limit: number
  warningThreshold: number
  description: string
}

export interface Budget extends BudgetFormData { id: string }

export interface BudgetProjection {
  phase: BudgetPhase
  totalDays: number
  elapsedDays: number
  remainingDays: number
  timePercentage: number
  dailyAverage: number | null
  projected: number | null
  dailyMargin: number | null
  concentrated: boolean
  risk: BudgetRisk
}

export interface UnbudgetedExpense { categoryId: string; spent: number; share: number }

export interface BudgetSummary {
  limit: number
  spent: number
  remaining: number
  exceededCount: number
  unbudgetedSpent: number
  totalExpense: number
  unbudgeted: UnbudgetedExpense[]
}

export interface BudgetHistory {
  period: BudgetPeriod
  phase: BudgetPhase
  limit: number | null
  spent: number | null
  remaining: number | null
}
