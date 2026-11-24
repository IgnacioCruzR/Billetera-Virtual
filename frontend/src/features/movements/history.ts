import { monthAt, shiftDays, today } from '@/features/dashboard/mock-data'
import { microExpenseLabels, movementTypes, type Account, type MicroExpenseStatus, type Movement, type MovementType } from '@/features/dashboard/model'
import { categories, classificationOf, isIsoDate } from './movement-data'

export const dateOptions = [
  { id: 'today', label: 'Hoy' }, { id: 'week', label: 'Últimos 7 días' },
  { id: 'month', label: 'Este mes' }, { id: 'previous', label: 'Mes anterior' },
  { id: 'year', label: 'Este año' }, { id: 'custom', label: 'Rango personalizado' },
] as const

export type DatePreset = typeof dateOptions[number]['id'] | ''
export type HistorySort = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

export interface TransactionFilters {
  search: string
  type: MovementType | ''
  category: string
  account: string
  preset: DatePreset
  from: string
  to: string
  minimum: string
  maximum: string
  classification: MicroExpenseStatus | ''
}

export const emptyFilters: TransactionFilters = {
  search: '', type: '', category: '', account: '', preset: '', from: '', to: '', minimum: '', maximum: '', classification: '',
}

export function presetRange(preset: DatePreset) {
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'week': return { from: shiftDays(today, -6), to: today }
    case 'month': return { from: `${monthAt(0)}-01`, to: today }
    case 'previous': return { from: `${monthAt(-1)}-01`, to: shiftDays(`${monthAt(0)}-01`, -1) }
    case 'year': return { from: `${today.slice(0, 4)}-01-01`, to: today }
    default: return { from: '', to: '' }
  }
}

export function filterErrors(filters: TransactionFilters) {
  const badAmount = (value: string) => value !== '' && (!Number.isSafeInteger(Number(value)) || Number(value) < 0)
  return {
    dates: (filters.from && !isIsoDate(filters.from)) || (filters.to && !isIsoDate(filters.to))
      || (filters.from && filters.to && filters.from > filters.to) ? 'Comprueba el orden y la validez de las fechas.' : '',
    amounts: badAmount(filters.minimum) || badAmount(filters.maximum)
      || (filters.minimum !== '' && filters.maximum !== '' && Number(filters.minimum) > Number(filters.maximum))
      ? 'Ingresa un rango válido en pesos enteros.' : '',
  }
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('es-CL').trim()
}

export function filterHistory(movements: Movement[], filters: TransactionFilters, detected: ReadonlySet<string>, sort: HistorySort) {
  const search = normalize(filters.search)
  const ordered = movements.filter(item => {
    if (search && !normalize(item.description).includes(search)) return false
    if (filters.type && item.type !== filters.type) return false
    if (filters.category && (item.type === 'transferencia' || item.categoryId !== filters.category)) return false
    if (filters.account && item.accountId !== filters.account && (item.type !== 'transferencia' || item.destinationId !== filters.account)) return false
    if ((filters.from && item.date < filters.from) || (filters.to && item.date > filters.to)) return false
    if ((filters.minimum !== '' && item.amount < Number(filters.minimum)) || (filters.maximum !== '' && item.amount > Number(filters.maximum))) return false
    return !filters.classification || (item.type === 'gasto' && classificationOf(item, detected) === filters.classification)
  })
  switch (sort) {
    case 'date-asc': return ordered.sort((a, b) => a.date.localeCompare(b.date))
    case 'amount-desc': return ordered.sort((a, b) => b.amount - a.amount || b.date.localeCompare(a.date))
    case 'amount-asc': return ordered.sort((a, b) => a.amount - b.amount || b.date.localeCompare(a.date))
    default: return ordered.sort((a, b) => b.date.localeCompare(a.date))
  }
}

export const accountLabel = (accounts: Account[], id: string) => accounts.find(item => item.id === id)?.name ?? 'Cuenta sin nombre'
export const categoryLabel = (item: Movement) => item.type === 'transferencia' ? '' : categories.find(category => category.id === item.categoryId)?.name ?? ''
export const movementTypeLabel = (type: MovementType) => movementTypes.find(item => item.id === type)!.label

function csvField(value: string) {
  const trimmedStart = value.trimStart()
  const safe = /^[=+\-@＝＋－＠]/.test(trimmedStart) ? `\t${trimmedStart}`
    : /^[\t\r\n]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function buildHistoryCsv(items: Movement[], accounts: Account[], detected: ReadonlySet<string>) {
  const headers = ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Cuenta', 'Cuenta de destino', 'Monto', 'Moneda', 'Clasificación de gasto hormiga']
  const rows = items.map(item => [
    item.date, movementTypeLabel(item.type), item.description, categoryLabel(item),
    accountLabel(accounts, item.accountId), item.type === 'transferencia' ? accountLabel(accounts, item.destinationId) : '',
    String(item.amount), 'CLP', item.type === 'gasto' ? microExpenseLabels[classificationOf(item, detected)] : '',
  ])
  return `\uFEFF${[headers, ...rows].map(row => row.map(csvField).join(';')).join('\r\n')}\r\n`
}

export function downloadHistory(items: Movement[], accounts: Account[], detected: ReadonlySet<string>) {
  const blob = new Blob([buildHistoryCsv(items, accounts, detected)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `movimientos-${today}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
