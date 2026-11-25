import { dateInZone, daysBetween } from '@/lib/calendar'
import { readCategories } from '@/features/categories/category-model'
import { budgetAlert, budgetAlertMessage } from '@/features/budgets/budget-calculations'
import { compactDate } from '@/features/commitments/commitment-list'
import { reservedAt } from '@/features/savings/savings-ledger'
import type { FinancialRecords } from './model'
import type { AppNotification } from './navigation'
import type { DashboardSnapshot } from './use-dashboard'
import type { HealthDataState } from '@/features/health/health-data'
import { notificationsFor, type NotificationPreferences } from '@/features/settings/preferences-model'

export function demoNotifications(records: FinancialRecords, snapshot: DashboardSnapshot, health: HealthDataState, asOf: string, timeZone: string, options: NotificationPreferences) {
  const reminders = records.commitments.flatMap((item): AppNotification[] => {
    const section = 'compromisos'
    if (item.status === 'cancelado') return []
    if (item.status === 'confirmado') {
      if (daysBetween(dateInZone(new Date(item.confirmedAt), timeZone), asOf) > 3) return []
      return [{ id: item.id + '-confirmed', kind: 'confirmation', title: item.type === 'cobro' ? 'Cobro confirmado' : 'Pago confirmado',
        detail: item.name + ' quedó registrado el ' + compactDate(item.effectiveDate) + '.', privateDetail: 'Registrado el ' + compactDate(item.effectiveDate) + '.', section }]
    }
    const days = daysBetween(asOf, item.dueDate)
    if (days > options.daysAhead) return []
    return [{ id: [item.id, days < 0 ? 'overdue' : 'due', item.dueDate].join('-'), kind: days < 0 ? 'overdue' : 'due',
      title: days < 0 ? 'Compromiso vencido' : 'Vencimiento cercano', detail: item.name + ' · ' + compactDate(item.dueDate), privateDetail: compactDate(item.dueDate), section }]
  })
  const firstDeficit = snapshot.projection.firstDeficit
  const freeDeficit = health.status === 'ready' ? health.report.indicators.cashFlow?.firstDeficit : null
  const deficit = firstDeficit || freeDeficit
  if (deficit) reminders.push({ id: (firstDeficit ? 'deficit-' : 'health-free-deficit-') + deficit, kind: 'cashRisk',
    title: firstDeficit ? 'Riesgo de saldo insuficiente' : 'Posible déficit de dinero libre', detail: 'Revisa los compromisos del ' + compactDate(deficit) + '.', section: 'compromisos' })
  const savings = records.savingsGoals.flatMap((goal): AppNotification[] => {
    const section = 'metas'
    if (goal.status === 'alcanzada' || goal.status === 'finalizada') return [{ id: 'reached-' + goal.id + '-' + goal.reachedOn, kind: 'goalReached', title: 'Meta alcanzada', detail: goal.name, privateDetail: 'Consulta tus metas de ahorro.', section }]
    if (goal.status === 'cancelada') return []
    const result: AppNotification[] = []
    if (goal.targetDate) {
      const days = daysBetween(asOf, goal.targetDate)
      if (days <= 7) result.push({ id: ['goal', days < 0 ? 'overdue' : 'due', goal.id, goal.targetDate].join('-'), kind: 'goalDue',
        title: days < 0 ? 'Meta atrasada' : 'Fecha objetivo cercana', detail: goal.name + ' · ' + compactDate(goal.targetDate), privateDetail: compactDate(goal.targetDate), section })
    }
    const milestone = Math.floor((reservedAt(records, asOf, undefined, goal.id) / goal.target) * 4) * 25
    if (milestone > 0) result.push({ id: 'milestone-' + goal.id + '-' + milestone, kind: 'goalMilestone', title: 'Hito de ahorro · ' + milestone + ' %', detail: goal.name, privateDetail: 'Consulta el progreso de tus metas.', section })
    return result
  })
  const categories = readCategories(records)
  const budgets = snapshot.budgets.flatMap((budget): AppNotification[] => {
    const kind = budgetAlert(budget.used, budget)
    if (!kind) return []
    return [{ id: [budget.id, kind, kind === 'threshold' ? budget.warningThreshold : ''].join('-'), kind: kind === 'exceeded' ? 'budgetExceeded' : 'budgetWarning',
      title: 'Presupuesto de ' + (categories.find(item => item.id === budget.categoryId)?.name ?? budget.categoryId), privateTitle: 'Aviso presupuestario',
      detail: budgetAlertMessage(kind, budget.warningThreshold), section: 'presupuestos' }]
  })
  return notificationsFor([...budgets, ...reminders, ...savings], options)
}
