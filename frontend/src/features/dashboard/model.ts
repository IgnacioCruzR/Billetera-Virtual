import type { Budget } from '@/features/budgets/budget-model'
import type { FinancialCommitment } from '@/features/commitments/commitment-model'
import type { MicroExpenseClassification } from '@/features/micro-expenses/micro-expense-model'
import type { SavingsGoal, SavingsReservationOperation } from '@/features/savings/savings-model'
export type { MicroExpenseClassification, MicroExpenseStatus } from '@/features/micro-expenses/micro-expense-model'
export { classificationLabels as microExpenseLabels, classificationOptions as microExpenseOptions } from '@/features/micro-expenses/micro-expense-model'

export type Period = 'month' | 'quarter' | 'year'
export type ChartMode = 'balance' | 'cashflow' | 'savings'
export type MovementType = 'gasto' | 'ingreso' | 'transferencia'

export const periods = [
  { id: 'month', label: 'Este mes' },
  { id: 'quarter', label: 'Últimos 3 meses' },
  { id: 'year', label: 'Este año' },
] as const

export const chartModes = [
  { id: 'balance', label: 'Saldo' },
  { id: 'cashflow', label: 'Ingresos y gastos' },
  { id: 'savings', label: 'Ahorro' },
] as const

export const movementTypes = [
  { id: 'gasto', label: 'Gasto' },
  { id: 'ingreso', label: 'Ingreso' },
  { id: 'transferencia', label: 'Transferencia' },
] as const

export interface Category {
  id: string
  name: string
  color: string
}

export const accountTypes = [
  { id: 'efectivo', label: 'Efectivo' }, { id: 'corriente', label: 'Cuenta corriente' },
  { id: 'vista', label: 'Cuenta vista' }, { id: 'ahorro', label: 'Cuenta de ahorro' },
  { id: 'digital', label: 'Billetera digital' }, { id: 'otra', label: 'Otra cuenta' },
] as const

export type AccountType = typeof accountTypes[number]['id']
export type AccountStatus = 'activa' | 'archivada'

export interface AccountFormData {
  name: string
  type: AccountType
  initialBalance: number
  color: string
  icon: AccountType
  description: string
}

export interface Account extends AccountFormData {
  id: string
  currency: 'CLP'
  openedOn: string
  createdAt: string
  status: AccountStatus
}

export interface AccountAdjustment {
  id: string
  accountId: string
  date: string
  reason: string
  previousBalance: number
  actualBalance: number
  difference: number
}

export interface FinancialRecords {
  accounts: Account[]
  movements: Movement[]
  budgets: Budget[]
  commitments: FinancialCommitment[]
  adjustments: AccountAdjustment[]
  savingsGoals: SavingsGoal[]
  reservations: SavingsReservationOperation[]
  usedAccountIds: ReadonlySet<string>
}

export interface MovementPreset { type?: MovementType; accountId?: string; amount?: number; description?: string }

interface MovementFields {
  accountId: string
  amount: number
  date: string
  description: string
}

export type Transfer = MovementFields & { type: 'transferencia'; destinationId: string }

export type MovementDraft = Transfer
  | (MovementFields & { type: 'ingreso'; categoryId: string })
  | (MovementFields & { type: 'gasto'; categoryId: string; classification: MicroExpenseClassification })

export type Movement = MovementDraft & { id: string; commitmentId?: string }

export interface ChartPoint {
  date: string
  label: string
  balance: number
  income: number
  expense: number
  savings: number
}

export interface ExpenseSlice extends Category {
  amount: number
}

