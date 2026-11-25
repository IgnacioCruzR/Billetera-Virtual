export type CommitmentType = 'cobro' | 'pago'
export type CommitmentStatus = 'pendiente' | 'confirmado' | 'cancelado'
export type CommitmentVisualStatus = CommitmentStatus | 'vencido' | 'por-vencer'

export interface CommitmentFormData {
  type: CommitmentType
  name: string
  amount: number
  accountId: string
  categoryId: string
  dueDate: string
  notes: string
}

export type FinancialCommitment = CommitmentFormData & { id: string; userId: string; currency: 'CLP'; createdAt: string; originalDueDate?: string } & (
  | { status: 'pendiente' }
  | ({ status: 'confirmado'; confirmedAt: string; movementId: string } & CommitmentConfirmation)
  | { status: 'cancelado'; cancelledAt: string; cancelledOn: string }
)

export interface CommitmentConfirmation { effectiveDate: string }

export interface CommitmentFilters {
  search: string
  type: CommitmentType | ''
  status: CommitmentStatus | 'vencido' | ''
  accountId: string
  categoryId: string
  from: string
  to: string
}

export type CommitmentSort = 'prioridad' | 'fecha' | 'monto' | 'estado'
export const projectionHorizons = [7, 15, 30, 60, 90] as const
export type ProjectionHorizon = typeof projectionHorizons[number]

export type CashFlowItem = Pick<CommitmentFormData, 'type' | 'name' | 'dueDate' | 'amount'> & { id: string; hypothetical?: boolean }
export interface CashFlowScenario {
  changes: Record<string, { dueDate: string; amount: number; excluded: boolean }>
  hypothetical: CashFlowItem[]
  reserve: number | null
}

export interface CashFlowDataPoint {
  date: string
  balance: number
  receipts: number
  payments: number
  items: CashFlowItem[]
}

export interface CashFlowProjection {
  startingBalance: number
  endDate: string
  finalBalance: number
  minimumBalance: number
  minimumDate: string
  firstDeficit: string | null
  reserve: number | null
  margin: number | null
  points: CashFlowDataPoint[]
}

export interface CommitmentSummary {
  receipts: number
  payments: number
  pendingCount: number
  overdueCount: number
  next: FinancialCommitment | null
}

export type FinancialRisk = {
  id: 'due' | 'overdue' | 'before-receipts' | 'deficit' | 'depleted' | 'concentration' | 'reserve'
  date: string
  amount?: number
  count?: number
}
