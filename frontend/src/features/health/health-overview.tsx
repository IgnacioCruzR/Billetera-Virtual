import { useCategoryName } from '@/features/categories/category-context'
import type { CSSProperties } from 'react'
import { Activity, ArrowUpRight, CalendarCheck, Coffee, Landmark, PiggyBank, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import type { EvaluationState, FinancialHealthAssessment, FinancialHealthMethodology, FinancialHealthPillar, FinancialHealthRecommendation, FinancialHealthStatus, HealthRange, PillarId } from './health-model'

export const pillarContent = {
  savings: { name: 'Capacidad de ahorro', short: 'Ahorro', icon: PiggyBank, href: '#metas?plan=1', action: 'Ver metas de ahorro' },
  budget: { name: 'Cumplimiento presupuestario', short: 'Presupuestos', icon: Landmark, href: '#presupuestos', action: 'Ver presupuestos' },
  balance: { name: 'Equilibrio financiero', short: 'Equilibrio', icon: Wallet, href: '#compromisos', action: 'Ver flujo de caja' },
  micro: { name: 'Control de gastos hormiga', short: 'Gastos hormiga', icon: Coffee, href: '#hormiga?simulador=prescindibles', action: 'Simular ahorro en Gastos hormiga' },
  payments: { name: 'Cumplimiento de pagos', short: 'Pagos', icon: CalendarCheck, href: '#compromisos', action: 'Ver cobros y pagos' },
} satisfies Record<PillarId, { name: string; short: string; icon: typeof Activity; href: string; action: string }>

export const qualityLabels: Record<EvaluationState, string> = { insufficient: 'Datos insuficientes', partial: 'Evaluación parcial', provisional: 'Provisional', complete: 'Completa', reconstructed: 'Reconstrucción histórica' }
const tones: Record<FinancialHealthStatus, string> = { 'Muy favorable': '#84CC16', Favorable: '#10B981', 'En desarrollo': '#60A5FA', 'Requiere atención': '#FB923C', 'Atención prioritaria': '#EF4444' }
const number = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 })
export const metric = (value: number | null) => value === null ? 'No disponible' : number.format(value)
export const percentage = (value: number | null) => value === null ? 'No disponible' : `${metric(value * 100)} %`
export const healthDate = (date: string) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })
export const healthRange = (range: HealthRange) => `${healthDate(range.from)} al ${healthDate(range.to)}`
export const changeText = (change: number | null, unit = 'pts') => change === null ? 'Sin comparación equivalente' : `${change > 0 ? '+' : ''}${metric(change)} ${unit}`
const money = (value: number | null, hidden: boolean) => value === null ? 'No disponible' : formatMoney(value, hidden)
const mobileDrawer = 'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-0 max-sm:rounded-b-none'

export function FinancialHealthGauge({ score, status, compact }: { score: number | null; status: FinancialHealthStatus | null; compact?: boolean }) {
  const color = status ? tones[status] : 'var(--budget-time)'
  const style = { '--health-progress': `${score ?? 0}%`, '--health-tone': color } as CSSProperties
  return <div className={cn('health-gauge relative grid aspect-square shrink-0 place-items-center rounded-full p-[9px]', compact ? 'size-22' : 'size-36 sm:size-46')} style={style} role={score === null ? 'img' : 'meter'} aria-label={score === null ? 'Puntuación no disponible' : 'Puntuación de salud financiera'} aria-valuemin={score === null ? undefined : 0} aria-valuemax={score === null ? undefined : 100} aria-valuenow={score ?? undefined}>
    <div className="grid size-full place-content-center rounded-full bg-card text-center" aria-hidden="true">
      <span className={cn('leading-none font-extrabold tracking-tight tabular-nums', compact ? 'text-2xl' : 'text-5xl')} style={{ color }}>{score ?? '—'}</span>
      <span className="mt-1 text-xs text-muted-foreground">{score === null ? 'Sin nota' : 'de 100'}</span>
    </div>
  </div>
}

