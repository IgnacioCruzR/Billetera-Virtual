import { useCategoryName } from '@/features/categories/category-context'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/utils'
import type { FinancialHealthAssessment, FinancialHealthHistory, FinancialHealthMethodology } from './health-model'
import { metric, pillarContent, qualityLabels } from './health-overview'

const axis = { tick: { fill: 'var(--muted-foreground)', fontSize: 10 }, tickLine: false, axisLine: false }
const tooltip = { contentStyle: { background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 10, fontSize: 12 }, labelStyle: { color: 'var(--foreground)' } }
const colors = { savings: '#818CF8', budget: '#60A5FA', balance: '#2DD4BF', micro: '#F59E0B', payments: '#FB923C' }
const signatures = { savings: '3 4', budget: '5 3', balance: '1 3', micro: '8 4', payments: '7 3 1 3' }
const truncate = (label: string) => label.length > 15 ? `${label.slice(0, 14)}…` : label

function ChartFrame({ title, help, children, wide }: { title: string; help: string; children: ReactNode; wide?: boolean }) {
  return <section aria-label={title} className={`panel min-w-0 overflow-hidden p-3.5 sm:p-4 ${wide ? 'xl:col-span-2' : ''}`}>
    <h2 className="font-bold">{title}</h2><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{help}</p>
    {children}
  </section>
}

const empty = (text: string) => <p className="mt-4 text-sm text-muted-foreground">{text}</p>

