import { isIsoDate } from '../../lib/calendar.ts'
import type { FinancialRecords } from '../dashboard/model.ts'
import { contributionCapacity, goalHistory, releaseCapacity, reservedAt } from './savings-ledger.ts'
import { goalTemplates, type SavingsContribution, type SavingsGoal, type SavingsGoalFormData, type SavingsGoalStatus, type SavingsReservationOperation, type SavingsReservationType } from './savings-model.ts'

export const maximumSavingsAmount = 999_999_999_999
export const reservedFundsError = 'Libera fondos de tus metas antes de usar el dinero reservado.'
const positiveAmount = (amount: number) => Number.isSafeInteger(amount) && amount > 0 && amount <= maximumSavingsAmount

export function validateGoal(draft: SavingsGoalFormData, today: string, original?: SavingsGoal, reserved = 0) {
  const errors: Partial<Record<keyof SavingsGoalFormData, string>> = {}
  if (!draft.name.trim() || draft.name.trim().length > 90) errors.name = 'Ingresa un nombre de 1 a 90 caracteres.'
  if (!positiveAmount(draft.target)) errors.target = 'Ingresa un monto objetivo positivo en pesos enteros.'
  else if (draft.target < reserved) errors.target = 'Libera primero el dinero que excede este objetivo.'
  if (draft.targetDate && (!isIsoDate(draft.targetDate) || (draft.targetDate !== original?.targetDate && draft.targetDate <= today))) errors.targetDate = 'Elige una fecha posterior a hoy.'
  if (draft.monthlyPlan !== null && !positiveAmount(draft.monthlyPlan)) errors.monthlyPlan = 'Ingresa un aporte positivo en pesos o deja el campo vacío.'
  if (draft.description.length > 500) errors.description = 'Usa hasta 500 caracteres.'
  if (!goalTemplates.some(item => item.id === draft.template) || !goalTemplates.some(item => item.id === draft.icon)) errors.template = 'Elige una categoría visual y un icono válidos.'
  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) errors.color = 'Elige un color válido.'
  return errors
}

export function reservationError(records: FinancialRecords, goal: SavingsGoal, draft: SavingsContribution, type: SavingsReservationType, today: string) {
  if (type === 'aporte' && goal.status !== 'en-progreso') return 'Solo las metas en progreso admiten aportes.'
  if (type === 'liberacion' && (goal.status === 'cancelada' || goal.status === 'finalizada')) return 'La meta ya está cerrada.'
  const account = records.accounts.find(item => item.id === draft.accountId)
  if (!account || (type === 'aporte' && account.status !== 'activa')) return 'Selecciona una cuenta activa.'
  if (!isIsoDate(draft.date) || draft.date < goal.createdOn || draft.date < account.openedOn || draft.date > today) return 'Elige una fecha entre la creación de la meta, la apertura de la cuenta y hoy.'
  if (!positiveAmount(draft.amount)) return 'Ingresa un monto positivo en pesos enteros.'
  if (draft.description.length > 500) return 'Usa hasta 500 caracteres en la descripción.'
  if (type === 'liberacion') return draft.amount > releaseCapacity(records, account.id, goal.id, draft.date, today)
    ? 'El monto supera la reserva liberable de esta meta en la cuenta para esa fecha.' : ''
  const dates = new Set([draft.date, today, ...records.reservations.filter(item => item.goalId === goal.id && item.date >= draft.date && item.date <= today).map(item => item.date)])
  if ([...dates].some(date => draft.amount + reservedAt(records, date, undefined, goal.id) > goal.target)) return 'El aporte supera el monto restante de la meta para esa fecha.'
  return draft.amount > contributionCapacity(records, account, draft.date, today) ? 'La cuenta no tiene dinero libre suficiente para ese aporte.' : ''
}

type ChangeContext = { today: string; now: string; id: () => string }

function requireGoal(records: FinancialRecords, id: string) {
  const goal = records.savingsGoals.find(item => item.id === id)
  if (!goal) throw new Error('La meta ya no está disponible.')
  return goal
}

