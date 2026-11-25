import { ChartNoAxesCombined, ChartPie } from 'lucide-react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useCategories, useCategoryName } from '@/features/categories/category-context'
import { formatCompactMoney, formatMoney } from '@/lib/utils'
import { consumptionPoints, type BudgetView } from './budget-calculations'
import { percentageLabel } from './budget-cards'
import { periodLabel } from './budget-controls'
import type { BudgetHistory, BudgetPhase } from './budget-model'

const axis = { fill: 'var(--muted-foreground)', fontSize: 12 }
const moneyAxis = (hidden: boolean) => ({ tick: hidden ? false as const : axis, width: hidden ? 10 : 76, tickLine: false as const, axisLine: false as const, tickFormatter: formatCompactMoney })
const phaseLabels: Record<BudgetPhase, string> = { current: 'Mes en curso', closed: 'Mes cerrado', future: 'Mes planificado' }

function ChartKey({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">{items.map(item => (
    <li className="flex items-center gap-1.5" key={item.label}><span className={`w-3 border-t-2 ${item.dashed ? 'border-dashed' : ''}`} style={{ borderColor: item.color }} aria-hidden="true" />{item.label}</li>
  ))}</ul>
}

function ChartTooltip({ label, items, hidden }: { label?: string; items: { name: string; amount: number }[]; hidden: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm shadow-lg">
      {label && <p className="mb-1 text-xs text-muted-foreground">{label}</p>}
      {items.map(item => <p className="flex justify-between gap-3 tabular-nums" key={item.name}><span>{item.name}</span><strong>{formatMoney(item.amount, hidden)}</strong></p>)}
    </div>
  )
}

const historyKey = [{ label: 'Planificado', color: 'var(--budget-time)' }, { label: 'Consumido', color: 'var(--primary)' }, { label: 'Diferencia', color: 'var(--budget-limit)', dashed: true }]

