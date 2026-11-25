import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { ArrowUpRight, ChartNoAxesCombined, CircleDollarSign, Eye, EyeOff, HeartPulse, PiggyBank, ReceiptText, ShieldCheck, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MovementPreset } from '@/features/dashboard/model'
import { AnalysisConfiguration } from './assistant-config'
import { AssistantPreferences } from './assistant-consent'
import { analysisCatalog, analysisTypes, type AnalysisContext, type AnalysisFailureCode, type FinancialAnalysisRequest, type FinancialAnalysisType } from './assistant-model'
import { AnalysisReport, SessionHistory } from './assistant-report'
import { matchesRequestResources } from './assistant-request'
import type { AssistantSession } from './use-assistant-session'

const icons = { situation: ChartNoAxesCombined, opportunities: PiggyBank, purchase: CircleDollarSign, budgets: ReceiptText, health: HeartPulse, savings: Target }
const accent = { situation: 'text-blue-300 bg-blue-400/10', opportunities: 'text-indigo-300 bg-indigo-400/10', purchase: 'text-emerald-300 bg-emerald-400/10', budgets: 'text-blue-300 bg-blue-400/10', health: 'text-emerald-300 bg-emerald-400/10', savings: 'text-indigo-300 bg-indigo-400/10' }
const errors: Record<AnalysisFailureCode, string> = {
  communication: 'No se pudo comunicar con la fuente del análisis.', mcp: 'El agente de análisis no está disponible.',
  provider: 'El proveedor de IA no pudo procesar la solicitud.', timeout: 'Se agotó el tiempo de espera.',
  'rate-limit': 'Se alcanzó el límite de solicitudes. Espera antes de reintentar.',
  cancelled: 'La espera se canceló en esta pantalla.', consent: 'Para usar IA externa necesitas autorizar su procesamiento.',
  invalid: 'Los parámetros cambiaron o la respuesta no contiene un informe utilizable.',
}

