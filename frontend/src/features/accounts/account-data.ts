import { useEffect, useState } from 'react'
import { accounts, refreshFinancialDate, seedBudgets, seedCommitments, seedMovements, seedReservations, seedSavingsGoals, today } from '@/features/dashboard/mock-data'
import { demoProfile } from '@/features/settings/settings-data'
import { changeCategory, filterCategories, readCategories, saveCategory, seedCategories, type CategoryFormData } from '@/features/categories/category-model'
import { cancelCommitment, confirmCommitment, validateCommitment } from '@/features/commitments/commitment-records'
import type { CommitmentConfirmation, CommitmentFormData, FinancialCommitment } from '@/features/commitments/commitment-model'
import { budgetPhase, conflictingBudgets, parseBudgetPeriod, validateBudget } from '@/features/budgets/budget-calculations'
import type { BudgetFormData, BudgetPeriod } from '@/features/budgets/budget-model'
import { accountTypes, type Account, type AccountFormData, type AccountStatus, type FinancialRecords, type MovementDraft } from '@/features/dashboard/model'
import { isIsoDate, maximumMovementAmount, validateMovement } from '@/features/movements/movement-data'
import { balanceOn } from './account-balances'
import { classificationOptions, type MicroExpenseClassification } from '@/features/micro-expenses/micro-expense-model'
import { reservedAt, worsensReservation } from '@/features/savings/savings-ledger'
import { changeGoalStatus, recordReservation, reservedFundsError, saveSavingsGoal, type LifecycleAction } from '@/features/savings/savings-records'
import type { SavingsContribution, SavingsGoalFormData, SavingsReservationType } from '@/features/savings/savings-model'

export const accountTypeLabel = (type: Account['type']) => accountTypes.find(item => item.id === type)!.label

export function accountReferences(id: string, records: FinancialRecords) {
  return {
    reserved: reservedAt(records, today, id),
    hasReservationHistory: records.reservations.some(item => item.accountId === id),
    commitments: records.commitments.filter(item => item.accountId === id).length,
  }
}

export function deletionReasons(account: Account, records: FinancialRecords) {
  const references = accountReferences(account.id, records)
  return [
    balanceOn(account, records, today) !== 0 && 'Debe tener saldo de $0.',
    records.usedAccountIds.has(account.id) && 'Tiene movimientos, transferencias o ajustes registrados en su historial.',
    references.reserved > 0 && 'Tiene fondos reservados para metas de ahorro.',
    references.reserved === 0 && references.hasReservationHistory && 'Tiene operaciones de reserva en su historial.',
    references.commitments > 0 && 'Tiene compromisos asociados.',
  ].filter((reason): reason is string => Boolean(reason))
}

export function validateAccount(draft: AccountFormData) {
  const errors: Partial<Record<keyof AccountFormData, string>> = {}
  if (!draft.name.trim() || draft.name.trim().length > 60) errors.name = 'Ingresa un nombre de 1 a 60 caracteres.'
  if (!accountTypes.some(item => item.id === draft.type)) errors.type = 'Elige un tipo de cuenta válido.'
  if (!Number.isSafeInteger(draft.initialBalance) || draft.initialBalance < 0 || draft.initialBalance > maximumMovementAmount) {
    errors.initialBalance = 'Ingresa un saldo inicial entero entre 0 y 999.999.999.999 CLP.'
  }
  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) errors.color = 'Elige un color válido.'
  if (!accountTypes.some(item => item.id === draft.icon)) errors.icon = 'Elige un icono válido.'
  return errors
}

export interface AdjustmentDraft {
  accountId: string
  date: string
  actualBalance: number
  previousBalance: number
  reason: string
  confirmed: boolean
}

export function validateAdjustment(draft: AdjustmentDraft, account: Account, currentBalance: number) {
  const errors: Partial<Record<'actualBalance' | 'date' | 'reason' | 'confirmed', string>> = {}
  if (!Number.isSafeInteger(draft.actualBalance) || Math.abs(draft.actualBalance) > maximumMovementAmount) {
    errors.actualBalance = 'Ingresa el saldo real en pesos enteros.'
  } else if (draft.actualBalance === currentBalance) errors.actualBalance = 'El saldo real debe ser distinto del saldo registrado.'
  if (!isIsoDate(draft.date) || draft.date < account.openedOn || draft.date > today) errors.date = 'Elige una fecha entre la apertura y hoy.'
  if (!draft.reason.trim() || draft.reason.trim().length > 160) errors.reason = 'Escribe un motivo de 1 a 160 caracteres.'
  if (!draft.confirmed) errors.confirmed = 'Confirma que quieres registrar el ajuste.'
  return errors
}

