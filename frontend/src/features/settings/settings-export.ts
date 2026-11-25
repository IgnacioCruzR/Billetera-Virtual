import { buildCsv, type CsvValue } from '../../lib/csv.ts'
import { readCategories } from '../categories/category-model.ts'
import { balanceOn } from '../accounts/account-balances.ts'
import { accountLabel, buildHistoryCsv } from '../movements/movement-csv.ts'
import { reservedAt } from '../savings/savings-ledger.ts'
import type { FinancialRecords } from '../dashboard/model.ts'
import { validateExport, type DataExportRequest } from './preferences-model.ts'

export function prepareExport(input: DataExportRequest, records: FinancialRecords, detected: ReadonlySet<string>, today: string) {
  const error = validateExport(input, today)
  if (error) throw new Error(error)
  const filename = 'billetera-demo-' + input.type + '-' + today + '.csv'
  const categories = readCategories(records)
  const category = (id: string) => categories.find(item => item.id === id)?.name ?? id
  const account = (id: string) => accountLabel(records.accounts, id)
  const within = (date: string) => date >= input.from && date <= input.to
  const result = (header: string[], rows: CsvValue[][]) => ({ filename, rows: rows.length, csv: buildCsv(header, rows) })
  switch (input.type) {
    case 'movements': {
      const items = records.movements.filter(item => within(item.date)).sort((a, b) => b.date.localeCompare(a.date))
      return { filename, rows: items.length, csv: buildHistoryCsv(items, records.accounts, detected, categories) }
    }
    case 'accounts': return result(['Nombre', 'Tipo', 'Estado', 'Apertura', 'Saldo registrado', 'Reservado', 'Moneda'],
      records.accounts.map(item => [item.name, item.type, item.status, item.openedOn, balanceOn(item, records, today), reservedAt(records, today, item.id), 'CLP']))
    case 'categories': return result(['Nombre', 'Tipo', 'Estado', 'Icono', 'Color', 'Descripción'],
      categories.map(item => [item.name, item.type, item.status, item.icon, item.color, item.description]))
    case 'budgets': return result(['Mes', 'Categoría', 'Límite', 'Umbral (%)', 'Descripción', 'Moneda'],
      records.budgets.filter(item => item.period >= input.from.slice(0, 7) && item.period <= input.to.slice(0, 7))
        .map(item => [item.period, category(item.categoryId), item.limit, item.warningThreshold, item.description, 'CLP']))
    case 'commitments': return result(['Nombre', 'Tipo', 'Vencimiento', 'Estado', 'Cuenta', 'Categoría', 'Monto', 'Moneda'],
      records.commitments.filter(item => within(item.dueDate))
        .map(item => [item.name, item.type, item.dueDate, item.status, account(item.accountId), category(item.categoryId), item.amount, 'CLP']))
    case 'savings': return result(['Tipo de registro', 'Meta', 'Fecha', 'Estado de meta', 'Cuenta', 'Monto objetivo', 'Monto de la operación', 'Moneda'],
      [...records.savingsGoals.filter(item => within(item.createdOn)).map(item => ['Meta', item.name, item.createdOn, item.status, '', item.target, '', 'CLP']),
        ...records.reservations.filter(item => within(item.date)).map(item => [item.type, records.savingsGoals.find(goal => goal.id === item.goalId)?.name ?? 'Meta',
          item.date, '', account(item.accountId), '', item.amount, 'CLP'])])
  }
}
