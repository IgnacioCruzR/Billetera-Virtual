import { isIsoDate } from '../../lib/calendar.ts'
import type { Account, FinancialRecords, Movement } from '../dashboard/model.ts'
import { movementCapacity } from '../savings/savings-ledger.ts'
import { reservedFundsError } from '../savings/savings-records.ts'
import type { CommitmentConfirmation, CommitmentFormData, FinancialCommitment } from './commitment-model.ts'

export function validateCommitment(draft: CommitmentFormData, accounts: Account[], categoryIds: string[], today: string, maximum: number, original?: FinancialCommitment) {
  const errors: Partial<Record<keyof CommitmentFormData, string>> = {}
  const account = accounts.find(item => item.id === draft.accountId && item.status === 'activa')
  if (draft.type !== 'cobro' && draft.type !== 'pago') errors.type = 'Selecciona cobro o pago.'
  if (!draft.name.trim() || draft.name.trim().length > 120) errors.name = 'Ingresa un nombre de 1 a 120 caracteres.'
  if (!Number.isSafeInteger(draft.amount) || draft.amount < 1 || draft.amount > maximum) errors.amount = 'Ingresa un monto positivo en pesos enteros, hasta 999.999.999.999 CLP.'
  if (!account) errors.accountId = 'Selecciona una cuenta activa.'
  if (!categoryIds.includes(draft.categoryId)) errors.categoryId = 'Selecciona una categoría compatible.'
  if (!isIsoDate(draft.dueDate)) errors.dueDate = 'Ingresa una fecha de vencimiento válida.'
  else if (account && draft.dueDate < account.openedOn) errors.dueDate = 'El vencimiento debe ser igual o posterior a la apertura de la cuenta.'
  else if (original && draft.dueDate !== original.dueDate && draft.dueDate < today) errors.dueDate = 'Para reprogramar, elige hoy o una fecha futura.'
  if (draft.notes.trim().length > 500) errors.notes = 'Usa hasta 500 caracteres.'
  return errors
}

export function confirmationError(commitment: FinancialCommitment, accounts: Account[], effectiveDate: string, today: string, records?: FinancialRecords) {
  const account = accounts.find(item => item.id === commitment.accountId && item.status === 'activa')
  if (!account) return 'Reactiva la cuenta asociada o edita el compromiso para elegir una cuenta activa.'
  if (!isIsoDate(effectiveDate)) return 'Ingresa una fecha efectiva válida.'
  if (effectiveDate > today) return 'La fecha efectiva debe ser hoy o anterior.'
  if (effectiveDate < account.openedOn) return 'La fecha efectiva debe ser igual o posterior a la apertura de la cuenta.'
  if (commitment.type === 'pago' && records && commitment.amount > movementCapacity(records, account, effectiveDate, today, false).limit) return reservedFundsError
  return ''
}

export function confirmCommitment(records: FinancialRecords, id: string, draft: CommitmentConfirmation, today: string, confirmedAt: string, generateId: () => string) {
  const commitment = records.commitments.find(item => item.id === id)
  if (!commitment) throw new Error('El compromiso ya no está disponible.')
  if (commitment.status === 'confirmado') {
    if (commitment.effectiveDate === draft.effectiveDate) return records
    throw new Error('El compromiso ya fue confirmado con otra fecha efectiva.')
  }
  if (commitment.status === 'cancelado') throw new Error('El compromiso fue cancelado.')
  const error = confirmationError(commitment, records.accounts, draft.effectiveDate, today, records)
  if (error) throw new Error(error)

  const common = {
    id: generateId(), commitmentId: commitment.id, accountId: commitment.accountId, categoryId: commitment.categoryId,
    amount: commitment.amount, date: draft.effectiveDate, description: commitment.name,
  }
  const movement: Movement = commitment.type === 'cobro' ? { ...common, type: 'ingreso' } : { ...common, type: 'gasto', classification: 'automatica' }
  const confirmed: FinancialCommitment = { ...commitment, status: 'confirmado', confirmedAt, effectiveDate: draft.effectiveDate, movementId: movement.id }
  return {
    ...records, commitments: records.commitments.map(item => item.id === id ? confirmed : item), movements: [movement, ...records.movements],
    usedAccountIds: new Set([...records.usedAccountIds, commitment.accountId]),
    usedCategoryIds: new Set([...(records.usedCategoryIds ?? []), commitment.categoryId]),
  }
}

export function cancelCommitment(records: FinancialRecords, id: string, today: string, cancelledAt: string) {
  const commitment = records.commitments.find(item => item.id === id)
  if (!commitment) throw new Error('El compromiso ya no está disponible.')
  if (commitment.status === 'cancelado') return records
  if (commitment.status !== 'pendiente') throw new Error('El compromiso ya tiene un movimiento confirmado.')
  const cancelled: FinancialCommitment = { ...commitment, status: 'cancelado', cancelledAt, cancelledOn: today }
  return { ...records, commitments: records.commitments.map(item => item.id === id ? cancelled : item) }
}