export function HealthCharts({ report, history, method, hidden }: {
  report: FinancialHealthAssessment; history: FinancialHealthHistory; method: FinancialHealthMethodology; hidden: boolean;
}) {
  const categoryName = useCategoryName()
  const data = history.points.map(item => ({
    label: `${formatDate(item.range.from, { month: 'short' })}${item.quality.closed ? '' : '*'}${item.quality.closed && item.quality.state === 'provisional' ? '†' : ''}`,
    state: qualityLabels[item.quality.state], score: item.score, rate: item.indicators.savingsRate === null ? null : item.indicators.savingsRate * 100,
    ...Object.fromEntries(item.pillars.map(pillar => [pillar.id, pillar.score])),
  }))
  const pillars = report.pillars.map(item => ({ name: pillarContent[item.id].short, score: item.score }))
  const budgets = new Map<string, { name: string; limit: number; spent: number; excess: number }>()
  for (const item of report.budgets) {
    const current = budgets.get(item.categoryId) ?? { name: categoryName(item.categoryId), limit: 0, spent: 0, excess: 0 }
    budgets.set(item.categoryId, { ...current, limit: current.limit + item.limit, spent: current.spent + item.used, excess: current.excess + Math.max(0, item.used - item.limit) })
  }
  const budgetData = [...budgets.values()]
  const payments = report.indicators.payments
  const paymentRows = [{ name: 'A tiempo', count: payments.timely, fill: '#10B981' }, { name: 'Con atraso', count: payments.late, fill: '#FB923C' }, { name: 'Sin confirmar', count: payments.overdue, fill: '#F59E0B' }]
  return <div className="grid gap-4 sm:gap-5 xl:grid-cols-3">
    <ChartFrame title="Evolución de salud financiera" help="Escala de 0 a 100. * corte parcial · † evaluación provisional. Los intervalos sin puntuación aparecen como vacíos." wide>
      {history.points.some(item => item.quality.available) ? <div className="mt-2 h-62"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 9, left: 0, right: 10, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="label" {...axis} /><YAxis width={29} domain={[0, 100]} {...axis} />
        <Tooltip {...tooltip} labelFormatter={(label, payload) => `${label} · ${payload[0]?.payload.state ?? ''}`} formatter={value => metric(Number(value))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line name="Puntuación global" dataKey="score" connectNulls={false} stroke="#84cc16" dot={{ r: 4 }} strokeWidth={2.5} isAnimationActive={false} />
        {report.pillars.map(item => <Line key={item.id} name={pillarContent[item.id].short} dataKey={item.id} connectNulls={false} stroke={colors[item.id]} strokeDasharray={signatures[item.id]} dot={{ r: 2.5 }} isAnimationActive={false} />)}
      </LineChart></ResponsiveContainer></div> : empty('El período no tiene evaluaciones disponibles.')}
      {data.every(item => item.score === null) && <p className="mt-2 text-xs text-muted-foreground">La puntuación global no está disponible para los meses mostrados.</p>}
    </ChartFrame>
    <ChartFrame title="Comparación de pilares" help="Puntuación normalizada del período seleccionado.">
      {pillars.some(item => item.score !== null) ? <div className="mt-2 h-62"><ResponsiveContainer width="100%" height="100%"><BarChart data={pillars} layout="vertical" margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" horizontal={false} /><XAxis type="number" domain={[0, 100]} {...axis} /><YAxis type="category" width={82} dataKey="name" {...axis} />
        <Tooltip {...tooltip} formatter={value => metric(Number(value))} /><Bar name="Puntuación" dataKey="score" fill="#60A5FA" radius={4} maxBarSize={22} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div> : empty('Los pilares aún no tienen datos medibles.')}
      {pillars.some(item => item.score === null) && <p className="mt-1 text-xs text-muted-foreground">Sin puntuación · {pillars.filter(item => item.score === null).map(item => item.name).join(', ')}.</p>}
    </ChartFrame>
    <ChartFrame title="Evolución de la tasa de ahorro" help="El área bajo cero indica que el gasto del mes superó sus ingresos.">
      {data.some(item => item.rate !== null) ? <div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
        <XAxis dataKey="label" {...axis} /><YAxis width={42} {...axis} tickFormatter={value => `${metric(value)} %`} />
        <ReferenceLine y={0} stroke="#FB923C" strokeDasharray="2 4" ifOverflow="extendDomain" />
        <ReferenceLine y={method.savingsReference * 100} stroke="#818CF8" strokeDasharray="4 4" ifOverflow="extendDomain" />
        <Tooltip {...tooltip} formatter={value => `${metric(Number(value))} %`} /><Line name="Tasa registrada" dataKey="rate" connectNulls={false} stroke="#10B981" dot={{ r: 4 }} isAnimationActive={false} />
      </LineChart></ResponsiveContainer></div> : empty('Faltan ingresos efectivos para calcular la tasa.')}
      <p className="mt-1 text-xs text-indigo-200">Referencia · {metric(method.savingsReference * 100)} %</p>
    </ChartFrame>
    <ChartFrame title="Comparación presupuestaria" help="Importes por categoría. El exceso suma los límites mensuales superados.">
      {hidden ? empty('Importes ocultos por privacidad.') : budgetData.length ? <div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={budgetData} layout="vertical" margin={{ left: 0, right: 6, top: 8, bottom: 0 }}>
        <XAxis type="number" tickFormatter={formatCompactMoney} {...axis} /><YAxis type="category" width={88} dataKey="name" tickFormatter={truncate} {...axis} />
        <Tooltip {...tooltip} formatter={value => formatMoney(Number(value), false)} /><Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="limit" name="Límite" fill="#818CF8" radius={2} isAnimationActive={false} /><Bar dataKey="spent" name="Gasto" fill="#60A5FA" radius={2} isAnimationActive={false} /><Bar dataKey="excess" name="Exceso" fill="#FB923C" radius={2} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div> : empty('El período no tiene presupuestos.')}
    </ChartFrame>
    <ChartFrame title="Cumplimiento de compromisos" help="Pagos evaluables por fecha de vencimiento.">
      {payments.unknown ? empty('La fecha de vencimiento vigente al corte es indeterminada.') : paymentRows.some(item => item.count > 0) ? <div className="mt-2 h-52"><ResponsiveContainer width="100%" height="100%"><BarChart data={paymentRows} margin={{ left: 0, right: 4, top: 10, bottom: 0 }}>
        <XAxis dataKey="name" {...axis}/><YAxis width={26} allowDecimals={false} {...axis}/><Tooltip {...tooltip} /><Bar name="Pagos evaluables" dataKey="count" fill="#60A5FA" radius={3} maxBarSize={34} isAnimationActive={false} />
      </BarChart></ResponsiveContainer></div> : empty('No hay pagos evaluables para este corte.')}
    </ChartFrame>
  </div>
}