export function HealthSummary({ report, difference, onMethod, onQuality }: { report: FinancialHealthAssessment; difference: number | null; onMethod: () => void; onQuality: () => void }) {
  const { quality } = report
  const descriptions: Record<FinancialHealthStatus, string> = {
    'Muy favorable': 'Varios pilares muestran resultados favorables en los registros evaluados.',
    Favorable: 'Los registros muestran un resultado favorable con aspectos que puedes revisar.',
    'En desarrollo': 'Los pilares muestran resultados distintos. Explora las acciones compatibles con tus registros.',
    'Requiere atención': 'Revisa primero los pilares con menor resultado y los compromisos cercanos.',
    'Atención prioritaria': 'Consulta el dinero libre y los próximos pagos para identificar por dónde empezar.',
  }
  return <section aria-label="Indicador de salud financiera" className="panel flex min-w-0 flex-wrap items-center gap-5 bg-linear-to-br from-card via-card to-[#18263c] p-4 sm:gap-7 sm:p-5">
    <FinancialHealthGauge score={report.score} status={report.status} />
    <div className="min-w-0 flex-1 basis-52">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">Puntuación financiera</h2><span className="rounded-md bg-budget-time/12 px-2 py-1 text-xs font-semibold text-blue-200">{qualityLabels[quality.state]}</span></div>
      <p className="mt-1 font-semibold" style={{ color: report.status ? tones[report.status] : undefined }}>{report.status ?? 'Puntuación global no disponible'}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{report.status ? descriptions[report.status] : `Hay ${quality.available} de 5 pilares con datos. El detalle muestra qué información falta.`}</p>
      <dl className="mt-3 grid gap-2 text-xs min-[480px]:grid-cols-2">
        <div><dt className="text-muted-foreground">Período evaluado</dt><dd className="font-semibold">{healthRange(report.range)}</dd></div>
        <div><dt className="text-muted-foreground">Variación comparable</dt><dd className="font-semibold">{changeText(difference)}</dd></div>
        <div><dt className="text-muted-foreground">Fecha de evaluación</dt><dd className="font-semibold">{healthDate(report.evaluatedOn)}</dd></div>
        <div><dt className="text-muted-foreground">Cobertura de ponderaciones</dt><dd className="font-semibold">{metric(quality.coverage)} %</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={onQuality}>Explicar el resultado</Button><Button variant="ghost" size="sm" onClick={onMethod}>Ver metodología</Button></div>
    </div>
  </section>
}

function pillarMetric(id: PillarId, report: FinancialHealthAssessment) {
  const data = report.indicators
  switch (id) {
    case 'savings': return `Tasa de ahorro · ${percentage(data.savingsRate)}`
    case 'budget': return `Gasto cubierto · ${percentage(data.budgetCoverage)}`
    case 'balance': return data.cashFlow ? `${data.cashFlow.safe} de ${data.cashFlow.total} cierres sin déficit` : 'Proyección no disponible'
    case 'micro': return `Participación prescindible · ${percentage(data.classifiedCount > 0 ? data.discretionaryShare : null)}`
    case 'payments': {
      if (data.payments.unknown) return 'Vencimiento histórico indeterminado'
      const total = data.payments.timely + data.payments.late + data.payments.overdue
      return total ? `${data.payments.timely} de ${total} pagos a tiempo` : 'Sin pagos evaluables'
    }
  }
}

export function HealthPillarCard({ pillar, report, change, onDetail }: { pillar: FinancialHealthPillar; report: FinancialHealthAssessment; change: number | null; onDetail: (trigger: HTMLElement) => void }) {
  const { name, icon: Icon, href, action } = pillarContent[pillar.id]
  return <article aria-label={name} className="panel flex min-w-0 flex-col gap-2.5 p-3.5">
    <div className="flex items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-300" /><h3 className="font-bold leading-tight">{name}</h3></div>
    <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"><span>Peso {metric(pillar.weight)} %</span><span>{pillar.state === 'provisional' && 'Provisional'}</span></p>
    <p className="text-lg font-extrabold tabular-nums">{pillar.score === null ? 'No disponible' : `${metric(pillar.score)} / 100`}</p>
    {pillar.score !== null && <progress aria-label={`Puntuación de ${name}`} value={pillar.score} max={100} className="health-pillar-progress h-1.5 w-full overflow-hidden rounded-full" />}
    <p className="text-xs font-semibold text-blue-200">{pillarMetric(pillar.id, report)}</p>
    <p className="text-xs text-muted-foreground">{pillar.points === null ? 'Puntos sin calcular' : `${metric(pillar.points)} de ${pillar.weight} puntos ponderados`} · {changeText(change)}</p>
    {pillar.reason && <p className="text-xs leading-relaxed text-muted-foreground">{pillar.reason}</p>}
    <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
      <Button variant="outline" size="sm" onClick={event => onDetail(event.currentTarget)}>Ver detalle<span className="sr-only"> de {name}</span></Button>
      <a className="text-xs font-semibold text-emerald-200 hover:underline" href={href}>{action}</a>
    </div>
  </article>
}

