import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/utils'
import { progressLabel, savingsDate } from './savings-cards'
import { historicalProgress, monthlyActivity, scheduledContribution } from './savings-planning'
import type { SavingsGoalHistory, SavingsReservationOperation } from './savings-model'

const tick = { fill: 'var(--muted-foreground)', fontSize: 10 }
const tooltip = { background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 12 }
const amountTick = (value: number, hidden: boolean) => hidden ? '••••' : formatCompactMoney(value)
const money = (value: unknown, hidden: boolean) => formatMoney(Number(value), hidden)
const axis = { tick, tickLine: false, axisLine: false }
const dateShort = (date: string) => formatDate(date, { day: 'numeric', month: 'short' })
const instant = (date: string) => Date.parse(`${date}T12:00:00Z`)
const toDate = (value: number) => new Date(value).toISOString().slice(0, 10)

export function SavingsDistributionChart({ histories, hidden }: { histories: SavingsGoalHistory[]; hidden: boolean }) {
  const data = histories.filter(item => item.reserved > 0).map(item => ({ id: item.goal.id, name: item.goal.name, value: item.reserved, fill: item.goal.color }))
  const total = data.reduce((sum, item) => sum + item.value, 0)
  return <section className="panel min-w-0 p-4" aria-label="Distribución del dinero reservado">
    <h2 className="font-bold">Distribución del dinero reservado</h2>
    {data.length ? <>
      <div className="h-44 min-w-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie nameKey="name" dataKey="value" data={data} innerRadius="60%" outerRadius="83%" stroke="var(--card)" isAnimationActive={false} /><Tooltip contentStyle={tooltip} formatter={value => money(value, hidden)} /></PieChart></ResponsiveContainer></div>
      <ul className="space-y-1.5 text-xs">{data.map(item => <li key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2"><span aria-hidden="true" className="mt-1 size-2 rounded-full" style={{ background: item.fill }} /><span className="wrap-anywhere">{item.name}</span><strong className="text-right tabular-nums">{money(item.value, hidden)} · {progressLabel(item.value / total * 100)}</strong></li>)}</ul>
    </> : <p className="mt-3 text-sm text-muted-foreground">Todavía no hay dinero reservado.</p>}
  </section>
}

export function SavingsActivityChart({ operations, today, hidden }: { operations: SavingsReservationOperation[]; today: string; hidden: boolean }) {
  const data = monthlyActivity(operations, today).map((item, index, items) => ({
    ...item, releases: -item.releases, label: `${formatDate(`${item.month}-01`, { month: 'short' })}${index === items.length - 1 ? '*' : ''}`,
  }))
  return <section className="panel min-w-0 p-4" aria-label="Actividad mensual de ahorro">
    <h2 className="font-bold">Actividad mensual de ahorro</h2><p className="mt-0.5 text-xs text-muted-foreground">Aportes, liberaciones y variación neta · * mes actual.</p>
    {data.some(item => item.additions || item.releases) ? <div className="mt-2 h-60 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis width={67} {...axis} tickFormatter={value => amountTick(value, hidden)} />
      <ReferenceLine y={0} stroke="var(--muted-foreground)" /><Tooltip contentStyle={tooltip} labelStyle={{ color: 'var(--foreground)' }} formatter={value => money(value, hidden)} /><Legend wrapperStyle={{ fontSize: 11 }} />
      <Bar dataKey="additions" name="Aportes" fill="#818CF8" radius={3} maxBarSize={27} isAnimationActive={false} /><Bar dataKey="releases" name="Liberaciones" fill="#F59E0B" radius={3} maxBarSize={27} isAnimationActive={false} /><Bar dataKey="net" name="Neto" fill="#60A5FA" radius={3} maxBarSize={27} isAnimationActive={false} />
    </BarChart></ResponsiveContainer></div> : <p className="mt-3 text-sm text-muted-foreground">Aún no hay operaciones en los últimos seis meses.</p>}
  </section>
}

export function GoalEvolutionChart({ history, today, monthly, months, hidden }: {
  history: SavingsGoalHistory; today: string; monthly: number; months: number | null; hidden: boolean;
}) {
  const historical = historicalProgress(history, today)
  const target = history.goal.target
  const count = months && monthly > 0 ? months : 0
  const step = Math.max(1, Math.ceil(count / 24))
  const projected = count > 0 ? [...Array.from({ length: Math.floor((count - 1) / step) }, (_, index) => (index + 1) * step), count]
    .flatMap(month => {
      const date = scheduledContribution(today, month)
      return date ? [{ time: instant(date), forecast: Math.min(target, history.reserved + monthly * month) }] : []
    }) : []
  const data = [...historical.map(row => ({ ...row, releases: row.releases || null, time: instant(row.date), forecast: projected.length && row.date === today ? row.reserved : undefined })), ...projected]
  return <section className="mt-4 rounded-xl border border-border p-3" aria-label="Evolución de la meta">
    <h3 className="font-bold">Evolución de la meta</h3><p className="mt-0.5 text-xs text-muted-foreground">Los aportes y liberaciones cambian la reserva. El ritmo previsto se muestra con línea discontinua.</p>
    {history.operations.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Sin aportes efectivos registrados.</p>}
    <div className="mt-2 h-58 min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 12, left: 2, bottom: 0 }}>
      <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} />
      <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={value => dateShort(toDate(value))} {...axis} />
      <YAxis width={63} {...axis} tickFormatter={value => amountTick(value, hidden)} domain={[0, 'auto']} />
      <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="2 4" ifOverflow="extendDomain" />
      <Tooltip contentStyle={tooltip} labelStyle={{ color: 'var(--foreground)' }} labelFormatter={value => savingsDate(toDate(Number(value)))} formatter={value => money(value, hidden)} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <Line type="stepAfter" dataKey="reserved" name="Dinero reservado" stroke="#818CF8" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
      <Line type="stepAfter" dataKey="accumulated" name="Aportes acumulados" stroke="#2DD4BF" dot={false} isAnimationActive={false} />
      <Line dataKey="releases" name="Liberaciones" stroke="#F59E0B" strokeOpacity={0} dot={{ r: 3, fill: '#F59E0B' }} isAnimationActive={false} />
      {projected.length > 0 && <Line type="stepAfter" dataKey="forecast" name="Ritmo planificado" stroke="#60A5FA" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />}
    </LineChart></ResponsiveContainer></div>
    <p className="text-xs text-muted-foreground">Objetivo · <strong>{money(target, hidden)}</strong></p>
  </section>
}

export function SavingsComparisonChart({ today, target, reserved, usual, accelerated, months, hidden }: {
  today: string; target: number; reserved: number; usual: number; accelerated: number; months: number; hidden: boolean;
}) {
  const end = Math.max(1, months)
  const step = Math.max(1, Math.ceil(end / 16))
  const data = [...Array.from({ length: Math.ceil(end / step) }, (_, index) => index * step), end].flatMap(month => {
    const date = scheduledContribution(today, month)
    return date ? [{ date, usual: Math.min(target, reserved + usual * month), accelerated: Math.min(target, reserved + accelerated * month) }] : []
  })
  return <div className="h-56 min-w-0" aria-label="Comparación de escenarios en el tiempo"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
    <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="date" tickFormatter={dateShort} {...axis} /><YAxis width={63} tickFormatter={value => amountTick(value, hidden)} {...axis} />
    <Tooltip contentStyle={tooltip} labelStyle={{ color: 'var(--foreground)' }} labelFormatter={value => typeof value === 'string' ? savingsDate(value) : ''} formatter={value => money(value, hidden)} /><Legend wrapperStyle={{ fontSize: 11 }} />
    <Line type="stepAfter" dataKey="usual" name="Habitual" stroke="#60A5FA" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
    <Line type="stepAfter" dataKey="accelerated" name="Con ahorro adicional" stroke="#10B981" strokeWidth={2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
  </LineChart></ResponsiveContainer></div>
}