function replaceGoal(records: FinancialRecords, goal: SavingsGoal) {
  return { ...records, savingsGoals: records.savingsGoals.map(item => item.id === goal.id ? goal : item) }
}

export function recordReservation(records: FinancialRecords, type: SavingsReservationType, draft: SavingsContribution, context: ChangeContext) {
  const { today, now, id } = context
  const goal = requireGoal(records, draft.goalId)
  const error = reservationError(records, goal, draft, type, today)
  if (error) throw new Error(error)
  const operation: SavingsReservationOperation = { ...draft, id: id(), type, description: draft.description.trim(), recordedAt: now }
  const next = { ...records, reservations: [...records.reservations, operation] }
  const reserved = reservedAt(next, today, undefined, goal.id)
  if (type === 'aporte' && reserved === goal.target) return replaceGoal(next, { ...goal, status: 'alcanzada', reachedOn: today })
  if (type === 'liberacion' && goal.status === 'alcanzada') return replaceGoal(next, { ...goal, status: 'en-progreso', reachedOn: undefined })
  return next
}

export function saveSavingsGoal(records: FinancialRecords, draft: SavingsGoalFormData, context: ChangeContext, userId: string, existingId?: string, initial?: Pick<SavingsContribution, 'accountId' | 'amount'>) {
  const { today, now, id } = context
  const existing = existingId ? requireGoal(records, existingId) : undefined
  if (existing && (existing.status !== 'en-progreso' || initial)) throw new Error('Solo puedes editar metas en progreso.')
  const reserved = existing ? reservedAt(records, today, undefined, existing.id) : 0
  const error = Object.values(validateGoal(draft, today, existing, reserved))[0]
  if (error) throw new Error(error)
  const form = { ...draft, name: draft.name.trim(), description: draft.description.trim() }
  if (existing) {
    const reached = draft.target === reserved
    return replaceGoal(records, { ...existing, ...form, status: reached ? 'alcanzada' : 'en-progreso', reachedOn: reached ? today : undefined })
  }
  const goal: SavingsGoal = { ...form, id: id(), userId, currency: 'CLP', status: 'en-progreso', createdOn: today, createdAt: now }
  const next = { ...records, savingsGoals: [goal, ...records.savingsGoals] }
  return initial ? recordReservation(next, 'aporte', { ...initial, goalId: goal.id, date: today, description: 'Aporte inicial' }, context) : next
}

export type LifecycleAction = 'pausar' | 'reactivar' | 'finalizar' | 'cancelar'

const transitions: Record<LifecycleAction, { from: SavingsGoalStatus[]; to: SavingsGoalStatus }> = {
  pausar: { from: ['en-progreso'], to: 'pausada' }, reactivar: { from: ['pausada'], to: 'en-progreso' },
  finalizar: { from: ['alcanzada'], to: 'finalizada' }, cancelar: { from: ['en-progreso', 'pausada'], to: 'cancelada' },
}

export function changeGoalStatus(records: FinancialRecords, goalId: string, action: LifecycleAction, { today, now, id }: ChangeContext) {
  const goal = requireGoal(records, goalId)
  const { from, to } = transitions[action]
  if (goal.status === to) return records
  if (!from.includes(goal.status)) throw new Error('La acción ya no está disponible para esta meta.')
  const closes = to === 'finalizada' || to === 'cancelada'
  if (!closes) return replaceGoal(records, { ...goal, status: to })
  const releases: SavingsReservationOperation[] = [...goalHistory(goal, records, today).byAccount].flatMap(([accountId, amount]) => amount > 0 ? [{
    id: id(), type: 'liberacion', goalId, accountId, amount, date: today, recordedAt: now,
    description: to === 'finalizada' ? 'Liberación por cierre de la meta' : 'Liberación por cancelación',
  }] : [])
  return replaceGoal({ ...records, reservations: [...records.reservations, ...releases] }, { ...goal, status: to, closedOn: today })
}
