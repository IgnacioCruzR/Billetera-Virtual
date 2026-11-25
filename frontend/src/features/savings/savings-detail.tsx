import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { FinancialRecords } from '@/features/dashboard/model'
import { accountLabel } from '@/features/movements/history'
import { daysBetween } from '@/lib/calendar'
import { cn, formatMoney } from '@/lib/utils'
import { goalActionLabel, goalActions, GoalIcon, GoalProgress, GoalStatus, progressLabel, savingsDate, type SavingsActionHandler } from './savings-cards'
import { GoalEvolutionChart } from './savings-charts'
import type { SavingsGoalHistory, SavingsRecommendation } from './savings-model'
import { accountsWithUpcomingShortfall, habitualContribution, projectSavings } from './savings-planning'

function recommendations(history: SavingsGoalHistory, records: FinancialRecords, today: string, hidden: boolean): SavingsRecommendation[] {
  const { goal, progress, remaining, overdue } = history
  const items: SavingsRecommendation[] = []
  if (remaining === 0 || goal.status === 'finalizada') return [{ kind: 'progress', text: 'Alcanzaste el monto objetivo. El historial muestra cómo se reunió.' }]
  if (goal.status === 'cancelada') return []
  items.push({ kind: 'progress', text: `Llevas ${progressLabel(progress)} del objetivo. Restan ${formatMoney(remaining, hidden)}.` })
  if (overdue) items.push({ kind: 'overdue', text: 'La fecha objetivo pasó. Revisa el plazo en el planificador.' })
  const plan = projectSavings(goal.target, history.reserved, habitualContribution(history, today).amount, today, goal.targetDate)
  if (!overdue && goal.targetDate && daysBetween(today, goal.targetDate) <= 30 && (!plan.estimatedDate || plan.estimatedDate > goal.targetDate)) {
    items.push({ kind: 'plan', text: 'Tu fecha objetivo está cerca y el ritmo actual queda por debajo del plan. Compara un plazo alternativo.' })
  } else if (!overdue && goal.status === 'en-progreso' && plan.estimatedDate) {
    items.push({ kind: 'plan', text: `Mantener este ritmo podría completar la meta el ${savingsDate(plan.estimatedDate)}.` })
  }
  if (accountsWithUpcomingShortfall(records, today).length) items.push({ kind: 'commitments', text: 'Revisa los pagos próximos antes de aportar más dinero.' })
  return items
}