export interface FinancialRepository {
  list(): Promise<FinancialRecords>
  saveCategory(draft: CategoryFormData, id?: string): Promise<FinancialRecords>
  changeCategory(id: string, action: 'archive' | 'restore' | 'delete'): Promise<FinancialRecords>
  saveMovement(draft: MovementDraft, id?: string): Promise<FinancialRecords>
  removeMovement(id: string): Promise<FinancialRecords>
  classifyExpenses(ids: string[], classification: MicroExpenseClassification): Promise<FinancialRecords>
  saveAccount(draft: AccountFormData, id?: string): Promise<FinancialRecords>
  setAccountStatus(id: string, status: AccountStatus): Promise<FinancialRecords>
  removeAccount(id: string): Promise<FinancialRecords>
  adjustAccount(draft: AdjustmentDraft): Promise<FinancialRecords>
  saveBudget(draft: BudgetFormData, id?: string): Promise<FinancialRecords>
  removeBudget(id: string): Promise<FinancialRecords>
  duplicateBudgets(ids: string[], period: BudgetPeriod): Promise<FinancialRecords>
  saveCommitment(draft: CommitmentFormData, id?: string): Promise<FinancialRecords>
  confirmCommitment(id: string, draft: CommitmentConfirmation): Promise<FinancialRecords>
  cancelCommitment(id: string): Promise<FinancialRecords>
  saveGoal(draft: SavingsGoalFormData, id?: string, initial?: Pick<SavingsContribution, 'accountId' | 'amount'>): Promise<FinancialRecords>
  recordReservation(type: SavingsReservationType, draft: SavingsContribution): Promise<FinancialRecords>
  changeGoalStatus(id: string, action: LifecycleAction): Promise<FinancialRecords>
}

const emptyRecords: FinancialRecords = { accounts: [], movements: [], budgets: [], commitments: [], adjustments: [], savingsGoals: [], reservations: [], usedAccountIds: new Set() }
const wait = () => new Promise<void>(resolve => setTimeout(resolve, 180))

function rememberAccounts(ids: ReadonlySet<string>, item: MovementDraft) {
  const next = new Set(ids)
  next.add(item.accountId)
  if (item.type === 'transferencia') next.add(item.destinationId)
  return next
}

