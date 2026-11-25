import { today } from '@/features/dashboard/mock-data'
import { dashboardPeriod, dashboardPeriodEndDates } from '@/features/dashboard/financial-period'
import { filterCategories, readCategories } from '@/features/categories/category-model'
import { movementCapacity, worsensReservation } from '@/features/savings/savings-ledger'
import { reservedFundsError } from '@/features/savings/savings-records'
import type { FinancialRecords, Movement, MovementDraft, Period } from '@/features/dashboard/model'
import { isIsoDate } from '@/lib/calendar'

export { isIsoDate }
export { classificationOf } from '@/features/micro-expenses/micro-expense-detection'

export const maximumMovementAmount = 999_999_999_999

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
    const existing = records.movements.find(item => item.id === editingId)
    const available = filterCategories(readCategories(records), draft.type, true, existing?.type === draft.type ? existing.categoryId : undefined)
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

export const getPeriodEndDates = (period: Period, cutoff = today) => dashboardPeriodEndDates(period, cutoff)

export const getPeriodRange = (period: Period, cutoff = today) => dashboardPeriod(period, cutoff).current

export function totals(movements: Movement[]) {
  let income = 0
  let expense = 0
  for (const movement of movements) {
    if (movement.type === 'ingreso') income += movement.amount
    if (movement.type === 'gasto') expense += movement.amount
  }
  return { income, expense, net: income - expense }
}

