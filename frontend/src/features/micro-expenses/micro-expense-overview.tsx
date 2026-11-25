import { ArrowDownRight, ArrowRight, ChartNoAxesCombined, Coffee, Layers3, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { categoryName } from '@/features/budgets/budget-cards'
import { formatDate, formatMoney } from '@/lib/utils'
import { simulateSavings, emptySavingsScenario, type MicroExpenseAnalysis } from './micro-expense-analysis'
import type { DateRange, MicroExpenseRecommendation, SpendingPattern } from './micro-expense-model'

const percentNumber = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })
export const percent = (value: number | null) => value === null ? 'No disponible' : `${percentNumber.format(value)} %`
export const perWeek = (value: number) => `${percentNumber.format(value)} por semana`
export const microMoney = (amount: number | null, hidden: boolean) => amount === null ? 'Datos insuficientes' : formatMoney(amount, hidden)
const displayDate = (date: string) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })
export const rangeLabel = ({ from, to }: DateRange) => `${displayDate(from)} al ${displayDate(to)}`

export function MicroExpenseOverview({ analysis, hidden }: { analysis: MicroExpenseAnalysis; hidden: boolean }) {
  const data = analysis.summary
  const cards = [
    { title: 'Gasto acumulado', value: formatMoney(data.amount, hidden), help: 'Gastos identificados en el período', icon: Coffee, tone: 'bg-warning/12 text-amber-300' },
    { title: 'Movimientos identificados', value: data.count.toString(), help: `${data.pendingCount} por revisar · ${data.necessaryCount + data.discretionaryCount} revisados`, icon: Layers3, tone: 'bg-budget-time/12 text-blue-300' },
    { title: 'Proyección anual', value: microMoney(data.annualEstimate, hidden), help: data.monthlyEstimate === null ? 'Se necesita más actividad' : `${formatMoney(data.monthlyEstimate, hidden)} de ritmo mensual`, icon: ChartNoAxesCombined, tone: 'bg-reserve/12 text-indigo-300' },
    { title: 'Gastos prescindibles', value: formatMoney(data.discretionary, hidden), help: data.discretionaryCount ? `${data.discretionaryCount} clasificados manualmente` : 'Sin gastos marcados como prescindibles', icon: PiggyBank, tone: 'bg-primary/12 text-emerald-300' },
  ]
  const stats = [
    ['Promedio por movimiento', data.average === null ? 'No disponible' : formatMoney(data.average, hidden)],
    ['Frecuencia de consumo', perWeek(data.perWeek)], ['Participación en gastos', percent(data.expenseShare)],
    ['Participación en ingresos', percent(data.incomeShare)], ['Variación comparable', data.variation === null ? 'No disponible' : `${data.variation > 0 ? '+' : ''}${percent(data.variation)}`],
    ['Pendientes de revisión', String(data.pendingCount)],
  ]
  return <section aria-label="Resumen de gastos hormiga" className="space-y-3">
    <div className="grid gap-3 min-[500px]:grid-cols-2 xl:grid-cols-4">{cards.map(({ title, value, help, icon: Icon, tone }) =>
      <article key={title} aria-label={title} className="panel flex min-w-0 flex-col p-4">
        <div className="flex items-center justify-between gap-2.5"><h2 className="text-sm font-semibold text-muted-foreground">{title}</h2><span className={`shrink-0 rounded-lg p-2 ${tone}`}><Icon className="size-[17px]" aria-hidden="true" /></span></div>
        <p className="mt-2 text-[clamp(1.25rem,2.4vw,1.8rem)] leading-tight font-extrabold tracking-tight wrap-anywhere tabular-nums">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{help}</p>
      </article>)}</div>
    <div className="panel px-4 py-3">
      <dl className="grid gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{stats.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-semibold wrap-anywhere tabular-nums">{value}</dd></div>)}</dl>
      <p className="mt-2 text-xs text-muted-foreground">{analysis.partial ? 'Período en curso. ' : ''}{analysis.previous ? `Comparación con ${rangeLabel(analysis.previous)}.` : 'Comparación anterior no disponible.'}</p>
    </div>
  </section>
}

