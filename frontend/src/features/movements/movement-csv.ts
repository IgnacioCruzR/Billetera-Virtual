import { buildCsv } from '../../lib/csv.ts'
import type { CategoryDisplay } from '../categories/category-model.ts'
import type { Account, Movement } from '../dashboard/model.ts'
import { classificationOf } from '../micro-expenses/micro-expense-detection.ts'
import { classificationLabels } from '../micro-expenses/micro-expense-model.ts'

export const accountLabel = (accounts: Account[], id: string) => accounts.find(item => item.id === id)?.name ?? 'Cuenta sin nombre'
export const categoryLabel = (item: Movement, categories: CategoryDisplay[]) => item.type === 'transferencia' ? '' : categories.find(category => category.id === item.categoryId)?.name ?? ''
export const movementTypeLabel = (type: Movement['type']) => ({ gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia' })[type]

export function buildHistoryCsv(items: Movement[], accounts: Account[], detected: ReadonlySet<string>, categories: CategoryDisplay[]) {
  const headers = ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Cuenta', 'Cuenta de destino', 'Monto', 'Moneda', 'Clasificación de gasto hormiga']
  const rows = items.map(item => [
    item.date, movementTypeLabel(item.type), item.description, categoryLabel(item, categories),
    accountLabel(accounts, item.accountId), item.type === 'transferencia' ? accountLabel(accounts, item.destinationId) : '',
    item.amount, 'CLP', item.type === 'gasto' ? classificationLabels[classificationOf(item, detected)] : '',
  ])
  return buildCsv(headers, rows)
}