export function BudgetHistoryChart({ data, hidden }: { data: BudgetHistory[]; hidden: boolean }) {
  const points = data.map(item => ({ ...item, label: `${periodLabel(item.period, true)}${item.phase === 'current' ? '*' : item.phase === 'future' ? '†' : ''}` }))
  return (
    <section className="panel p-4 sm:p-5" aria-label="Comparación mensual de presupuestos">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><ChartNoAxesCombined className="size-[18px] text-primary" aria-hidden="true" /> Comparación mensual</h2>
      <p className="mt-1 text-xs text-muted-foreground">Plan y ejecución de las categorías presupuestadas.</p>
      {points.some(item => item.limit !== null) ? <>
        <div className="mt-3 h-52 min-w-0" role="group" aria-label="Gráfico de comparación mensual">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={points} margin={{ right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={axis} tickMargin={8} tickLine={false} axisLine={false} minTickGap={10} />
              <YAxis {...moneyAxis(hidden)} domain={['auto', 'auto']} />
              <Tooltip cursor={false} content={({ active, payload }) => {
                const point = payload?.[0]?.payload as typeof points[number] | undefined
                return active && point ? <ChartTooltip label={`${periodLabel(point.period)} · ${phaseLabels[point.phase]}`} hidden={hidden}
                  items={payload!.flatMap(item => typeof item.value === 'number' ? [{ name: String(item.name), amount: item.value }] : [])} /> : null
              }} />
              <Bar dataKey="limit" name="Planificado" fill="var(--budget-time)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Bar dataKey="spent" name="Consumido" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Line dataKey="remaining" name="Diferencia" stroke="var(--budget-limit)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ChartKey items={historyKey} />
        {(points.some(item => item.phase === 'current' || item.phase === 'future')) && <p className="mt-2 text-xs text-muted-foreground">{points.some(item => item.phase === 'current') && '* Mes en curso. '}{points.some(item => item.phase === 'future') && '† Mes futuro.'}</p>}
      </> : <p className="flex min-h-45 items-center justify-center text-sm text-muted-foreground">El período consultado aún no tiene planificación para comparar.</p>}
    </section>
  )
}

export function BudgetDistributionChart({ budgets, hidden }: { budgets: BudgetView[]; hidden: boolean }) {
  const expenseCategories = useCategories('gasto')
  const categoryName = useCategoryName()
  const data = budgets.map(item => ({ name: categoryName(item.categoryId), limit: item.limit, color: expenseCategories.find(category => category.id === item.categoryId)?.color ?? '#10B981' }))
  const total = budgets.reduce((sum, item) => sum + item.limit, 0)
  return (
    <section className="panel p-4 sm:p-5" aria-label="Distribución presupuestaria">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><ChartPie className="size-[18px] text-primary" aria-hidden="true" /> Distribución presupuestaria</h2>
      <p className="mt-1 text-xs text-muted-foreground">Participación en el límite total del mes.</p>
      {data.length ? <div className="mt-4 grid items-center gap-3 min-[390px]:grid-cols-[minmax(115px,0.9fr)_minmax(0,1fr)]">
        <div className="relative mx-auto h-42 w-full max-w-45 min-w-0" role="group" aria-label="Gráfico de distribución de límites">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={data} dataKey="limit" nameKey="name" startAngle={90} endAngle={-270} innerRadius="68%" outerRadius="95%" paddingAngle={data.length > 1 ? 3 : 0} stroke="none" cornerRadius={4} isAnimationActive={false}>
                {data.map(item => <Cell key={item.name} fill={item.color} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => active && payload?.length ? <ChartTooltip hidden={hidden} items={[{ name: String(payload[0].name), amount: Number(payload[0].value) }]} /> : null} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[11px] text-muted-foreground">Planificado</span><span className="text-xs font-bold tabular-nums" title={formatMoney(total, hidden)}>{total >= 1_000_000_000 && !hidden ? formatCompactMoney(total) : formatMoney(total, hidden)}</span></div>
        </div>
        <ul className="min-w-0 space-y-2 text-xs">{data.map(item => <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-1.5" key={item.name}>
          <span className="flex min-w-0 items-start gap-1.5 text-muted-foreground"><span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: item.color }} /><span className="wrap-anywhere">{item.name}</span></span>
          <strong className="tabular-nums">{percentageLabel(item.limit / total * 100)}</strong><span className="col-span-2 pl-3.5 text-[11px] text-muted-foreground tabular-nums">{formatMoney(item.limit, hidden)}</span>
        </li>)}</ul>
      </div> : <p className="flex min-h-45 items-center justify-center text-sm text-muted-foreground">Agrega presupuestos para visualizar la distribución.</p>}
    </section>
  )
}

const consumptionKey = [
  { label: 'Consumo real', color: 'var(--primary)' }, { label: 'Ritmo planificado', color: 'var(--budget-time)', dashed: true },
  { label: 'Límite', color: 'var(--muted-foreground)', dashed: true }, { label: 'Proyección lineal', color: 'var(--budget-limit)', dashed: true },
]

export function BudgetConsumptionChart({ budget, expenses, hidden }: { budget: BudgetView; expenses: Parameters<typeof consumptionPoints>[1]; hidden: boolean }) {
  const points = consumptionPoints(budget, expenses)
  const projected = budget.projection.projected !== null
  return (
    <section className="rounded-xl border border-border p-3 sm:p-4" aria-label="Consumo acumulado">
      <h3 className="font-bold">Consumo acumulado</h3>
      <p className="mt-1 text-xs text-muted-foreground">{phaseLabels[budget.projection.phase]} · {budget.projection.elapsedDays} de {budget.projection.totalDays} días transcurridos</p>
      <div className="mt-2 h-50 min-w-0" role="group" aria-label="Gráfico de consumo acumulado">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart data={points} margin={{ top: 8, right: 12 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
            <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis {...moneyAxis(hidden)} />
            <Tooltip cursor={{ stroke: 'var(--border)', strokeDasharray: '4 4' }} content={({ active, label, payload }) => active && payload?.length ? (
              <ChartTooltip label={`Día ${label}`} hidden={hidden} items={payload.flatMap(item => typeof item.value === 'number' ? [{ name: String(item.name), amount: item.value }] : [])} />
            ) : null} />
            <Line dataKey="limit" name="Límite" stroke="var(--muted-foreground)" strokeDasharray="3 5" dot={false} isAnimationActive={false} />
            <Line dataKey="plan" name="Ritmo planificado" stroke="var(--budget-time)" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            <Line dataKey="actual" name="Consumo real" type="stepAfter" stroke="var(--primary)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            {projected && <Line dataKey="projection" name="Proyección lineal" stroke="var(--budget-limit)" strokeDasharray="6 4" strokeWidth={2} dot={false} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartKey items={consumptionKey.filter(item => projected || item.label !== 'Proyección lineal')} />
    </section>
  )
}
