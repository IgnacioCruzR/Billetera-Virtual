import type { ReactNode } from 'react'
import { Activity, ArrowUpRight, ChartNoAxesCombined, CircleCheck, ClipboardList, FileCheck2, Info, ShieldAlert, Sparkles } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/utils'
import { healthRange, metric } from '@/features/health/health-overview'
import { resolveAction } from './assistant-actions'
import { generatedLabel, privateText, reportHref, sourceLabel } from './assistant-result-labels'
import { analysisCatalog, analysisStatusLabels, type AnalysisContext, type FinancialAnalysisEvidence, type FinancialAnalysisHistoryItem, type FinancialAnalysisMetric, type FinancialAnalysisRecommendation, type PurchaseImpactResult } from './assistant-model'

const asDate = (date: string | null) => date ? formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No disponible'
const maskedNarrative = 'Interpretación oculta en modo privacidad.'

function metricValue(item: FinancialAnalysisMetric, hidden: boolean) {
  if (item.value === null) return 'No disponible'
  switch (item.unit) {
    case 'clp': return formatMoney(item.value, hidden)
    case 'date': return asDate(item.value)
    case 'percent': return metric(item.value) + ' %'
    case 'score': return metric(item.value) + ' / 100'
    case 'points': return metric(item.value) + ' pts'
    default: return metric(item.value)
  }
}

function Section({ title, icon: Icon, children, tone = 'text-blue-300' }: { title: string; icon: typeof Activity; children: ReactNode; tone?: string }) {
  return <section className="panel min-w-0 p-4 sm:p-5" aria-label={title}>
    <h3 className="flex items-start gap-2 text-base font-bold"><Icon aria-hidden="true" className={'mt-0.5 size-4.5 shrink-0 ' + tone} />{title}</h3>
    {children}
  </section>
}

function Evidence({ item, labels }: { item: FinancialAnalysisEvidence; labels: Map<string, string> }) {
  return <div className="min-w-0">
    <p className="text-sm leading-relaxed wrap-anywhere">{item.text}</p>
    {item.metricIds.length > 0 && <p className="mt-1 text-xs leading-relaxed text-muted-foreground wrap-anywhere">Indicadores · {item.metricIds.map(id => labels.get(id)).filter(Boolean).join(', ')}</p>}
  </div>
}

function Recommendation({ item, context, labels, restrict }: { item: FinancialAnalysisRecommendation; context: AnalysisContext; labels: Map<string, string>; restrict: boolean }) {
  const action = resolveAction(item.action, context)
  return <article className="min-w-0 rounded-xl border border-border bg-secondary/45 p-3.5">
    <p className="text-xs font-semibold text-muted-foreground">Prioridad {item.priority.toLocaleLowerCase('es')}</p>
    <h4 className="mt-1 text-sm font-bold wrap-anywhere">{restrict ? 'Recomendación' : item.title}</h4>
    {!restrict && <><p className="mt-1 text-sm leading-relaxed text-muted-foreground wrap-anywhere">{item.description}</p>
      <div className="mt-2"><Evidence item={item.evidence} labels={labels} /></div>
      {item.benefit && <p className="mt-1 text-xs text-muted-foreground wrap-anywhere">{item.benefit}</p>}
    </>}
    {action && <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-200 hover:underline" href={action.href}>{action.label}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" /></a>}
  </article>
}