export function SavingsGoalDetail({ history, records, today, hidden, onClose, onCloseAutoFocus, onAction, onPlanner }: {
  history: SavingsGoalHistory; records: FinancialRecords; today: string; hidden: boolean;
  onClose: () => void; onCloseAutoFocus: (event: Event) => void; onAction: SavingsActionHandler; onPlanner: () => void;
}) {
  const { goal, reserved, remaining, operations, byAccount } = history
  const closed = goal.status === 'finalizada' || goal.status === 'cancelada'
  const habitual = habitualContribution(history, today)
  const forecast = goal.status === 'en-progreso' ? projectSavings(goal.target, reserved, habitual.amount, today, goal.targetDate) : null
  const metrics = [
    ['Monto objetivo', formatMoney(goal.target, hidden)], ['Dinero reservado', formatMoney(reserved, hidden)],
    ['Monto restante', closed ? 'Meta cerrada' : formatMoney(remaining, hidden)], ['Fecha de creación', savingsDate(goal.createdOn)],
    ['Fecha objetivo', goal.targetDate ? savingsDate(goal.targetDate) : 'Sin fecha objetivo'],
    ['Fecha de cumplimiento', goal.reachedOn ? savingsDate(goal.reachedOn) : 'Pendiente'],
    ['Aporte mensual planificado', goal.monthlyPlan === null ? 'Sin plan' : formatMoney(goal.monthlyPlan, hidden)],
    ['Cumplimiento estimado', forecast?.estimatedDate ? savingsDate(forecast.estimatedDate) : goal.reachedOn ? 'Alcanzada' : 'Estimación no disponible'],
  ]
  const advice = recommendations(history, records, today, hidden)
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent onCloseAutoFocus={onCloseAutoFocus} className="h-dvh max-h-none w-full max-w-4xl rounded-none border-y-0 border-r-0" style={{ top: 0, left: 'auto', right: 0, translate: 'none' }}>
    <div className="flex items-center gap-3 pr-7"><GoalIcon icon={goal.icon} color={goal.color} /><div className="min-w-0"><DialogTitle className="text-xl font-bold wrap-anywhere">{goal.name}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Detalle de la meta de ahorro</DialogDescription></div></div>
    {goal.description && <p className="mt-3 text-sm text-muted-foreground wrap-anywhere">{goal.description}</p>}
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><GoalStatus status={goal.status} overdue={history.overdue} /><span className="text-sm font-semibold">{goal.status === 'finalizada' ? '100 % al cierre' : progressLabel(history.progress)}</span></div>
    <div className="mt-2"><GoalProgress value={goal.status === 'finalizada' ? 100 : history.progress} color={goal.color} label="Progreso de la meta" /></div>
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{metrics.map(([label, value]) => <div className="min-w-0 rounded-lg border border-border p-2" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-semibold wrap-anywhere tabular-nums">{value}</dd></div>)}</dl>
    {!closed && <div className="mt-4 flex flex-wrap gap-2">
      {goalActions(history).filter(action => action !== 'detail').map(action => <Button key={action} variant={action === 'aporte' ? 'default' : 'outline'} size="sm" onClick={event => onAction(action, history, event.currentTarget)}>{goalActionLabel(action)}</Button>)}
      <Button variant="ghost" size="sm" onClick={onPlanner}>Abrir planificador</Button>
    </div>}
    <GoalEvolutionChart history={history} today={today} monthly={habitual.amount} months={forecast?.months ?? null} hidden={hidden} />
    {advice.length > 0 && <section className="mt-4 rounded-xl border border-border p-3" aria-label="Recomendaciones para la meta"><h3 className="font-bold">Recomendaciones para la meta</h3><ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{advice.map(item => <li key={item.kind}>{item.text} {item.kind === 'commitments' && <a href="#compromisos" onClick={onClose} className="font-semibold text-indigo-200 hover:underline">Ver cobros y pagos</a>}</li>)}</ul></section>}
    <section className="mt-4 rounded-xl border border-border p-3" aria-label="Cuentas asociadas">
      <h3 className="font-bold">Cuentas asociadas</h3>
      {byAccount.size ? <ul className="mt-1 divide-y divide-border">{[...byAccount].map(([id, amount]) => <li key={id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
        {records.accounts.some(account => account.id === id) ? <a href={`#cuentas?cuenta=${encodeURIComponent(id)}`} onClick={onClose} className="font-semibold text-indigo-200 hover:underline">{accountLabel(records.accounts, id)}</a> : <span>{accountLabel(records.accounts, id)}</span>}
        <span className="tabular-nums">{formatMoney(amount, hidden)} reservados</span>
      </li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">La meta aún no tiene reservas asociadas.</p>}
    </section>
    <section className="mt-4 rounded-xl border border-border p-3" aria-label="Historial de reservas">
      <h3 className="font-bold">Historial de reservas</h3>
      {operations.length ? <ul className="mt-1 divide-y divide-border">{[...operations].reverse().map(item => <li key={item.id} className="flex items-start justify-between gap-2 py-2 text-sm">
        <div className="min-w-0"><p className="font-semibold">{item.type === 'aporte' ? 'Aporte' : 'Liberación'} · {accountLabel(records.accounts, item.accountId)}</p><p className="text-xs text-muted-foreground">{savingsDate(item.date)}</p>{item.description && <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">{item.description}</p>}</div>
        <span className={cn('shrink-0 font-semibold tabular-nums', item.type === 'aporte' ? 'text-indigo-200' : 'text-amber-200')}>{hidden ? '' : item.type === 'aporte' ? '+' : '−'}{formatMoney(item.amount, hidden)}</span>
      </li>)}</ul> : <p className="mt-1 text-sm text-muted-foreground">Aún no hay operaciones para esta meta.</p>}
    </section>
  </DialogContent></Dialog>
}