export function HealthMetrics({ report, hidden }: { report: FinancialHealthAssessment; hidden: boolean }) {
  const data = report.indicators
  const metrics = [
    ['Tasa de ahorro', percentage(data.savingsRate)], ['Balance neto del período', money(data.net, hidden)], ['Saldo registrado al corte', money(data.registered, hidden)],
    ['Dinero libre al corte', money(data.free, hidden)], ['Dinero reservado', money(data.reserved, hidden)], ['Progreso de metas en curso', percentage(data.goalProgress === null ? null : data.goalProgress / 100)],
    ['Presupuesto consumido', money(data.budgetedSpend, hidden)], ['Gasto sin presupuesto', money(data.unbudgetedSpend, hidden)], ['Gastos prescindibles', money(data.discretionary, hidden)],
    ['Pagos vencidos al corte', String(data.overdue)], ['Saldo libre mínimo proyectado', money(data.cashFlow?.minimum ?? null, hidden)],
    ['Meses de fondo de emergencia', data.emergencyMonths === null ? 'Faltan datos del fondo y de gastos esenciales' : metric(data.emergencyMonths)],
  ]
  return <section aria-label="Indicadores complementarios" className="panel p-4 sm:p-5">
    <h2 className="text-lg font-bold">Indicadores complementarios</h2>
    <dl className="mt-3 grid gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-border p-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-semibold wrap-anywhere tabular-nums">{value}</dd></div>)}</dl>
    <div className="mt-2 rounded-lg border border-border p-2.5">
      <h3 className="text-xs text-muted-foreground">Próximos vencimientos desde el corte</h3>
      {data.upcoming.length ? <ul className="mt-1 grid gap-1.5 text-sm sm:grid-cols-3">
        {data.upcoming.map(item => <li key={item.id}><a className="font-semibold wrap-anywhere hover:underline" href={`#compromisos?${new URLSearchParams({ compromiso: item.id })}`}>{healthDate(item.dueDate)} · {item.name}</a></li>)}
      </ul> : <p className="mt-1 text-sm font-semibold">Sin próximos compromisos registrados</p>}
    </div>
  </section>
}

export function ImprovementPlan({ items, hidden }: { items: FinancialHealthRecommendation[]; hidden: boolean }) {
  return <section aria-labelledby="improvement-title" className="panel p-4 sm:p-5">
    <h2 id="improvement-title" tabIndex={-1} className="scroll-mt-24 text-lg font-bold">Plan de mejora</h2>
    <p className="mt-0.5 text-xs text-muted-foreground">Acciones sugeridas según los registros del período.</p>
    {items.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Aún faltan datos para proponer una acción relevante.</p>}
    {items.length > 0 && <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">{items.map(item =>
      <article className="min-w-0 rounded-xl border border-border bg-secondary/45 p-3.5" key={item.id}>
        <div className="flex flex-wrap items-center justify-between gap-2"><span className={cn('rounded px-1.5 py-1 text-[11px] font-semibold', item.priority === 'Alta' ? 'bg-warning/12 text-amber-200' : 'bg-budget-time/12 text-blue-200')}>Prioridad {item.priority.toLocaleLowerCase('es')}</span><span className="text-xs text-muted-foreground">{pillarContent[item.pillar].short}</span></div>
        <h3 className="mt-2 text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
        <p className="mt-2 text-xs font-semibold">{item.evidence}{item.count !== undefined ? ` · ${metric(item.count)}` : ''}{item.amount !== undefined ? ` · ${formatMoney(item.amount, hidden)}` : ''}{item.date ? ` · ${healthDate(item.date)}` : ''}</p>
        <p className="mt-1 text-xs text-muted-foreground">{item.benefit}</p>
        <a className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-200 hover:underline" href={item.href}>{item.action}<ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
      </article>)}</div>}
  </section>
}

function formulaText(method: FinancialHealthMethodology) {
  return {
    savings: `Excedente ÷ ingresos efectivos. La puntuación divide esa tasa por la referencia de ${percentage(method.savingsReference)} y multiplica por 100.`,
    budget: `Cada presupuesto parte en 100. Se descuenta proporcionalmente el exceso sobre su límite. El resultado pondera cada presupuesto por su límite. Por debajo de ${percentage(method.budgetCoverageMinimum)} de cobertura, el resultado es provisional.`,
    balance: `Cierres sin déficit de dinero libre ÷ ${method.horizon} días × 100. Es una proyección según los compromisos registrados. El escenario conservador prescinde de cobros pendientes.`,
    micro: `100 × (1 − participación prescindible ÷ ${percentage(method.discretionaryReference)}). Se usan las marcas manuales dentro del gasto efectivo.`,
    payments: 'Pagos confirmados a tiempo ÷ pagos evaluables × 100. La fecha efectiva determina la puntualidad.',
  } satisfies Record<PillarId, string>
}

