import { useCategoryName } from '@/features/categories/category-context'
import { Activity, CircleAlert, ListChecks, Plus, ReceiptText, Target, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/utils'
import { budgetAlert, budgetAlertMessage, budgetStatus, daysInBudgetPeriod, type BudgetView } from './budget-calculations'
import { BudgetCategoryIcon, BudgetProgress, percentageLabel } from './budget-cards'
import type { BudgetHistory, BudgetPeriod, BudgetPhase, BudgetSummary } from './budget-model'

export function BudgetSummaryCards({ summary, hidden }: { summary: BudgetSummary; hidden: boolean }) {
  const metrics = [
    { label: 'Presupuesto total', value: formatMoney(summary.limit, hidden), icon: Target, tone: 'bg-primary/12 text-emerald-300' },
    { label: 'Total consumido', value: formatMoney(summary.spent, hidden), icon: ReceiptText, tone: 'bg-budget-time/12 text-blue-300' },
    { label: 'Margen restante', value: formatMoney(summary.remaining, hidden), icon: Wallet, tone: summary.remaining < 0 ? 'bg-danger/12 text-red-300' : 'bg-primary/12 text-emerald-300' },
    { label: 'Presupuestos excedidos', value: String(summary.exceededCount), icon: CircleAlert, tone: summary.exceededCount ? 'bg-danger/12 text-red-300' : 'bg-secondary text-muted-foreground' },
  ]
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen presupuestario">
      {metrics.map(({ label, value, icon: Icon, tone }) => (
        <article className="panel flex min-w-0 items-center gap-3 p-3.5 sm:items-start sm:p-4" key={label}>
          <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="size-[18px]" aria-hidden="true" /></span>
          <div className="min-w-0"><h2 className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">{label}</h2><p className="mt-1 text-[clamp(1.25rem,2.1vw,1.7rem)] leading-tight font-bold tracking-tight tabular-nums wrap-anywhere">{value}</p></div>
        </article>
      ))}
    </section>
  )
}