function PurchaseScenarioComparison({ result, hidden }: { result: PurchaseImpactResult; hidden: boolean }) {
  const scenarios = [
    { label: 'Con cobros previstos', quote: result.expected },
    { label: 'Conservador · sin cobros previstos', quote: result.conservative },
  ]
  return <Section title="Comparación de la compra hipotética" icon={ChartNoAxesCombined}>
    <p className="mt-1 text-sm text-muted-foreground">Se simula un pago el {asDate(result.date)}. Reserva mínima deseada · {formatMoney(result.minimumFree, hidden)}.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {scenarios.map(({ label, quote }) => <div key={label} className="min-w-0 rounded-xl border border-border bg-secondary/45 p-3">
        <h4 className="text-sm font-bold">{label}</h4>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          {([
            ['Saldo libre al cierre de compra', formatMoney(quote.after, hidden)],
            ['Mínimo durante el horizonte', formatMoney(quote.minimum, hidden)],
            ['Primer déficit', quote.firstDeficit ? asDate(quote.firstDeficit) : 'Sin déficit previsto'],
            ['Margen mínimo sobre la reserva', formatMoney(quote.minimumMargin, hidden)],
            ['Fecha del mínimo', asDate(quote.minimumDate)],
            ['Saldo libre final', formatMoney(quote.final, hidden)],
          ] as const).map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-muted-foreground">{name}</dt><dd className="mt-0.5 font-semibold wrap-anywhere">{value}</dd></div>)}
        </dl>
      </div>)}
    </div>
    {result.budget && <p className="mt-3 text-sm wrap-anywhere text-muted-foreground">Margen del presupuesto · {formatMoney(result.budget.remainingBefore, hidden)} antes y {formatMoney(result.budget.remainingAfter, hidden)} después.</p>}
    {!hidden && <div className="mt-4 h-52" aria-label="Gráfico de dinero libre por día">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={result.trend} margin={{ top: 10, left: 0, right: 10 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis dataKey="date" tickFormatter={value => formatDate(value, { day: 'numeric', month: 'short' })} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} minTickGap={22} />
        <YAxis width={61} tickFormatter={formatCompactMoney} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
        <Tooltip formatter={value => formatMoney(Number(value), false)} labelFormatter={value => asDate(String(value))} contentStyle={{ color: 'var(--foreground)', background: 'var(--card)', borderColor: 'var(--border)', fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={0} stroke="#f87171" strokeDasharray="2 4" />
        <Line name="Con cobros" dataKey="expected" type="stepAfter" dot={false} stroke="#60A5FA" strokeWidth={2} isAnimationActive={false} />
        <Line name="Sin cobros" dataKey="conservative" type="stepAfter" dot={false} stroke="#FBBF24" strokeWidth={2} strokeDasharray="5 3" isAnimationActive={false} />
      </LineChart></ResponsiveContainer>
    </div>}
    {hidden && <p className="mt-3 text-xs text-muted-foreground">Gráfico de importes oculto por privacidad.</p>}
  </Section>
}

export function AnalysisReport({ item, context, hidden, stale, onRegenerate, onPurchaseForm }: {
  item: FinancialAnalysisHistoryItem; context: AnalysisContext; hidden: boolean; stale: boolean;
  onRegenerate?: () => void; onPurchaseForm?: () => void;
}) {
  const report = item.result
  const restrict = hidden && report.origin === 'ai'
  const labels = new Map(report.metrics.map((item, index) => [item.id, restrict ? 'Indicador ' + (index + 1) : item.label]))
  const proof = (item: FinancialAnalysisEvidence, index: number) => <li className="rounded-lg border border-border p-2.5" key={index}><Evidence labels={labels} item={restrict || (hidden && item.sensitive) ? { ...item, text: maskedNarrative } : item} /></li>
  return <section className="grid min-w-0 gap-4" aria-labelledby="analysis-report-title">
    <div className="panel min-w-0 border-primary/20 bg-linear-to-br from-card to-[#182a35] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-md bg-primary/12 px-2 py-1 font-semibold text-emerald-200">{sourceLabel(report)}</span>
          <span className="text-muted-foreground">{analysisStatusLabels[report.status]}</span></div>
          <h2 id="analysis-report-title" tabIndex={-1} className="mt-2 scroll-mt-24 text-xl font-bold outline-none">{analysisCatalog[report.type].title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{healthRange(report.range)} · {generatedLabel(report.generatedAt, context.timeZone)}{!restrict && report.templateVersion && ' · ' + report.templateVersion}</p>
        </div>
        {onRegenerate && <Button variant="outline" size="sm" onClick={onRegenerate}>Configurar nuevo análisis</Button>}
      </div>
      {stale && <p className="mt-3 rounded-lg border border-warning/30 bg-warning/8 p-2.5 text-xs text-amber-200">Los datos o el corte cambiaron desde la generación. Este informe conserva el resultado original.</p>}
      <h3 className="mt-4 text-sm font-bold">Resumen ejecutivo</h3>
      <p className="mt-1 text-sm leading-relaxed wrap-anywhere text-muted-foreground">{restrict ? maskedNarrative : report.summary.text || 'El proveedor entregó un informe sin resumen.'}</p>
    </div>
    <Section title="Indicadores utilizados" icon={Activity}>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(['verified', 'hypothesis'] as const).map(source => {
          const readings = report.metrics.filter(item => item.source === source)
          return readings.length ? <div className="min-w-0 rounded-xl border border-border p-3" key={source}>
            <h4 className={'text-sm font-bold ' + (source === 'verified' ? 'text-blue-200' : 'text-indigo-200')}>{source === 'verified' ? 'Datos verificados del sistema' : 'Escenarios y estimaciones'}</h4>
            <dl className="mt-2 grid gap-2 min-[490px]:grid-cols-2">{readings.map(item => <div key={item.id} className="min-w-0 rounded-lg bg-secondary/65 p-2.5">
              <dt className="text-xs wrap-anywhere text-muted-foreground">{labels.get(item.id)}</dt><dd className="mt-0.5 font-semibold tabular-nums wrap-anywhere">{metricValue(item, hidden)}</dd>
            </div>)}</dl>
          </div> : null
        })}
      </div>
      {!report.metrics.length && <p className="mt-2 text-sm text-muted-foreground">El informe no trajo indicadores utilizables.</p>}
    </Section>
    {report.purchase && <PurchaseScenarioComparison result={report.purchase} hidden={hidden} />}
    {onPurchaseForm && <div className="panel min-w-0 p-4 sm:p-5"><h3 className="text-sm font-bold">Registro efectivo por separado</h3>
      <p className="mt-1 text-sm text-muted-foreground">Cuando realices la compra, revisa sus datos y confirma la fecha efectiva en el formulario de Movimientos.</p>
      <Button variant="outline" className="mt-3" onClick={onPurchaseForm}>Abrir formulario de gasto</Button>
    </div>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-3">
      <Section title="Fortalezas" icon={CircleCheck} tone="text-emerald-300">{report.strengths.length ? <ul className="mt-3 grid gap-2">{report.strengths.map(proof)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin fortalezas identificadas con estos datos.</p>}</Section>
      <Section title="Riesgos" icon={ShieldAlert} tone="text-red-300">{report.risks.length ? <ul className="mt-3 grid gap-2">{report.risks.map((item, index) => <li className="rounded-lg border border-border p-2.5" key={index}>
        <p className="mb-1 text-xs font-semibold text-amber-200">Prioridad {item.priority.toLocaleLowerCase('es')}</p><h4 className="mb-1 text-sm font-bold wrap-anywhere">{restrict ? 'Riesgo identificado' : item.title}</h4>
        <Evidence labels={labels} item={restrict ? { ...item.evidence, text: maskedNarrative } : item.evidence} />
      </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin riesgos destacados en el alcance del informe.</p>}</Section>
      <Section title="Oportunidades de mejora" icon={Sparkles} tone="text-indigo-300">{report.opportunities.length ? <ul className="mt-3 grid gap-2">{report.opportunities.map(proof)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin oportunidades observables para este corte.</p>}</Section>
    </div>
    <Section title="Plan de acción" icon={ClipboardList} tone="text-emerald-300">{report.recommendations.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {report.recommendations.map((recommendation, index) => <Recommendation key={index} item={recommendation} labels={labels} context={context} restrict={restrict} />)}
    </div> : <p className="mt-2 text-sm text-muted-foreground">El informe no incluye acciones respaldadas por los datos.</p>}</Section>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Section title="Calidad de datos" icon={FileCheck2}>
        {restrict ? <p className="mt-2 text-sm text-muted-foreground">{maskedNarrative}</p> : <>
          <h4 className="mt-2 text-xs font-bold">Información disponible</h4>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{(report.quality.available.length ? report.quality.available : ['Sin fuentes confirmadas por el informe.']).map((item, index) => <li className="wrap-anywhere" key={index}>{item}</li>)}</ul>
          <h4 className="mt-3 text-xs font-bold">Información faltante</h4>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">{(report.quality.missing.length ? report.quality.missing : ['Sin faltantes señalados para este alcance.']).map((item, index) => <li className="wrap-anywhere" key={index}>{item}</li>)}</ul>
        </>}
      </Section>
      <Section title="Supuestos y limitaciones" icon={Info}>
        {restrict ? <p className="mt-2 text-sm text-muted-foreground">{maskedNarrative}</p> : <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-muted-foreground">
          {[...report.assumptions, ...report.limitations].map((item, index) => <li key={index} className="wrap-anywhere">{item}</li>)}
        </ul>}
      </Section>
    </div>
  </section>
}

export function SessionHistory({ history, hidden, timeZone, contextVersion, active }: {
  history: FinancialAnalysisHistoryItem[]; hidden: boolean; timeZone: string; contextVersion: symbol; active?: string;
}) {
  return <section className="panel min-w-0 p-4 sm:p-5" aria-labelledby="analysis-history-title">
    <h2 id="analysis-history-title" className="text-base font-bold">Informes de esta sesión</h2>
    {!history.length ? <p className="mt-1 text-sm text-muted-foreground">Los análisis generados aparecerán aquí mientras la aplicación permanezca abierta.</p>
      : <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{history.map(({ result, contextVersion: version }) => <li className="min-w-0 rounded-xl border border-border bg-secondary/50 p-3" key={result.requestId}>
        <p className="text-xs text-muted-foreground">{generatedLabel(result.generatedAt, timeZone)} · {analysisStatusLabels[result.status]}</p>
        <h3 className="mt-1 text-sm font-bold">{analysisCatalog[result.type].title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{healthRange(result.range)}{version !== contextVersion && ' · Datos anteriores'}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed wrap-anywhere">{hidden && result.origin === 'ai' ? privateText : result.summary.text}</p>
        <a className="mt-2 inline-block text-sm font-semibold text-emerald-200 hover:underline" aria-current={active === result.requestId ? 'true' : undefined} href={reportHref(result.requestId)}>Ver informe de {analysisCatalog[result.type].title}</a>
      </li>)}</ul>}
  </section>
}