export function createMockFinancialRepository(): FinancialRepository {
  let records: FinancialRecords = {
    ...emptyRecords, accounts, movements: seedMovements, budgets: seedBudgets, commitments: seedCommitments, savingsGoals: seedSavingsGoals, reservations: seedReservations,
    categories: seedCategories, usedCategoryIds: new Set(seedMovements.flatMap(item => item.type === 'transferencia' ? [] : [item.categoryId])),
    usedAccountIds: seedMovements.reduce((ids, item) => rememberAccounts(ids, item), new Set<string>()),
  }

  function findAccount(id: string) {
    const account = records.accounts.find(item => item.id === id)
    if (!account) throw new Error('La cuenta ya no está disponible.')
    return account
  }

  async function update(change: (current: FinancialRecords) => FinancialRecords) {
    await wait()
    refreshFinancialDate()
    records = change(records)
    return records
  }
  const savingsContext = () => ({ today, now: new Date().toISOString(), id: () => crypto.randomUUID() })

  return {
    async list() { await wait(); return records },
    saveCategory: (draft, id) => update(current => saveCategory(current, draft, id ?? crypto.randomUUID(), new Date().toISOString(), Boolean(id))),
    changeCategory: (id, action) => update(current => changeCategory(current, id, action)),
    saveMovement: (draft, id) => update(current => {
      const existing = current.movements.find(item => item.id === id)
      if (id && !existing) throw new Error('El movimiento ya no está disponible.')
      if (existing?.commitmentId && (draft.date !== existing.date || draft.amount !== existing.amount || draft.accountId !== existing.accountId || draft.type !== existing.type)) {
        throw new Error('El movimiento está vinculado a un compromiso confirmado. Conserva su tipo, fecha, monto y cuenta.')
      }
      const error = Object.values(validateMovement(draft, current, id))[0]
      if (error) throw new Error(error)
      const movement = { ...draft, id: id ?? crypto.randomUUID(), ...(existing?.commitmentId ? { commitmentId: existing.commitmentId } : {}) }
      return {
        ...current, usedAccountIds: rememberAccounts(current.usedAccountIds, movement),
        usedCategoryIds: movement.type === 'transferencia' ? current.usedCategoryIds : new Set([...(current.usedCategoryIds ?? []), movement.categoryId]),
        movements: id ? current.movements.map(item => item.id === id ? movement : item) : [movement, ...current.movements],
      }
    }),
    removeMovement: id => update(current => {
      const existing = current.movements.find(item => item.id === id)
      if (!existing) throw new Error('El movimiento ya no está disponible.')
      if (existing.commitmentId) throw new Error('Revisa el compromiso asociado antes de corregir esta operación confirmada.')
      const next = { ...current, movements: current.movements.filter(item => item.id !== id) }
      if (worsensReservation(current, next, existing.date, today)) throw new Error(reservedFundsError)
      return next
    }),
    classifyExpenses: (ids, classification) => update(current => {
      const unique = new Set(ids)
      if (!unique.size || !classificationOptions.some(option => option.id === classification)
          || current.movements.filter(item => unique.has(item.id) && item.type === 'gasto').length !== unique.size) {
        throw new Error('La selección cambió. Vuelve a seleccionar los gastos que quieras clasificar.')
      }
      return { ...current, movements: current.movements.map(item => item.type === 'gasto' && unique.has(item.id) ? { ...item, classification } : item) }
    }),
    saveAccount: (draft, id) => update(current => {
      const existing = id ? findAccount(id) : null
      const form = { ...draft, name: draft.name.trim(), description: draft.description.trim(), initialBalance: existing?.initialBalance ?? draft.initialBalance }
      const error = Object.values(validateAccount(form))[0]
      if (error) throw new Error(error)
      const account: Account = existing ? { ...existing, ...form }
        : { ...form, id: crypto.randomUUID(), status: 'activa', currency: 'CLP', createdAt: new Date().toISOString(), openedOn: today }
      return { ...current, accounts: existing ? current.accounts.map(item => item.id === id ? account : item) : [...current.accounts, account] }
    }),
    setAccountStatus: (id, status) => update(current => {
      const account = findAccount(id)
      if (status === 'archivada' && reservedAt(current, today, id) > 0) throw new Error('Libera las reservas de esta cuenta antes de archivarla.')
      return { ...current, accounts: current.accounts.map(item => item.id === id ? { ...account, status } : item) }
    }),
    removeAccount: id => update(current => {
      const reason = deletionReasons(findAccount(id), current)[0]
      if (reason) throw new Error(reason)
      return { ...current, accounts: current.accounts.filter(item => item.id !== id) }
    }),
    adjustAccount: draft => update(current => {
      const account = findAccount(draft.accountId)
      if (account.status !== 'activa') throw new Error('Reactiva la cuenta para registrar un ajuste.')
      const previousBalance = balanceOn(account, current, draft.date)
      if (previousBalance !== draft.previousBalance) throw new Error('El saldo cambió. Revisa la diferencia y vuelve a confirmar.')
      const error = Object.values(validateAdjustment(draft, account, previousBalance))[0]
      if (error) throw new Error(error)
      return {
        ...current, usedAccountIds: new Set([...current.usedAccountIds, account.id]),
        adjustments: [{
          id: crypto.randomUUID(), accountId: account.id, date: draft.date, reason: draft.reason.trim(), previousBalance,
          actualBalance: draft.actualBalance, difference: draft.actualBalance - previousBalance,
        }, ...current.adjustments],
      }
    }),
    saveBudget: (draft, id) => update(current => {
      const existing = current.budgets.find(item => item.id === id)
      if (id && !existing) throw new Error('El presupuesto ya no está disponible.')
      const expenseIds = filterCategories(readCategories(current), 'gasto', true, existing?.categoryId).map(item => item.id)
      const error = Object.values(validateBudget(draft, current.budgets, expenseIds, today, existing))[0]
      if (error) throw new Error(error)
      const budget = { ...draft, description: draft.description.trim(), id: id ?? crypto.randomUUID() }
      return { ...current, budgets: id ? current.budgets.map(item => item.id === id ? budget : item) : [...current.budgets, budget] }
    }),
    removeBudget: id => update(current => {
      if (!current.budgets.some(item => item.id === id)) throw new Error('El presupuesto ya no está disponible.')
      return { ...current, budgets: current.budgets.filter(item => item.id !== id) }
    }),
    duplicateBudgets: (ids, period) => update(current => {
      if (!parseBudgetPeriod(period) || budgetPhase(period, today) === 'closed') throw new Error('Selecciona el mes actual o uno futuro.')
      const sources = current.budgets.filter(item => ids.includes(item.id))
      if (!sources.length || sources.length !== new Set(ids).size) throw new Error('La planificación de origen cambió. Vuelve a abrir la copia.')
      const active = new Set(filterCategories(readCategories(current), 'gasto', true).map(item => item.id))
      if (sources.some(item => !active.has(item.categoryId))) throw new Error('Reactiva las categorías archivadas antes de crear presupuestos nuevos.')
      const conflict = conflictingBudgets(current.budgets, sources, period)
      if (conflict.length || new Set(sources.map(item => item.categoryId)).size !== sources.length) {
        throw new Error('El período de destino tiene categorías en conflicto.')
      }
      const copies = sources.map(item => ({ ...item, period, id: crypto.randomUUID() }))
      return { ...current, budgets: [...current.budgets, ...copies] }
    }),
    saveCommitment: (draft, id) => update(current => {
      const existing = current.commitments.find(item => item.id === id)
      if (id && (!existing || existing.status !== 'pendiente')) throw new Error('Solo se pueden editar compromisos pendientes.')
      if (existing && existing.type !== draft.type) throw new Error('El tipo de un compromiso existente se conserva.')
      const allowed = filterCategories(readCategories(current), draft.type === 'cobro' ? 'ingreso' : 'gasto', true, existing?.categoryId)
      const errors = validateCommitment(draft, current.accounts, allowed.map(item => item.id), today, maximumMovementAmount, existing)
      const error = Object.values(errors)[0]
      if (error) throw new Error(error)
      const form = { ...draft, name: draft.name.trim(), notes: draft.notes.trim() }
      const commitment: FinancialCommitment = existing
        ? { ...existing, ...form, status: 'pendiente', originalDueDate: existing.originalDueDate ?? (existing.dueDate === draft.dueDate ? undefined : existing.dueDate) }
        : { ...form, id: crypto.randomUUID(), status: 'pendiente', userId: demoProfile.id, currency: 'CLP', createdAt: new Date().toISOString() }
      return { ...current, commitments: id ? current.commitments.map(item => item.id === id ? commitment : item) : [commitment, ...current.commitments] }
    }),
    confirmCommitment: (id, draft) => update(current => confirmCommitment(current, id, draft, today, new Date().toISOString(), () => crypto.randomUUID())),
    cancelCommitment: id => update(current => cancelCommitment(current, id, today, new Date().toISOString())),
    saveGoal: (draft, id, initial) => update(current => saveSavingsGoal(current, draft, savingsContext(), demoProfile.id, id, initial)),
    recordReservation: (type, draft) => update(current => recordReservation(current, type, draft, savingsContext())),
    changeGoalStatus: (id, action) => update(current => changeGoalStatus(current, id, action, savingsContext())),
  }
}