export function BudgetPace({ summary, period, phase, today, hidden }: { summary: BudgetSummary; period: BudgetPeriod; phase: BudgetPhase; today: string; hidden: boolean }) {
  const days = daysInBudgetPeriod(period)
  const elapsed = phase === 'closed' ? days : phase === 'future' ? 0 : Number(today.slice(8))
  const time = elapsed / days * 100
  const usage = summary.limit ? summary.spent / summary.limit * 100 : 0
  const message = !summary.limit ? 'Define límites por categoría para empezar a comparar el gasto.'
    : phase === 'future' ? 'La planificación está lista para el inicio del mes.'
      : summary.spent > summary.limit ? 'El gasto presupuestado superó el límite total.'
        : summary.spent === summary.limit ? 'El gasto presupuestado alcanzó el límite total.'
          : phase === 'closed' ? 'El gasto del mes quedó dentro del límite total.'
            : usage > time ? 'El consumo avanza más rápido que el mes.' : 'El consumo total acompaña el ritmo del mes.'
  return (
    <section className="panel grid items-center gap-4 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6" aria-label="Ritmo presupuestario del mes">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Activity className="size-4 text-primary" aria-hidden="true" /> Ritmo del mes</h2>
          <span className="text-xs text-blue-300 tabular-nums">{phase === 'closed' ? 'Mes cerrado' : phase === 'future' ? 'Mes futuro' : `${elapsed} de ${days} días`}</span>
        </div>
        <div className="mt-2.5"><BudgetProgress label="Consumo total del presupuesto" status={summary.limit ? budgetStatus(summary.spent, summary.limit) : 'within'} value={usage} time={time} /></div>
        <div className="mt-2 flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span>{percentageLabel(usage)} consumido</span><span className="text-blue-300">{percentageLabel(time)} del mes transcurrido</span></div>
        <p className="mt-2 text-xs text-muted-foreground">{message}</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/60 p-3">
        <div><dt className="text-xs text-muted-foreground">Gasto total</dt><dd className="mt-1 text-sm font-bold tabular-nums wrap-anywhere">{formatMoney(summary.totalExpense, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Gasto sin presupuesto</dt><dd className="mt-1 text-sm font-bold text-amber-200 tabular-nums wrap-anywhere">{formatMoney(summary.unbudgetedSpent, hidden)}</dd></div>
      </dl>
    </section>
  )
}

export function UnbudgetedExpenses({ summary, hidden, onCreate }: { summary: BudgetSummary; hidden: boolean; onCreate: (category: string, trigger: HTMLElement) => void }) {
  const categoryName = useCategoryName()
  return (
    <section className="panel p-4 sm:p-5" aria-label="Gastos sin presupuesto">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><ListChecks className="size-[18px] text-primary" aria-hidden="true" /> Gastos sin presupuesto</h2>
      <p className="mt-1 text-xs text-muted-foreground">Participación de estas categorías en el gasto total del mes.</p>
      {summary.unbudgeted.length ? <ul className="mt-3 divide-y divide-border">{summary.unbudgeted.map(item => (
        <li key={item.categoryId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="flex items-center gap-2.5"><BudgetCategoryIcon categoryId={item.categoryId} /><div><p className="text-sm font-semibold">{categoryName(item.categoryId)}</p><p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatMoney(item.spent, hidden)} · {percentageLabel(item.share)} del total</p></div></div>
          <Button size="sm" variant="outline" aria-label={`Crear presupuesto de ${categoryName(item.categoryId)}`} onClick={event => onCreate(item.categoryId, event.currentTarget)}><Plus aria-hidden="true" /> Planificar</Button>
        </li>
      ))}</ul> : <p className="mt-4 rounded-lg border border-border bg-secondary/55 p-3 text-sm text-muted-foreground">{summary.totalExpense ? 'Todos los gastos del mes tienen una categoría presupuestada.' : 'El período aún no registra gastos efectivos.'}</p>}
    </section>
  )
}

export function BudgetRecommendations({ budgets, summary, history }: { budgets: BudgetView[]; summary: BudgetSummary; history: BudgetHistory[] }) {
  const categoryName = useCategoryName()
  const urgent = budgets.filter(item => item.status === 'exceeded' || item.projection.risk === 'projected-excess')
    .sort((a, b) => b.percentage - a.percentage).slice(0, 2)
  const next = budgets.find(item => item.status === 'near' && !urgent.includes(item))
  const prior = history.at(-2)
  const messages = urgent.map(item => item.status === 'exceeded'
    ? `${categoryName(item.categoryId)} superó el límite. Revisa sus gastos registrados antes de sumar otro.`
    : `Al ritmo actual podrías exceder ${categoryName(item.categoryId)}. Consulta el margen diario en el detalle.`)
  if (next) messages.push(`${categoryName(next.categoryId)} está cerca del límite. Revisa cuánto queda antes de planificar otro gasto.`)
  if (summary.unbudgeted.length) messages.push(`Tienes gastos sin planificación en ${summary.unbudgeted.length} ${summary.unbudgeted.length === 1 ? 'categoría' : 'categorías'}. Puedes asignarles un límite mensual.`)
  if (prior?.phase === 'closed' && prior.remaining !== null && prior.remaining >= 0) messages.push('El mes anterior cerró dentro del límite total de las categorías presupuestadas.')
  if (!messages.length) messages.push(budgets.length ? 'Consulta el ritmo de consumo de cada categoría para revisar su planificación.' : 'Empieza por las categorías donde registras gastos con más frecuencia.')
  return (
    <section className="panel p-4 sm:p-5" aria-label="Recomendaciones de presupuesto">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><TrendingUp className="size-[18px] text-primary" aria-hidden="true" /> Recomendaciones</h2>
      <ul className="mt-3 space-y-2.5">{messages.map(message => <li className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/55 p-2.5 text-sm leading-snug" key={message}><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />{message}</li>)}</ul>
    </section>
  )
}

export function BudgetAlerts({ budgets }: { budgets: BudgetView[] }) {
  const categoryName = useCategoryName()
  const alerts = budgets.flatMap(budget => {
    const kind = budgetAlert(budget.used, budget)
    return kind ? [{ id: budget.id, name: categoryName(budget.categoryId), message: budgetAlertMessage(kind, budget.warningThreshold) }] : []
  })
  if (!alerts.length) return null
  return <section className="panel p-4 sm:p-5" aria-label="Alertas del período"><h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><CircleAlert className="size-[18px] text-warning" aria-hidden="true" /> Alertas del período</h2>
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{alerts.map(item => <li key={item.id} className="rounded-lg border border-border bg-secondary/55 p-2.5 text-sm"><span className="block font-semibold">{item.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.message}</span></li>)}</ul>
  </section>
}
