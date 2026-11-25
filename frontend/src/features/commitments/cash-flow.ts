import { daysBetween, shiftDays } from '../../lib/calendar.ts'
import type { CashFlowDataPoint, CashFlowItem, CashFlowProjection, CashFlowScenario, CommitmentFilters, CommitmentSort, CommitmentSummary, CommitmentVisualStatus, FinancialCommitment, FinancialRisk, ProjectionHorizon } from './commitment-model.ts'

export const UPCOMING_DAYS = 5
export const NOTIFICATION_DAYS = 3
export const DEFAULT_HORIZON = 30

export function visualStatus(item: FinancialCommitment, today: string): CommitmentVisualStatus {
  if (item.status !== 'pendiente') return item.status
  if (item.dueDate < today) return 'vencido'
  return daysBetween(today, item.dueDate) <= UPCOMING_DAYS ? 'por-vencer' : 'pendiente'
}

export function overdueOrDueFirst(items: FinancialCommitment[]) {
  return [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name, 'es'))
}

export function pendingItems(commitments: FinancialCommitment[]) {
  return overdueOrDueFirst(commitments.filter(item => item.status === 'pendiente'))
}

export function projectCashFlow(items: CashFlowItem[], balance: number, today: string, horizon: ProjectionHorizon, reserve: number | null): CashFlowProjection {
  const endDate = shiftDays(today, horizon)
  const byDate = new Map<string, CashFlowItem[]>()
  for (const item of items) {
    if (item.dueDate > endDate) continue
    const date = item.dueDate < today ? today : item.dueDate
    const entries = byDate.get(date) ?? []
    entries.push(item)
    byDate.set(date, entries)
  }
  let current = balance
  let minimumBalance = balance
  let minimumDate = today
  let firstDeficit = balance < 0 ? today : null
  const points: CashFlowDataPoint[] = []
  for (let offset = 0; offset <= horizon; offset++) {
    const date = shiftDays(today, offset)
    const entries = byDate.get(date) ?? []
    let receipts = 0
    let payments = 0
    for (const item of entries) {
      if (item.type === 'cobro') receipts += item.amount
      else payments += item.amount
    }
    current += receipts - payments
    if (current < minimumBalance) { minimumBalance = current; minimumDate = date }
    if (current < 0 && firstDeficit === null) firstDeficit = date
    points.push({ date, balance: current, receipts, payments, items: entries })
  }
  return { startingBalance: balance, endDate, finalBalance: current, minimumBalance, minimumDate, firstDeficit, reserve, margin: reserve === null ? null : current - reserve, points }
}

export function summarizeCommitments(pending: FinancialCommitment[], projection: CashFlowProjection, today: string): CommitmentSummary {
  return {
    receipts: projection.points.reduce((total, point) => total + point.receipts, 0),
    payments: projection.points.reduce((total, point) => total + point.payments, 0),
    pendingCount: pending.length,
    overdueCount: pending.filter(item => item.dueDate < today).length,
    next: pending.find(item => item.dueDate >= today) ?? null,
  }
}

export function deficitPeriods(projection: CashFlowProjection) {
  const periods: { from: string; to: string }[] = []
  for (const point of projection.points) {
    const initialDeficit = point.date === projection.points[0].date && projection.startingBalance < 0
    if (point.balance >= 0 && !initialDeficit) continue
    const previous = periods.at(-1)
    if (previous && daysBetween(previous.to, point.date) === 1) previous.to = point.date
    else periods.push({ from: point.date, to: point.date })
  }
  return periods
}

export function scenarioItems(pending: CashFlowItem[], scenario: CashFlowScenario): CashFlowItem[] {
  return [...pending.flatMap(item => {
    const change = scenario.changes[item.id]
    if (!change) return [item]
    return change.excluded && item.type === 'cobro' ? [] : [{ ...item, dueDate: change.dueDate, amount: change.amount }]
  }), ...scenario.hypothetical]
}

export function findRisks(projection: CashFlowProjection, today: string): FinancialRisk[] {
  const risks: FinancialRisk[] = []
  const entries = projection.points.flatMap(point => point.items)
  const due = entries.filter(item => item.type === 'pago' && item.dueDate >= today && daysBetween(today, item.dueDate) <= UPCOMING_DAYS)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (due) risks.push({ id: 'due', date: due.dueDate, amount: due.amount })
  const overdue = entries.filter(item => item.dueDate < today).length
  if (overdue) risks.push({ id: 'overdue', date: today, count: overdue })
  const firstReceipt = projection.points.find(point => point.receipts > 0)
  const firstPayment = projection.points.find(point => point.payments > 0)
  if (firstReceipt && firstPayment && firstPayment.date < firstReceipt.date) risks.push({ id: 'before-receipts', date: firstPayment.date })
  if (projection.firstDeficit) risks.push({ id: 'deficit', date: projection.firstDeficit, amount: projection.minimumBalance })
  const depleted = projection.startingBalance === 0 ? today : projection.points.find(point => point.balance === 0)?.date
  if (depleted) risks.push({ id: 'depleted', date: depleted })
  const concentration = projection.points.map(point => ({ point, count: point.items.filter(item => item.type === 'pago').length }))
    .filter(item => item.count >= 2).sort((a, b) => b.count - a.count || b.point.payments - a.point.payments)[0]
  if (concentration) risks.push({ id: 'concentration', date: concentration.point.date, count: concentration.count, amount: concentration.point.payments })
  if (projection.reserve !== null && projection.reserve > 0) {
    const reserve = projection.reserve
    const low = projection.startingBalance < reserve ? today : projection.points.find(point => point.balance < reserve)?.date
    if (low) risks.push({ id: 'reserve', date: low, amount: reserve })
  }
  return risks
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim()

export function filterCommitments(items: FinancialCommitment[], filters: CommitmentFilters, sort: CommitmentSort, today: string) {
  const query = normalize(filters.search)
  const result = overdueOrDueFirst(items.filter(item => {
    if (filters.type && item.type !== filters.type) return false
    if (filters.status === 'vencido' ? visualStatus(item, today) !== 'vencido' : filters.status && item.status !== filters.status) return false
    return (!filters.accountId || item.accountId === filters.accountId) && (!filters.categoryId || item.categoryId === filters.categoryId)
      && (!filters.from || item.dueDate >= filters.from) && (!filters.to || item.dueDate <= filters.to)
      && (!query || normalize(`${item.name} ${item.notes}`).includes(query))
  }))
  if (sort === 'fecha') return result
  if (sort === 'monto') return result.sort((a, b) => b.amount - a.amount)
  if (sort === 'estado') {
    const order: CommitmentVisualStatus[] = ['vencido', 'por-vencer', 'pendiente', 'confirmado', 'cancelado']
    return result.sort((a, b) => order.indexOf(visualStatus(a, today)) - order.indexOf(visualStatus(b, today)))
  }
  return result.sort((a, b) => Number(b.status === 'pendiente') - Number(a.status === 'pendiente'))
}

export function calendarDays(month: string, days: number) {
  const first = `${month}-01`
  const offset = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1
    return day >= 1 && day <= days ? shiftDays(first, day - 1) : null
  })
}
