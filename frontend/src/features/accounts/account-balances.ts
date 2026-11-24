import type { Account, FinancialRecords, Movement } from '@/features/dashboard/model'

export function involvesAccount(item: Movement, id: string) {
  return item.accountId === id || (item.type === 'transferencia' && item.destinationId === id)
}

export function accountEffect(item: Movement, id: string) {
  if (item.type === 'transferencia' && item.destinationId === id) return item.amount
  if (item.accountId !== id) return 0
  return item.type === 'ingreso' ? item.amount : -item.amount
}

export function balanceOn(account: Account, records: Pick<FinancialRecords, 'movements' | 'adjustments'>, date: string, excludingId?: string) {
  if (date < account.openedOn) return 0
  const movements = records.movements.reduce((sum, item) => (
    item.id !== excludingId && item.date <= date ? sum + accountEffect(item, account.id) : sum
  ), 0)
  const adjustments = records.adjustments.reduce((sum, item) => (
    item.accountId === account.id && item.date <= date ? sum + item.difference : sum
  ), 0)
  return account.initialBalance + movements + adjustments
}

export function registeredBalance(records: FinancialRecords, date: string) {
  return records.accounts.reduce((sum, account) => sum + balanceOn(account, records, date), 0)
}

export function accountActivity(id: string, movements: Movement[], from: string, to: string) {
  const activity = { income: 0, expense: 0, received: 0, sent: 0 }
  for (const item of movements) {
    if (item.date < from || item.date > to) continue
    if (item.type === 'transferencia' && item.destinationId === id) activity.received += item.amount
    if (item.accountId !== id) continue
    if (item.type === 'ingreso') activity.income += item.amount
    else if (item.type === 'gasto') activity.expense += item.amount
    else activity.sent += item.amount
  }
  return activity
}

export interface AccountSummary {
  registered: number
  activeBalance: number
  reserved: number | null
  available: number | null
  activeCount: number
}

export type AccountWithBalance = Account & { balance: number }

export function summarizeAccounts(accounts: AccountWithBalance[], reserved: number | null): AccountSummary {
  const active = accounts.filter(item => item.status === 'activa')
  const registered = accounts.reduce((sum, item) => sum + item.balance, 0)
  return {
    registered, activeBalance: active.reduce((sum, item) => sum + item.balance, 0), activeCount: active.length,
    reserved, available: reserved === null ? null : registered - reserved,
  }
}
