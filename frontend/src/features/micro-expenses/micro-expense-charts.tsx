import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Select } from '@/components/ui/field'
import { expenseCategories } from '@/features/dashboard/mock-data'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/utils'
import type { MicroExpenseAnalysis } from './micro-expense-analysis'
import type { MicroExpenseDetectionConfig } from './micro-expense-model'
import { percent } from './micro-expense-overview'

const ticks = { fill: 'var(--muted-foreground)', fontSize: 11 }
const tooltipStyle = { background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 12 }
const axisMoney = (value: number, hidden: boolean) => hidden ? '••••' : formatCompactMoney(value)
const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function Frame({ title, description, children, control, wide }: { title: string; description: string; children: ReactNode; control?: ReactNode; wide?: boolean }) {
  return <section aria-label={title} className={`panel min-w-0 overflow-hidden p-3.5 sm:p-4 ${wide ? 'xl:col-span-2' : ''}`}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-bold tracking-tight">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p></div>{control}</div>
    {children}
  </section>
}

export function MicroExpenseCharts({ analysis, hidden, view, onView }: {
  analysis: MicroExpenseAnalysis; hidden: boolean; view: MicroExpenseDetectionConfig['frequencyView']; onView: (view: MicroExpenseDetectionConfig['frequencyView']) => void;
}) {
  const { evolution, categories, summary, patterns } = analysis
  const months = evolution.map(item => ({ ...item, label: `${formatDate(item.from, { month: 'short' })}${item.partial ? '*' : ''}` }))
  const hasPartialMonth = months.some(item => item.partial)
  const distribution = expenseCategories.flatMap(category => {
    const value = categories.get(category.id) ?? 0
    return value > 0 ? [{ name: category.name, value, fill: category.color }] : []
  })
  const statuses = [
    { name: 'Por revisar', value: summary.pendingCount, fill: '#f59e0b' },
    { name: 'Necesarios', value: summary.necessaryCount, fill: '#60a5fa' },
    { name: 'Prescindibles', value: summary.discretionaryCount, fill: '#10b981' },
  ]
  const frequency = view === 'weekday' ? analysis.weekdays.map((count, index) => ({ name: weekdays[index], count }))
    : [...patterns].sort((a, b) => b.count - a.count).slice(0, 7).map(pattern => ({ name: pattern.name, count: pattern.count }))
  return <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
    <Frame title="Evolución mensual" description={hasPartialMonth ? '* Mes en curso. La variación del resumen usa un corte comparable.' : 'Gasto registrado en los últimos seis meses hasta el mes elegido.'} wide>
      {months.some(item => item.total > 0) ? <div className="mt-2 h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={months} margin={{ top: 12, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="label" tick={ticks} tickLine={false} axisLine={false} />
          <YAxis width={68} tick={ticks} tickLine={false} axisLine={false} tickFormatter={value => axisMoney(value, hidden)} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--foreground)' }} formatter={value => formatMoney(Number(value), hidden)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="total" name="Total analizado" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="discretionary" name="Prescindible" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart></ResponsiveContainer>
      </div> : <p className="mt-4 text-sm text-muted-foreground">No hay historial analizado para graficar.</p>}
    </Frame>
    <Frame title="Distribución por categoría" description="Participación dentro del gasto identificado.">
      {distribution.length ? <>
        <div className="h-[148px]"><ResponsiveContainer width="100%" height="100%"><PieChart>
          <Pie data={distribution} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="83%" stroke="var(--card)" isAnimationActive={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={value => formatMoney(Number(value), hidden)} />
        </PieChart></ResponsiveContainer></div>
        <ul className="space-y-1.5 text-xs">{distribution.map(item => <li key={item.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"><span className="size-2 rounded-full" style={{ background: item.fill }} aria-hidden="true" /><span>{item.name}</span><span className="text-right font-semibold tabular-nums">{formatMoney(item.value, hidden)} · {percent(item.value / summary.amount * 100)}</span></li>)}</ul>
      </> : <p className="mt-4 text-sm text-muted-foreground">Sin categorías en el análisis.</p>}
    </Frame>
    <Frame title="Frecuencia de consumo" description={view === 'weekday' ? 'Cantidad de movimientos por día de la semana.' : 'Patrones con más movimientos en el período.'} wide control={
      <Select aria-label="Agrupar frecuencia" value={view} onChange={event => onView(event.target.value === 'pattern' ? 'pattern' : 'weekday')}><option value="weekday">Por día</option><option value="pattern">Por patrón</option></Select>
    }>
      {summary.count ? <div className="mt-2 h-[215px] min-w-0"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={frequency} layout={view === 'pattern' ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={view === 'pattern'} horizontal={view === 'weekday'} />
          {view === 'weekday' ? <>
            <XAxis dataKey="name" tick={ticks} tickLine={false} axisLine={false} /><YAxis width={25} allowDecimals={false} tick={ticks} tickLine={false} axisLine={false} />
          </> : <>
            <XAxis type="number" allowDecimals={false} tick={ticks} tickLine={false} axisLine={false} /><YAxis width={110} type="category" dataKey="name" tickFormatter={name => name.length > 16 ? `${name.slice(0, 15)}…` : name} tick={ticks} tickLine={false} axisLine={false} />
          </>}
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--foreground)' }} />
          <Bar dataKey="count" name="Movimientos" fill="#60a5fa" radius={3} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer></div> : <p className="mt-4 text-sm text-muted-foreground">No hay movimientos incluidos para medir la frecuencia.</p>}
    </Frame>
    <Frame title="Distribución por clasificación" description="Cantidad de movimientos identificados.">
      {summary.count > 0 && <div className="h-[148px]"><ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={statuses.filter(item => item.value > 0)} dataKey="value" nameKey="name" innerRadius="63%" outerRadius="83%" stroke="var(--card)" isAnimationActive={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={value => `${value} movimientos`} />
      </PieChart></ResponsiveContainer></div>}
      <ul className="mt-2 space-y-1.5 text-xs">{statuses.map(item => <li key={item.name} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: item.fill }} aria-hidden="true" />{item.name}</span><strong>{item.value}</strong></li>)}</ul>
    </Frame>
  </div>
}