export default function FinancialAssistantPage({ context, session, selected, hidden, onPrivacy, onRegister }: {
  context: AnalysisContext; session: AssistantSession; selected: string | null; hidden: boolean;
  onPrivacy: () => void; onRegister: (preset: MovementPreset) => void;
}) {
  const [configuration, setConfiguration] = useState<{ type: FinancialAnalysisType; request?: FinancialAnalysisRequest } | null>(null)
  const [preferences, setPreferences] = useState(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  const pageHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { pageHeading.current?.focus({ preventScroll: true }) }, [])
  const busy = session.run.status === 'processing'
  const report = selected ? session.history.find(item => item.result.requestId === selected) : session.history[0]
  const purchase = report?.request.type === 'purchase' && report.result.purchase && !busy ? report.request.parameters : null
  const canOpenPurchaseForm = purchase && context.records.accounts.some(item => item.id === purchase.accountId && item.status === 'activa')
    && context.categories.some(item => item.id === purchase.categoryId && item.status !== 'archivada')
  const reportId = report?.result.requestId
  const resolved = session.run.status === 'finished' ? session.run.request.requestId : null
  const previousResult = useRef(resolved)
  useEffect(() => {
    const changed = previousResult.current !== resolved
    previousResult.current = resolved
    if (!reportId || (!selected && (!changed || resolved !== reportId))) return
    const frame = requestAnimationFrame(() => {
      const title = document.getElementById('analysis-report-title')
      title?.focus({ preventScroll: true })
      title?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [reportId, resolved, selected])
  function configure(event: MouseEvent<HTMLElement> | null, type: FinancialAnalysisType, request?: FinancialAnalysisRequest) {
    if (session.blocked) return
    previousFocus.current = event?.currentTarget ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setConfiguration({ type, request })
  }
  function prepare(request: FinancialAnalysisRequest) {
    if (!matchesRequestResources(request, context)) configure(null, request.type, request)
    else {
      if (selected) window.location.hash = 'asistente'
      session.generate(request)
    }
  }
  return <main id="asistente" className="dashboard-anchor mx-auto flex max-w-[1600px] min-w-0 flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="assistant-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h1 id="assistant-title" ref={pageHeading} tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Asistente financiero</h1>
        <p className="mt-1 text-sm text-muted-foreground">Transforma tus datos en mejores decisiones.</p></div>
      <Button variant="outline" onClick={onPrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
    </div>
    <section className="panel min-w-0 border-primary/20 bg-linear-to-br from-[#16363b] via-card to-card p-4 sm:p-5" aria-labelledby="assistant-intro">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-primary/20 bg-emerald-400/10 text-emerald-300"><Sparkles aria-hidden="true" className="size-5" /></span>
          <div className="min-w-0"><h2 id="assistant-intro" className="text-lg font-bold">Análisis de tus finanzas</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Elige qué evaluar, revisa las fuentes y recibe un informe con acciones concretas. Los informes de esta demo se calculan localmente con los registros de la aplicación.</p></div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreferences(true)}><ShieldCheck aria-hidden="true" />Privacidad y autorización</Button>
      </div>
    </section>
    {session.blocked && <p role="status" className="panel border-warning/25 p-3 text-sm text-amber-200">
      {session.enabled ? 'La autorización fue revocada. Vuelve a autorizar para solicitar un análisis.' : 'El asistente está desactivado.'}{' '}
      <a className="font-semibold underline" href="#configuracion?seccion=asistente">Revisar configuración de IA</a>
    </p>}
    <section aria-labelledby="analysis-types-title">
      <h2 id="analysis-types-title" className="mb-2 text-lg font-bold">Análisis disponibles</h2>
      <div className="grid min-w-0 gap-2.5 min-[530px]:grid-cols-2 xl:grid-cols-3">
        {analysisTypes.map(type => {
          const item = analysisCatalog[type]
          const Icon = icons[type]
          return <article key={type} className="panel flex min-w-0 flex-col items-start gap-2.5 p-4 sm:p-5">
            <div className="flex items-center gap-2.5"><span className={'grid size-9 shrink-0 place-items-center rounded-lg ' + accent[type]}><Icon className="size-4.5" aria-hidden="true" /></span>
              <h3 className="text-sm font-bold sm:text-base">{item.title}</h3></div>
            <p className="grow text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            <Button aria-label={'Configurar ' + item.title} variant="outline" size="sm" disabled={busy || session.blocked} onClick={event => configure(event, type)}>Configurar <ArrowUpRight aria-hidden="true" /></Button>
          </article>
        })}
      </div>
    </section>
    {session.run.status === 'processing' && <section aria-label="Procesando análisis" className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="font-semibold">Procesando {analysisCatalog[session.run.request.type].title}</p><Button variant="outline" size="sm" onClick={session.cancel}>Cancelar espera</Button></div>
      <div aria-hidden="true" className="mt-3 grid gap-2"><div className="h-5 w-3/4 rounded bg-accent motion-safe:animate-pulse" /><div className="h-5 w-1/2 rounded bg-accent motion-safe:animate-pulse" /></div>
    </section>}
    {session.run.status === 'error' && <section className="panel border-warning/30 p-4" aria-label="Estado de la solicitud">
      <p role="alert" className="text-sm text-amber-200">{errors[session.run.code]}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {session.run.code === 'consent' ? <Button size="sm" onClick={() => setPreferences(true)}>Revisar autorización</Button>
          : session.run.code !== 'rate-limit' && <Button variant="outline" size="sm" onClick={() => session.run.status === 'error' && prepare(session.run.request)}>Reintentar análisis</Button>}
      </div>
    </section>}
    {selected && !report && <p role="status" className="panel p-4 text-sm text-muted-foreground">Ese informe no está disponible en esta sesión. <a href="#asistente" className="font-semibold text-emerald-200 hover:underline">Ver informes recientes</a></p>}
    {report && (!busy || selected) && <AnalysisReport item={report} context={context} hidden={hidden} stale={report.contextVersion !== session.contextVersion}
      onRegenerate={session.blocked ? undefined : () => configure(null, report.request.type, report.request)}
      onPurchaseForm={canOpenPurchaseForm ? () => onRegister({ type: 'gasto', accountId: purchase.accountId, categoryId: purchase.categoryId,
        amount: hidden ? undefined : purchase.amount, description: hidden ? undefined : purchase.name }) : undefined} />}
    <SessionHistory history={session.history} timeZone={context.timeZone} contextVersion={session.contextVersion} active={reportId} hidden={hidden} />
    {configuration && <AnalysisConfiguration type={configuration.type} context={context} hidden={hidden} consent={session.consent} busy={busy} returnFocus={previousFocus} previous={configuration.request}
      onClose={() => setConfiguration(null)} onPreference={session.setPreference} onGenerate={(request, preference) => {
        if (selected) window.location.hash = 'asistente'
        setConfiguration(null)
        session.generate(request, preference)
      }} />}
    {preferences && <AssistantPreferences consent={session.consent} onChoose={preference => { session.setPreference(preference); setPreferences(false) }} onClose={() => setPreferences(false)} />}
  </main>
}
