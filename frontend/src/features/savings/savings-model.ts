export type SavingsGoalStatus = 'en-progreso' | 'pausada' | 'alcanzada' | 'finalizada' | 'cancelada'
export type SavingsReservationType = 'aporte' | 'liberacion'
export type SavingsGoalAction = 'detail' | 'edit' | 'aporte' | 'liberacion' | 'pausar' | 'reactivar' | 'finalizar' | 'cancelar'

export const goalTemplates = [
  { id: 'emergencia', name: 'Fondo de emergencia', color: '#818CF8' },
  { id: 'tecnologia', name: 'Tecnología', color: '#60A5FA' },
  { id: 'viajes', name: 'Viajes', color: '#2DD4BF' },
  { id: 'educacion', name: 'Educación', color: '#A78BFA' },
  { id: 'vivienda', name: 'Vivienda', color: '#34D399' },
  { id: 'vehiculo', name: 'Vehículos', color: '#38BDF8' },
  { id: 'salud', name: 'Salud', color: '#F472B6' },
  { id: 'compras', name: 'Compras personales', color: '#FBBF24' },
  { id: 'personal', name: 'Personalizada', color: '#818CF8' },
] as const
export type GoalTemplate = typeof goalTemplates[number]['id']

export interface SavingsGoalFormData {
  name: string
  description: string
  target: number
  targetDate: string
  monthlyPlan: number | null
  template: GoalTemplate
  icon: GoalTemplate
  color: string
}
export interface SavingsGoal extends SavingsGoalFormData {
  id: string
  userId: string
  currency: 'CLP'
  status: SavingsGoalStatus
  createdOn: string
  createdAt: string
  reachedOn?: string
  closedOn?: string
}
export interface SavingsContribution {
  goalId: string
  accountId: string
  date: string
  amount: number
  description: string
}
export interface SavingsReservationOperation extends SavingsContribution {
  id: string
  type: SavingsReservationType
  recordedAt: string
}
export interface AccountReservationSummary {
  balance: number
  reserved: number
  free: number
}
export interface SavingsGoalHistory {
  goal: SavingsGoal
  operations: SavingsReservationOperation[]
  byAccount: Map<string, number>
  reserved: number
  remaining: number
  progress: number
  overdue: boolean
}
export interface SavingsSummary {
  reserved: number
  target: number
  activeReserved: number
  progress: number | null
  activeCount: number
  reachedCount: number
  netThisMonth: number
  registered: number
  free: number
  availableForNew: number
  financialSurplus: number
}
export interface SavingsProjection {
  remaining: number
  months: number | null
  estimatedDate: string | null
  requiredMonthly: number | null
  availableDeposits: number | null
}
export interface SavingsScenario {
  id: string
  name: string
  monthlyPotential: number
  from: string
  to: string
}
export interface SavingsRecommendation {
  kind: 'funds' | 'commitments' | 'overdue' | 'plan' | 'progress'
  text: string
}
