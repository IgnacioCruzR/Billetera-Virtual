import { useEffect, useRef, useState } from 'react'
import { BookOpen, Eye, EyeOff, FlaskConical, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { HealthCharts } from './health-charts'
import type { FinancialHealthRepository, HealthDataState } from './health-data'
import { healthPeriods, type FinancialHealthPeriod, type PillarId } from './health-model'
import { HealthExplanation, HealthMetrics, HealthPillarCard, HealthSummary, ImprovementPlan } from './health-overview'
import { HealthSimulator } from './health-simulator'

type Explanation = 'method' | 'quality' | PillarId
export default function FinancialHealthPage({ data, repository, period, hidden, initialReduction, onPeriod, onPrivacy, onRetry }: {
  data: HealthDataState; repository: FinancialHealthRepository; period: FinancialHealthPeriod; hidden: boolean;
  initialReduction?: number;
  onPeriod: (period: FinancialHealthPeriod) => void; onPrivacy: () => void; onRetry: () => void;
}) {
  const [dialog, setDialog] = useState<Explanation | null>(null)
  const [simulate, setSimulate] = useState(initialReduction !== undefined)
  const focus = useRef<HTMLElement | null>(null)
  const simulatorButton = useRef<HTMLButtonElement>(null)
  const pageHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { pageHeading.current?.focus({ preventScroll: true }) }, [])
  function open(value: Explanation, trigger: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
    focus.current = trigger
    setDialog(value)
  }
  function jump(id: string) {
    const heading = document.getElementById(id)
    heading?.focus({ preventScroll: true })
    heading?.scrollIntoView({ block: 'start' })
  }
  return <main id="salud" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="financial-health-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 ref={pageHeading} id="financial-health-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Salud financiera</h1><p className="mt-1 text-sm text-muted-foreground">Comprende tus hábitos y construye un futuro financiero saludable.</p></div>
      <Button variant="outline" onClick={onPrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
    </div>
    <div className="panel flex flex-wrap items-end justify-between gap-3 p-3">
      <Field label="Período de salud financiera">{id => <Select id={id} value={period} onChange={event => onPeriod(event.target.value as FinancialHealthPeriod)}>{healthPeriods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</Select>}</Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={data.status !== 'ready'} onClick={event => open('method', event.currentTarget)}><BookOpen aria-hidden="true" />Metodología</Button>
        <Button variant="outline" size="sm" disabled={data.status !== 'ready'} onClick={() => jump('improvement-title')}><ListChecks aria-hidden="true" />Plan de mejora</Button>
        <Button ref={simulatorButton} disabled={data.status !== 'ready'} size="sm" aria-expanded={simulate} onClick={() => {
          setSimulate(true); requestAnimationFrame(() => jump('health-simulator-title'))
        }}><FlaskConical aria-hidden="true" />Simular cambios</Button>
      </div>
    </div>
    {data.status === 'loading' && <div role="status" aria-label="Cargando evaluación" className="space-y-3"><div className="panel h-50 animate-pulse bg-accent" /><div className="panel h-32 animate-pulse bg-accent" /></div>}
    {data.status === 'error' && <div role="alert" className="panel p-4"><p className="text-sm">No se pudo calcular la evaluación con los datos disponibles.</p><Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>Reintentar</Button></div>}
    {data.status === 'ready' && <>
      <HealthSummary report={data.report} difference={data.history.difference} onMethod={() => open('method')} onQuality={() => open('quality')} />
      {data.report.indicators.income === 0 && data.report.indicators.expense === 0 && <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">El período aún no tiene ingresos ni gastos efectivos registrados.</p>}
      {data.report.quality.notes.length > 0 && <p className="rounded-lg border border-border bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">{data.report.quality.notes.join(' ')}</p>}
      {simulate && <HealthSimulator key={period} base={data.report} repository={repository} hidden={hidden} initialReduction={initialReduction} onClose={() => { setSimulate(false); simulatorButton.current?.focus() }} />}
      <section aria-labelledby="pillars-title">
        <h2 id="pillars-title" className="mb-2 text-lg font-bold">Pilares de la evaluación</h2>
        <div className="grid gap-2.5 min-[480px]:grid-cols-2 lg:grid-cols-3 min-[88rem]:grid-cols-5">{data.report.pillars.map(item =>
          <HealthPillarCard key={item.id} pillar={item} report={data.report} change={data.history.pillarChanges[item.id]} onDetail={trigger => open(item.id, trigger)} />)}</div>
      </section>
      <HealthCharts report={data.report} history={data.history} method={repository.methodology} hidden={hidden} />
      <ImprovementPlan items={data.recommendations} hidden={hidden} />
      <HealthMetrics report={data.report} hidden={hidden} />
      {dialog && <HealthExplanation mode={dialog} report={data.report} method={repository.methodology} hidden={hidden} onClose={() => setDialog(null)} onCloseAutoFocus={event => {
        event.preventDefault()
        if (focus.current?.isConnected) focus.current.focus({ preventScroll: true })
        else document.getElementById('financial-health-title')?.focus({ preventScroll: true })
      }} />}
    </>}
  </main>
}
