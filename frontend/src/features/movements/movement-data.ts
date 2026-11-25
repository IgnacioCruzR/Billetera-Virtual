import { expenseCategories, incomeCategories, monthAt, shiftDays, today } from '@/features/dashboard/mock-data'
import { movementCapacity, worsensReservation } from '@/features/savings/savings-ledger'
import { reservedFundsError } from '@/features/savings/savings-records'
import type { FinancialRecords, Movement, MovementDraft, Period } from '@/features/dashboard/model'
import { isIsoDate } from '@/lib/calendar'

export { isIsoDate }
export { classificationOf } from '@/features/micro-expenses/micro-expense-detection'

export const maximumMovementAmount = 999_999_999_999
export const categories = [...expenseCategories, ...incomeCategories]

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
    const { limit, hasReservations } = movementCapacity(records, account, draft.date, today, true, editingId)
    if (draft.amount > limit) {
      errors.amount = hasReservations
        ? 'Saldo disponible insuficiente. Los fondos reservados requieren liberación previa.'
        : 'Saldo disponible insuficiente en la cuenta de origen.'
    }
  }
  if (!Object.keys(errors).length && (editingId || draft.type === 'gasto')) {
    const existing = records.movements.find(item => item.id === editingId)
    const from = existing && existing.date < draft.date ? existing.date : draft.date
    const next = { id: editingId ?? '', ...draft }
    const movements = editingId ? records.movements.map(item => item.id === editingId ? next : item) : [...records.movements, next]
    if (worsensReservation(records, { ...records, movements }, from, today)) errors.amount = reservedFundsError
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

