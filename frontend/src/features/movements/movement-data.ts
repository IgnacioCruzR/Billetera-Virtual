import { expenseCategories, incomeCategories, monthAt, reservedForAccount, shiftDays, today } from '@/features/dashboard/mock-data'
import { balanceOn } from '@/features/accounts/account-balances'
import type { FinancialRecords, MicroExpenseCriteria, MicroExpenseStatus, Movement, MovementDraft, Period } from '@/features/dashboard/model'

export const maximumMovementAmount = 999_999_999_999
export const categories = [...expenseCategories, ...incomeCategories]

export function isIsoDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = new Date(`${date}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

type Field = 'amount' | 'account' | 'destination' | 'category' | 'date'

export function validateMovement(draft: MovementDraft, records: FinancialRecords, editingId?: string) {
  const errors: Partial<Record<Field, string>> = {}
  const account = records.accounts.find(item => item.status === 'activa' && item.id === draft.accountId)
  const destination = draft.type === 'transferencia'
    ? records.accounts.find(item => item.status === 'activa' && item.id === draft.destinationId)
    : undefined
  if (!Number.isSafeInteger(draft.amount) || draft.amount < 1 || draft.amount > maximumMovementAmount) {
    errors.amount = 'Ingresa un monto entero entre 1 y 999.999.999.999 CLP.'
  }
  if (!account) errors.account = 'Selecciona una cuenta activa.'
  if (draft.type === 'transferencia') {
    if (!destination || destination.id === account?.id) errors.destination = 'Selecciona una cuenta activa distinta del origen.'
  } else {
    const available = draft.type === 'gasto' ? expenseCategories : incomeCategories
    if (!available.some(item => item.id === draft.categoryId)) errors.category = 'Selecciona una categoría compatible.'
  }
  if (!isIsoDate(draft.date)) errors.date = 'Ingresa una fecha válida.'
  else if (draft.date > today) errors.date = 'La fecha debe ser hoy o anterior.'
  else if ((account && draft.date < account.openedOn) || (destination && draft.date < destination.openedOn)) {
    errors.date = 'La fecha debe ser igual o posterior a la apertura de las cuentas.'
  }
  if (draft.type === 'transferencia' && account && destination && !errors.destination && !errors.date && !errors.amount) {
    const reserved = reservedForAccount(account.id)
    const balance = Math.min(balanceOn(account, records, draft.date, editingId), balanceOn(account, records, today, editingId))
    if (draft.amount > balance - reserved) {
      errors.amount = reserved > 0
        ? 'Saldo disponible insuficiente. Los fondos reservados requieren liberación previa.'
        : 'Saldo disponible insuficiente en la cuenta de origen.'
    }
  }
  return errors
}

export function getPeriodEndDates(period: Period) {
  const { from } = getPeriodRange(period)
  const count = period === 'month' ? Number(today.slice(8)) : period === 'quarter' ? 3 : Number(today.slice(5, 7))
  return Array.from({ length: count }, (_, index) => {
    if (period === 'month') return shiftDays(from, index)
    return index === count - 1 ? today : shiftDays(`${monthAt(index - count + 2)}-01`, -1)
  })
}

export function getPeriodRange(period: Period) {
  const month = period === 'quarter' ? monthAt(-2) : period === 'year' ? `${today.slice(0, 4)}-01` : monthAt(0)
  return { from: `${month}-01`, to: today }
}

export function totals(movements: Movement[]) {
  let income = 0
  let expense = 0
  for (const movement of movements) {
    if (movement.type === 'ingreso') income += movement.amount
    if (movement.type === 'gasto') expense += movement.amount
  }
  return { income, expense, net: income - expense }
}

export function detectMicroExpenses(movements: Movement[], criteria: MicroExpenseCriteria) {
  const groups = new Map<string, string[]>()
  for (const item of movements) {
    if (item.type !== 'gasto' || item.classification === 'necesario' || item.amount > criteria.maximumAmount) continue
    const key = `${item.date.slice(0, 7)}:${item.categoryId}`
    const group = groups.get(key) ?? []
    group.push(item.id)
    groups.set(key, group)
  }
  return new Set(Array.from(groups.values()).filter(group => group.length >= criteria.minimumCount).flat())
}

export function classificationOf(movement: Movement, detected: ReadonlySet<string>): MicroExpenseStatus {
  if (movement.type !== 'gasto') return 'sin-clasificacion'
  if (movement.classification !== 'automatica') return movement.classification
  return detected.has(movement.id) ? 'posible' : 'sin-clasificacion'
}

