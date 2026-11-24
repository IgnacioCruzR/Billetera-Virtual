import {
  Activity, ArrowDownLeft, ArrowDownRight, ArrowUpRight, CalendarClock, ChartNoAxesCombined,
  Coffee, CreditCard, PiggyBank, Sparkles, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { BudgetProgress, BudgetStatusBadge, categoryName, percentageLabel } from '@/features/budgets/budget-cards'
import type { Commitment, Period } from './model'
import type { DashboardBudget, DashboardSnapshot } from './use-dashboard'

const percentFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

export function SummaryCards({ snapshot, hidden }: { snapshot: DashboardSnapshot; hidden: boolean }) {
  const cards = [
    { title: 'Saldo actual', amount: snapshot.balance, change: snapshot.balanceVariation, comparison: 'vs. cierre anterior', icon: Wallet, color: 'bg-primary/12 text-emerald-300' },
    { title: 'Ingresos del período', amount: snapshot.income, change: snapshot.incomeVariation, comparison: 'vs. período anterior', icon: ArrowDownLeft, color: 'bg-primary/12 text-emerald-300' },
    { title: 'Gastos del período', amount: snapshot.expense, change: snapshot.expenseVariation, comparison: 'vs. período anterior', icon: ArrowUpRight, color: 'bg-amber-400/12 text-amber-300', invert: true },
    { title: 'Saldo proyectado', amount: snapshot.projected, change: null, comparison: 'Cobros y pagos pendientes', icon: ChartNoAxesCombined, color: 'bg-blue-400/12 text-blue-300' },
  ]

  return (
    <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Saldos del dashboard">
      {cards.map(({ title, amount, change, comparison, icon: Icon, color, invert }) => {
        const favorable = change !== null && (invert ? change < 0 : change > 0)
        const Trend = change !== null && change < 0 ? TrendingDown : TrendingUp
        const trendColor = change === 0 ? 'bg-accent text-muted-foreground' : favorable ? 'bg-primary/12 text-emerald-300' : 'bg-danger/10 text-red-300'
        return (
          <article className="panel p-4 sm:p-[18px]" key={title}>
            <div className="flex items-center gap-2.5">
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', color)}><Icon className="size-[17px]" aria-hidden="true" /></span>
              <h2 className="text-[13px] leading-tight font-semibold text-muted-foreground">{title}</h2>
            </div>
            <p className={cn('money mt-3 leading-tight wrap-anywhere', Math.abs(amount) >= 1_000_000_000 ? 'text-lg' : 'text-[clamp(1.375rem,2.1vw,1.875rem)]')} aria-label={hidden ? 'Monto oculto' : undefined}>{formatMoney(amount, hidden)}</p>
            <div className="mt-2.5 flex min-h-[21px] flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              {change !== null && (
                <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums', trendColor)}>
                  <Trend className="size-3" aria-hidden="true" />{change > 0 ? '+' : ''}{percentFormat.format(change)}%
                </span>
              )}
              <span>{comparison}</span>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export function BudgetPanel({ budgets, hidden }: { budgets: DashboardBudget[]; hidden: boolean }) {
  return (
    <section className="panel dashboard-anchor p-4 sm:p-5" aria-labelledby="presupuesto-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-heading flex items-center gap-2.5" id="presupuesto-title"><CreditCard className="size-[18px] text-primary" aria-hidden="true" /> Presupuestos del mes</h2>
        <a href="#presupuestos" className="rounded-sm text-xs font-semibold text-emerald-300 hover:underline">Ver presupuestos</a>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Consumo por categoría</p>
      {budgets.length ? <ul className="mt-5 space-y-4">
        {budgets.map(item => (
            <li key={item.id}>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <p className="text-sm font-semibold">{categoryName(item.categoryId)}</p>
                <BudgetStatusBadge status={item.status} />
              </div>
              <div className="mt-1.5"><BudgetProgress label={`Presupuesto de ${categoryName(item.categoryId)}`} value={item.percentage} status={item.status} /></div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                <span><span className="font-semibold text-foreground">{formatMoney(item.used, hidden)}</span> / {formatMoney(item.limit, hidden)}</span>
                <span>{percentageLabel(item.percentage)}</span>
              </div>
            </li>
        ))}
      </ul> : <p className="mt-5 text-sm text-muted-foreground">Este mes aún no tiene presupuestos.</p>}
    </section>
  )
}

export function CommitmentsPanel({ commitments, hidden }: { commitments: Commitment[]; hidden: boolean }) {
  return (
    <section id="compromisos" className="panel dashboard-anchor p-4 sm:p-5" aria-labelledby="compromisos-title">
      <h2 id="compromisos-title" className="panel-heading flex items-center gap-2.5"><CalendarClock className="size-[18px] text-primary" aria-hidden="true" /> Próximos cobros y pagos</h2>
      <p className="mt-1 text-sm text-muted-foreground">Compromisos pendientes</p>
      <ul className="mt-3 divide-y divide-border">
        {commitments.map(item => {
          const incoming = item.type === 'cobro'
          const near = item.daysUntil <= 5
          const Icon = incoming ? ArrowDownLeft : ArrowUpRight
          return (
            <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 py-3.5 sm:gap-3">
              <span className={cn('grid size-9 place-items-center rounded-lg', incoming ? 'bg-primary/12 text-emerald-300' : 'bg-amber-400/10 text-amber-300')}><Icon className="size-[18px]" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-sm leading-snug font-semibold">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{item.type}</span> <span aria-hidden="true">·</span> <time dateTime={item.date}>{formatDate(item.date, { day: 'numeric', month: 'short' })}</time></p>
              </div>
              <div className="text-right">
                <p className={cn('text-sm font-semibold tabular-nums', incoming && 'text-emerald-300')}>{incoming ? '+' : '−'}{formatMoney(item.amount, hidden)}</p>
                <span className={cn('mt-0.5 inline-block text-xs', near ? 'text-amber-300' : 'text-muted-foreground')}>{near ? 'Por vencer' : 'Programado'}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function SmallExpensesPanel({ data, hidden }: { data: DashboardSnapshot['smallExpenses']; hidden: boolean }) {
  return (
    <section id="hormiga" className="panel dashboard-anchor p-4 sm:p-5" aria-labelledby="hormiga-title">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/12 text-amber-300"><Coffee className="size-[18px]" aria-hidden="true" /></span>
        <div>
          <h2 className="panel-heading" id="hormiga-title">Gastos hormiga</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Gastos pequeños y frecuentes del mes</p>
        </div>
      </div>
      <p className="money mt-4 text-[30px] text-amber-200">{formatMoney(data.amount, hidden)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{data.count} movimientos detectados</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Proyección anual</span>
        <span className="font-semibold tabular-nums">{formatMoney(data.amount * 12, hidden)}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">El cálculo anual supone que mantienes este nivel de gasto cada mes.</p>
    </section>
  )
}

export function FinancialHealthPanel({ data }: { data: DashboardSnapshot['health'] }) {
  return (
    <section id="salud" className="panel dashboard-anchor bg-gradient-to-br from-card to-[#162a2b] p-4 sm:p-5" aria-labelledby="salud-title">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-emerald-300"><Activity className="size-[18px]" aria-hidden="true" /></span>
        <div>
          <h2 className="panel-heading" id="salud-title">Salud financiera</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatDate(`${data.month}-01`, { month: 'long', year: 'numeric' })} · Indicador orientativo</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-5">
        <div role="meter" aria-label="Salud financiera" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.score} aria-valuetext={`${data.score} de 100, ${data.label}`} className="grid size-[107px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${data.score}%, var(--border) 0)` }}>
          <div className="grid size-[90px] place-content-center rounded-full bg-[#192832] text-center" aria-hidden="true">
            <span className="money text-4xl leading-none">{data.score}</span>
            <span className="mt-0.5 text-xs font-medium text-muted-foreground">de 100</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-40">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/12 px-2 py-1 text-xs font-semibold text-emerald-300"><span className="size-1.5 rounded-full bg-primary" />{data.label}</span>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.description}</p>
        </div>
      </div>
    </section>
  )
}

export function Recommendations({ data, period, hidden, onAssistant }: { data: DashboardSnapshot; period: Period; hidden: boolean; onAssistant: () => void }) {
  const payment = data.commitments.find(item => item.type === 'pago')
  const variance = data.expenseVariation
  const ExpenseTrend = (variance ?? 0) <= 0 ? ArrowDownRight : ArrowUpRight
  const comparison = period === 'month' ? 'el mes anterior' : 'el período anterior'
  const insights = [
    { icon: ExpenseTrend, title: 'Variación de gastos', text: variance === null ? 'Registra gastos en ambos períodos para comparar.' : variance === 0 ? `Tus gastos se mantuvieron respecto a ${comparison}.` : `Tus gastos ${variance < 0 ? 'bajaron' : 'subieron'} ${percentFormat.format(Math.abs(variance))}% respecto a ${comparison}.` },
    { icon: PiggyBank, title: 'Gastos pequeños', text: `Llevas ${formatMoney(data.smallExpenses.amount, hidden)} en gastos hormiga este mes.` },
    { icon: CalendarClock, title: 'Pago próximo', text: payment ? `Tienes un pago de ${payment.description.toLocaleLowerCase('es-CL')} en ${payment.daysUntil} días.` : 'Estás al día con tus próximos pagos.' },
  ]

  return (
    <section className="panel p-4 sm:p-5" aria-labelledby="recomendaciones-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recomendaciones-title" className="panel-heading flex items-center gap-2.5"><Sparkles className="size-[18px] text-primary" aria-hidden="true" /> Recomendaciones inteligentes</h2>
        <Button variant="muted" onClick={onAssistant}><Sparkles aria-hidden="true" /> Abrir asistente</Button>
      </div>
      <ul className="mt-4 grid gap-2.5 md:grid-cols-3">
        {insights.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/60 p-3">
            <Icon className="mt-0.5 size-[17px] shrink-0 text-emerald-300" aria-hidden="true" />
            <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>
          </li>
        ))}
      </ul>
    </section>
  )
}