export function SpendingPatterns({ patterns, hidden, onPattern }: { patterns: SpendingPattern[]; hidden: boolean; onPattern: (id: string) => void }) {
  return <section className="panel p-4 sm:p-5" aria-label="Patrones de consumo">
    <h2 className="text-lg font-bold tracking-tight">Patrones de consumo</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">Selecciona un patrón para ver sus gastos asociados.</p>
    {patterns.length ? <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {patterns.map(pattern => <article key={pattern.id} className="min-w-0 rounded-xl border border-border bg-secondary/50 p-3">
        <button type="button" onClick={() => onPattern(pattern.id)} className="flex w-full items-center justify-between gap-2 rounded-sm text-left text-sm font-bold text-foreground wrap-anywhere hover:text-primary focus-visible:outline-primary">{pattern.name}<ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></button>
        <p className="mt-0.5 text-xs text-muted-foreground">{categoryName(pattern.categoryId)} · {pattern.count} {pattern.count === 1 ? 'registro' : 'registros'}</p>
        <p className="mt-2 font-bold text-amber-200 tabular-nums">{formatMoney(pattern.amount, hidden)}</p>
        <dl className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-2 text-xs">
          <div><dt className="text-muted-foreground">Promedio</dt><dd>{formatMoney(pattern.average, hidden)}</dd></div>
          <div><dt className="text-muted-foreground">Participación</dt><dd>{percent(pattern.share)}</dd></div>
          <div><dt className="text-muted-foreground">Frecuencia</dt><dd>{perWeek(pattern.perWeek)}</dd></div>
          <div><dt className="text-muted-foreground">Variación</dt><dd>{pattern.variation === null ? 'Sin comparación' : `${pattern.variation > 0 ? '+' : ''}${percent(pattern.variation)}`}</dd></div>
        </dl>
      </article>)}
    </div> : <p className="mt-4 text-sm text-muted-foreground">Aún no hay patrones con gastos incluidos en este período.</p>}
  </section>
}

export function microRecommendations(analysis: MicroExpenseAnalysis, hidden: boolean): MicroExpenseRecommendation[] {
  const { summary, patterns } = analysis
  const suggestions: MicroExpenseRecommendation[] = []
  if (summary.pendingCount) suggestions.push({ id: 'review', title: 'Revisa los candidatos', detail: `${summary.pendingCount} ${summary.pendingCount === 1 ? 'movimiento está pendiente' : 'movimientos están pendientes'} de revisión. Puedes indicar cuáles son necesarios o prescindibles.`, action: 'history' })
  if (summary.expenseShare !== null && summary.count) suggestions.push({ id: 'share', title: 'Participación en tus gastos', detail: `Los gastos analizados representan el ${percent(summary.expenseShare)} del gasto registrado en el período.`, action: 'history' })
  const top = [...patterns].sort((a, b) => b.count - a.count)[0]
  if (top && top.count > 1) suggestions.push({ id: 'pattern', title: 'Patrón frecuente', detail: `${top.name} aparece ${top.count} veces. Revisa las fechas y montos de esos movimientos.`, action: 'pattern' })
  if (summary.variation !== null && summary.variation < 0) suggestions.push({ id: 'variation', title: 'Menor consumo registrado', detail: `El gasto analizado bajó un ${percent(-summary.variation)} frente al período comparable. Consulta los movimientos de este período.`, action: 'history' })
  const scenario = simulateSavings(analysis, { ...emptySavingsScenario, includeDiscretionary: true })
  if (scenario.monthly !== null && scenario.monthly > 0) suggestions.push({ id: 'saving', title: 'Explora una reducción', detail: `Reducir en 25 % el ritmo de los gastos que marcaste como prescindibles equivaldría a ${formatMoney(scenario.monthly, hidden)} al mes en este escenario.`, action: 'simulator' })
  return suggestions
}

export function MicroExpenseRecommendations({ items, onAction }: { items: MicroExpenseRecommendation[]; onAction: (item: MicroExpenseRecommendation) => void }) {
  return <section className="panel p-4 sm:p-5" aria-label="Recomendaciones de gastos hormiga">
    <h2 className="text-lg font-bold tracking-tight">Recomendaciones</h2>
    {items.length ? <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(item => <li key={item.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-secondary/55 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><ArrowDownRight className="size-4 shrink-0 text-primary" aria-hidden="true" />{item.title}</p>
        <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground wrap-anywhere">{item.detail}</p>
        <Button variant="ghost" size="sm" className="mt-1 w-fit px-0 text-emerald-200" onClick={() => onAction(item)}>{item.action === 'simulator' ? 'Abrir escenario' : item.action === 'pattern' ? 'Ver patrón' : 'Ver movimientos'}<ArrowRight aria-hidden="true" /></Button>
      </li>)}
    </ul> : <p className="mt-3 text-sm text-muted-foreground">Aún no hay información suficiente para generar recomendaciones en este período.</p>}
  </section>
}