export function HealthExplanation({ mode, report, method, hidden, onClose, onCloseAutoFocus }: {
  mode: 'method' | 'quality' | PillarId; report: FinancialHealthAssessment; method: FinancialHealthMethodology; hidden: boolean; onClose: () => void; onCloseAutoFocus: (event: Event) => void;
}) {
  const categoryName = useCategoryName()
  const pillar = report.pillars.find(item => item.id === mode)
  const formulas = formulaText(method)
  const data = report.indicators
  const details: Record<PillarId, [string, string][]> = {
    savings: [['Ingresos efectivos', money(data.income, hidden)], ['Gastos efectivos', money(data.expense, hidden)], ['Tasa registrada', percentage(data.savingsRate)]],
    budget: [['Límites', money(data.budgetLimit, hidden)], ['Gasto cubierto', percentage(data.budgetCoverage)], ['Gasto sin presupuesto', money(data.unbudgetedSpend, hidden)], ['Categorías sin presupuesto', data.unbudgetedCategories.length ? data.unbudgetedCategories.map(categoryName).join(', ') : 'Ninguna registrada'], ['Presupuestos excedidos', String(data.exceeded)], ['Presupuestos con riesgo', String(data.budgetRisk)]],
    balance: [['Dinero libre inicial', money(data.free, hidden)], ['Reservas', money(data.reserved, hidden)], ['Mínimo previsto', money(data.cashFlow?.minimum ?? null, hidden)], ['Mínimo del escenario conservador', money(data.conservative?.minimum ?? null, hidden)], ['Cierres sin déficit en el escenario conservador', data.conservative ? `${data.conservative.safe} de ${data.conservative.total}` : 'No disponible']],
    micro: [['Prescindible registrado', money(data.discretionary, hidden)], ['Gastos revisados', String(data.classifiedCount)], ['Gastos candidatos por revisar', `${data.reviewCount} · ${percentage(data.reviewShare)} del gasto por cantidad`]],
    payments: data.payments.unknown ? [['Datos de pago', 'Vencimiento histórico indeterminado']] : [['A tiempo', String(data.payments.timely)], ['Confirmados con atraso', String(data.payments.late)], ['Vencidos sin confirmar', String(data.payments.overdue)]],
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent className={mobileDrawer} onCloseAutoFocus={onCloseAutoFocus}>
    <DialogTitle className="pr-8 text-xl font-bold">{pillar ? pillarContent[pillar.id].name : mode === 'method' ? 'Metodología de evaluación' : 'Disponibilidad y calidad de datos'}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">{healthRange(report.range)} · {method.version} · {report.timeZone}</DialogDescription>
    {mode === 'method' && <div className="mt-4 space-y-3 text-sm">
      <p>La evaluación orientativa usa cinco pilares. Cada puntuación se acota de 0 a 100 y se multiplica por su peso. Se suman los cinco resultados y se redondea la puntuación final. En evaluaciones parciales, se muestran solo los pilares disponibles.</p>
      <ul className="space-y-2">{report.pillars.map(item => <li key={item.id}><strong>{pillarContent[item.id].name} · {item.weight} %</strong><p className="text-muted-foreground">{formulas[item.id]}</p></li>)}</ul>
    </div>}
    {mode === 'quality' && <div className="mt-4 space-y-3 text-sm">
      <p>{qualityLabels[report.quality.state]} · {report.quality.coverage} % del peso tiene datos.</p>
      <ul className="space-y-2">{report.pillars.map(item => <li key={item.id}><strong>{pillarContent[item.id].name}</strong><p className="text-muted-foreground">{item.reason ?? 'Datos disponibles para el período.'}</p></li>)}</ul>
      {report.quality.notes.map(note => <p key={note} className="rounded-lg bg-secondary p-2 text-muted-foreground">{note}</p>)}
    </div>}
    {pillar && <div className="mt-4 space-y-3 text-sm">
      <p>{formulas[pillar.id]}</p>
      {pillar.reason && <p className="text-amber-200">{pillar.reason}</p>}
      <dl className="grid gap-2 sm:grid-cols-2">{details[pillar.id].map(([label, value]) => <div key={label} className="rounded-lg border border-border p-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold wrap-anywhere">{value}</dd></div>)}</dl>
      <a className="inline-block font-semibold text-emerald-200 hover:underline" href={pillarContent[pillar.id].href} onClick={onClose}>{pillarContent[pillar.id].action}</a>
    </div>}
    <Button className="mt-4" variant="outline" onClick={onClose}>Volver</Button>
  </DialogContent></Dialog>
}
