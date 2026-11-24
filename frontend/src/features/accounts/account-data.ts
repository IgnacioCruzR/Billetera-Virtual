import { useEffect, useState } from 'react'
import { accounts, commitments, expenseCategories, goals, reservedForAccount, seedBudgets, seedMovements, today } from '@/features/dashboard/mock-data'
import { budgetPhase, conflictingBudgets, parseBudgetPeriod, validateBudget } from '@/features/budgets/budget-calculations'
import type { BudgetFormData, BudgetPeriod } from '@/features/budgets/budget-model'
import { accountTypes, type Account, type AccountFormData, type AccountStatus, type FinancialRecords, type MovementDraft } from '@/features/dashboard/model'
import { isIsoDate, maximumMovementAmount, validateMovement } from '@/features/movements/movement-data'
import { balanceOn } from './account-balances'

export const accountTypeLabel = (type: Account['type']) => accountTypes.find(item => item.id === type)!.label
export const totalReserved = goals.length ? goals.reduce((sum, goal) => sum + goal.saved, 0) : null

export function accountReferences(id: string) {
  return {
    reserved: reservedForAccount(id),
    commitments: commitments.filter(item => item.accountId === id).length,
  }
}

export function deletionReasons(account: Account, records: FinancialRecords) {
  const references = accountReferences(account.id)
  return [
    balanceOn(account, records, today) !== 0 && 'Debe tener saldo de $0.',
    records.usedAccountIds.has(account.id) && 'Tiene movimientos, transferencias o ajustes registrados en su historial.',
    references.reserved > 0 && 'Tiene fondos reservados para metas de ahorro.',
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
  saveMovement(draft: MovementDraft, id?: string): Promise<FinancialRecords>
  removeMovement(id: string): Promise<FinancialRecords>
  saveAccount(draft: AccountFormData, id?: string): Promise<FinancialRecords>
  setAccountStatus(id: string, status: AccountStatus): Promise<FinancialRecords>
  removeAccount(id: string): Promise<FinancialRecords>
  adjustAccount(draft: AdjustmentDraft): Promise<FinancialRecords>
  saveBudget(draft: BudgetFormData, id?: string): Promise<FinancialRecords>
  removeBudget(id: string): Promise<FinancialRecords>
  duplicateBudgets(ids: string[], period: BudgetPeriod): Promise<FinancialRecords>
}

const emptyRecords: FinancialRecords = { accounts: [], movements: [], budgets: [], adjustments: [], usedAccountIds: new Set() }
const expenseIds = expenseCategories.map(category => category.id)
const wait = () => new Promise<void>(resolve => setTimeout(resolve, 180))

function rememberAccounts(ids: ReadonlySet<string>, item: MovementDraft) {
  const next = new Set(ids)
  next.add(item.accountId)
  if (item.type === 'transferencia') next.add(item.destinationId)
  return next
}

const mockRepository: FinancialRepository = (() => {
  let records: FinancialRecords = {
    ...emptyRecords, accounts, movements: seedMovements, budgets: seedBudgets,
    usedAccountIds: seedMovements.reduce((ids, item) => rememberAccounts(ids, item), new Set<string>()),
  }

  function findAccount(id: string) {
    const account = records.accounts.find(item => item.id === id)
    if (!account) throw new Error('La cuenta ya no está disponible.')
    return account
  }

  async function update(change: (current: FinancialRecords) => FinancialRecords) {
    await wait()
    records = change(records)
    return records
  }

  return {
    async list() { await wait(); return records },
    saveMovement: (draft, id) => update(current => {
      if (id && !current.movements.some(item => item.id === id)) throw new Error('El movimiento ya no está disponible.')
      const error = Object.values(validateMovement(draft, current, id))[0]
      if (error) throw new Error(error)
      const movement = { ...draft, id: id ?? crypto.randomUUID() }
      return {
        ...current, usedAccountIds: rememberAccounts(current.usedAccountIds, movement),
        movements: id ? current.movements.map(item => item.id === id ? movement : item) : [movement, ...current.movements],
      }
    }),
    removeMovement: id => update(current => {
      if (!current.movements.some(item => item.id === id)) throw new Error('El movimiento ya no está disponible.')
      return { ...current, movements: current.movements.filter(item => item.id !== id) }
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
      const conflict = conflictingBudgets(current.budgets, sources, period)
      if (conflict.length || new Set(sources.map(item => item.categoryId)).size !== sources.length) {
        throw new Error('El período de destino tiene categorías en conflicto.')
      }
      const copies = sources.map(item => ({ ...item, period, id: crypto.randomUUID() }))
      return { ...current, budgets: [...current.budgets, ...copies] }
    }),
  }
})()

export function useFinancialRecords(repository = mockRepository) {
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
    reload() { setStatus('loading'); setAttempt(count => count + 1) },
    saveMovement: (draft: MovementDraft, id?: string) => apply(repository.saveMovement(draft, id)),
    removeMovement: (id: string) => apply(repository.removeMovement(id)),
    saveAccount: (draft: AccountFormData, id?: string) => apply(repository.saveAccount(draft, id)),
    setAccountStatus: (id: string, status: AccountStatus) => apply(repository.setAccountStatus(id, status)),
    removeAccount: (id: string) => apply(repository.removeAccount(id)),
    adjustAccount: (draft: AdjustmentDraft) => apply(repository.adjustAccount(draft)),
    saveBudget: (draft: BudgetFormData, id?: string) => apply(repository.saveBudget(draft, id)),
    removeBudget: (id: string) => apply(repository.removeBudget(id)),
    duplicateBudgets: (ids: string[], period: BudgetPeriod) => apply(repository.duplicateBudgets(ids, period)),
  }
}