export function useFinancialRecords(repository: FinancialRepository) {
  const [records, setRecords] = useState(emptyRecords)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    void repository.list().then(items => {
      if (active) { setRecords(items); setStatus('ready') }
    }, () => { if (active) setStatus('error') })
    return () => { active = false }
  }, [repository, attempt])

  async function apply(result: Promise<FinancialRecords>) {
    setRecords(await result)
  }

  return {
    records, status,
    saveCategory: (draft: CategoryFormData, id?: string) => apply(repository.saveCategory(draft, id)),
    changeCategory: (id: string, action: 'archive' | 'restore' | 'delete') => apply(repository.changeCategory(id, action)),
    reload() { setStatus('loading'); setAttempt(count => count + 1) },
    saveMovement: (draft: MovementDraft, id?: string) => apply(repository.saveMovement(draft, id)),
    removeMovement: (id: string) => apply(repository.removeMovement(id)),
    classifyExpenses: (ids: string[], classification: MicroExpenseClassification) => apply(repository.classifyExpenses(ids, classification)),
    saveAccount: (draft: AccountFormData, id?: string) => apply(repository.saveAccount(draft, id)),
    setAccountStatus: (id: string, status: AccountStatus) => apply(repository.setAccountStatus(id, status)),
    removeAccount: (id: string) => apply(repository.removeAccount(id)),
    adjustAccount: (draft: AdjustmentDraft) => apply(repository.adjustAccount(draft)),
    saveBudget: (draft: BudgetFormData, id?: string) => apply(repository.saveBudget(draft, id)),
    removeBudget: (id: string) => apply(repository.removeBudget(id)),
    duplicateBudgets: (ids: string[], period: BudgetPeriod) => apply(repository.duplicateBudgets(ids, period)),
    saveCommitment: (draft: CommitmentFormData, id?: string) => apply(repository.saveCommitment(draft, id)),
    confirmCommitment: (id: string, draft: CommitmentConfirmation) => apply(repository.confirmCommitment(id, draft)),
    cancelCommitment: (id: string) => apply(repository.cancelCommitment(id)),
    saveGoal: (draft: SavingsGoalFormData, id?: string, initial?: Pick<SavingsContribution, 'accountId' | 'amount'>) => apply(repository.saveGoal(draft, id, initial)),
    recordReservation: (type: SavingsReservationType, draft: SavingsContribution) => apply(repository.recordReservation(type, draft)),
    changeGoalStatus: (id: string, action: LifecycleAction) => apply(repository.changeGoalStatus(id, action)),
  }
}
