import { useState, type FormEvent, type RefObject } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { formatDate, formatMoney } from '@/lib/utils'
import { shiftDays } from '@/lib/calendar'
import { projectionHorizons } from '@/features/commitments/commitment-model'
import { healthPeriods } from '@/features/health/health-model'
import { healthRange } from '@/features/health/health-overview'
import { healthWindows } from '@/features/health/health-assessment'
import { analysisCatalog, type AnalysisContext, type AnalysisDraft, type FinancialAnalysisConsent, type FinancialAnalysisRequest, type FinancialAnalysisType } from './assistant-model'
import { eligibleAccounts, eligibleGoals, initialDraft, validateAnalysis } from './assistant-request'

import { assistantDrawer, ConsentOptions } from './assistant-consent'
import { privateText } from './assistant-result-labels'

export function AnalysisConfiguration({ type, context, hidden, consent, busy, returnFocus, onClose, onPreference, onGenerate, previous }: {
  type: FinancialAnalysisType; context: AnalysisContext; hidden: boolean; consent: FinancialAnalysisConsent; busy: boolean;
  returnFocus: RefObject<HTMLElement | null>; onClose: () => void; onPreference: (value: 'allowed' | 'declined') => void;
  onGenerate: (request: FinancialAnalysisRequest, preference: FinancialAnalysisConsent['preference']) => void;
  previous?: FinancialAnalysisRequest;
}) {
  const [draft, setDraft] = useState<AnalysisDraft>(() => previous?.type === type
    ? Object.fromEntries(Object.entries(previous.parameters).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))
    : initialDraft(type, context.today, context.defaults))
  const [errors, setErrors] = useState<Partial<Record<keyof AnalysisDraft | 'type', string>>>({})
  const [preview, setPreview] = useState<FinancialAnalysisRequest | null>(null)
  const [authorizing, setAuthorizing] = useState(false)
  const analysis = analysisCatalog[type]
  const update = (name: keyof AnalysisDraft, value: string) => {
    setDraft(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: undefined }))
  }
  function review(event: FormEvent) {
    event.preventDefault()
    const result = validateAnalysis(type, draft, context, crypto.randomUUID())
    if (result.request) setPreview(result.request)
    else setErrors(result.errors)
  }
  function generate(preference: FinancialAnalysisConsent['preference']) {
    if (!preview || busy) return
    const result = validateAnalysis(type, draft, context, preview.requestId)
    if (!result.request) { setErrors(result.errors); setPreview(null); setAuthorizing(false); return }
    onGenerate(result.request, preference)
  }
  function input(name: keyof AnalysisDraft, label: string, properties: { type?: string; min?: string; max?: string; maxLength?: number; monetary?: boolean } = {}) {
    const { monetary, ...attributes } = properties
    return <Field label={label} error={errors[name]}>{(id, accessibility) =>
      <Input {...attributes} {...accessibility} id={id} type={monetary ? (hidden ? 'password' : 'text') : attributes.type} inputMode={monetary ? 'numeric' : undefined} value={draft[name] ?? ''} onChange={event => update(name, event.target.value)} />}</Field>
  }
  function select(name: keyof AnalysisDraft, label: string, options: readonly { id: string; label: string }[]) {
    return <Field label={label} error={errors[name]}>{(id, accessibility) =>
      <Select {...accessibility} id={id} value={draft[name] ?? ''} onChange={event => update(name, event.target.value)}>
        {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </Select>}</Field>
  }
  const payment = type === 'purchase'
  const savings = type === 'savings'
  const categories = context.categories.filter(item => type !== 'purchase' || item.status !== 'archivada').map(item => ({ id: item.id, label: item.name }))
  const accounts = eligibleAccounts(context)
  const goals = eligibleGoals(context)
  const title = authorizing ? 'Autorización de IA externa' : preview ? 'Revisar solicitud' : 'Configurar análisis'
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent className={assistantDrawer} onCloseAutoFocus={event => {
    event.preventDefault()
    returnFocus.current?.focus({ preventScroll: true })
  }}>
    <DialogTitle className="pr-8 text-xl font-bold">{title}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">{analysis.title} · {analysis.description}</DialogDescription>
    {authorizing ? <>
      <ConsentOptions preference={consent.preference} onChoose={value => { onPreference(value); generate(value) }} />
      <Button className="mt-3" variant="ghost" onClick={() => setAuthorizing(false)}><ArrowLeft aria-hidden="true" /> Volver a la vista previa</Button>
    </> : preview ? <div className="mt-4 space-y-4">
      <AnalysisDataPreview context={context} hidden={hidden} request={preview} />
      <p className="rounded-lg border border-border bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">Una integración de IA externa podría procesar los datos necesarios del análisis. Este informe de demostración se calcula localmente.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPreview(null)}><ArrowLeft aria-hidden="true" /> Editar parámetros</Button>
        <Button disabled={busy} onClick={() => consent.preference === 'unset' ? setAuthorizing(true) : generate(consent.preference)}>Generar análisis</Button>
      </div>
    </div> : <form className="mt-4 space-y-4" onSubmit={review} noValidate>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {!payment && !savings && select('period', 'Período financiero', type === 'opportunities' ? healthPeriods.slice(0, 3) : type === 'budgets' ? healthPeriods.slice(0, 2) : healthPeriods)}
        {(type === 'budgets' || type === 'opportunities') && select('categoryId', 'Categoría de gasto', [{ id: '', label: 'Todas las categorías' }, ...categories])}
        {type === 'opportunities' && input('reduction', 'Reducción prescindible (%)', { type: 'number', min: '0', max: '100' })}
        {payment && <>
          {input('name', 'Nombre de la compra (opcional)', { maxLength: 120, type: hidden ? 'password' : 'text' })}
          {input('amount', 'Monto de la compra (CLP)', { monetary: true, maxLength: 12 })}
          {input('date', 'Fecha prevista', { type: 'date', min: context.today, max: shiftDays(context.today, Number(draft.horizon ?? 30)) })}
          {select('accountId', 'Cuenta de origen', [{ id: '', label: 'Selecciona una cuenta' }, ...accounts.map(item => ({ id: item.id, label: hidden ? 'Cuenta ' + (accounts.indexOf(item) + 1) : item.name }))])}
          {select('categoryId', 'Categoría de gasto', [{ id: '', label: 'Selecciona una categoría' }, ...categories])}
          {input('minimumFree', 'Reserva mínima libre (CLP)', { monetary: true, maxLength: 12 })}
          {select('horizon', 'Horizonte de proyección', projectionHorizons.map(id => ({ id: String(id), label: id + ' días' })))}
        </>}
        {savings && <>
          {select('goalId', 'Meta de ahorro', [{ id: '', label: 'Selecciona una meta' }, ...goals.map((item, index) => ({ id: item.id, label: hidden ? 'Meta ' + (index + 1) : item.name }))])}
          {input('targetDate', 'Fecha objetivo opcional', { type: 'date', min: context.today })}
          {input('monthly', 'Aporte mensual hipotético (CLP)', { monetary: true, maxLength: 12 })}
          {select('scenarioId', 'Escenario de ahorro adicional', [{ id: '', label: 'Sin escenario adicional' }, ...context.scenarios.map((item, index) => ({ id: item.id, label: hidden ? 'Escenario ' + (index + 1) : item.name }))])}
        </>}
      </div>
      {payment && !accounts.length && <p role="status" className="text-sm text-warning">La simulación requiere una cuenta activa.</p>}
      {savings && !goals.length && <p role="status" className="text-sm text-warning">Primero registra una meta en Metas de ahorro.</p>}
      {savings && <p className="text-xs leading-relaxed text-muted-foreground">Las hipótesis de fecha y aporte son opcionales. Puedes llevar una estimación desde el <a className="font-semibold text-emerald-200 hover:underline" href="#hormiga?simulador=prescindibles" onClick={onClose}>simulador de Gastos hormiga</a> para compararla con el plan base.</p>}
      <Button type="submit"><ArrowRight aria-hidden="true" /> Revisar solicitud</Button>
    </form>}
  </DialogContent></Dialog>
}

function AnalysisDataPreview({ request, context, hidden }: { request: FinancialAnalysisRequest; context: AnalysisContext; hidden: boolean }) {
  const period = 'period' in request.parameters ? request.parameters.period : 'month'
  const date = (value: string) => formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' })
  const range = request.type === 'purchase' ? { from: context.today, to: shiftDays(context.today, request.parameters.horizon) } : healthWindows(period, context.today).range
  const rows: [string, string][] = [['Período evaluado', healthRange(range)]]
  switch (request.type) {
    case 'purchase': {
      const item = request.parameters
      rows.push(['Cuenta', hidden ? privateText : context.records.accounts.find(account => account.id === item.accountId)?.name ?? 'No disponible'],
        ['Monto', formatMoney(item.amount, hidden)], ['Fecha de compra', date(item.date)], ['Reserva mínima', formatMoney(item.minimumFree, hidden)], ['Horizonte', item.horizon + ' días'])
      if (item.name) rows.push(['Compra', hidden ? privateText : item.name])
      break
    }
    case 'savings': {
      const item = request.parameters
      const goal = context.records.savingsGoals.find(goal => goal.id === item.goalId)
      const scenario = context.scenarios.find(scenario => scenario.id === item.scenarioId)
      rows.push(['Meta', hidden ? privateText : goal?.name ?? 'No disponible'],
        ['Aporte mensual', item.monthly !== undefined ? formatMoney(item.monthly, hidden) : 'Plan registrado o aporte habitual, si hay datos'],
        ['Fecha objetivo', item.targetDate || goal?.targetDate ? date(item.targetDate || goal!.targetDate) : 'Sin fecha objetivo'],
        ['Escenario adicional', scenario ? hidden ? privateText : scenario.name : 'Sin escenario adicional'])
      break
    }
    case 'opportunities': rows.push(['Reducción prescindible', request.parameters.reduction + ' %']); break
  }
  if ('categoryId' in request.parameters) {
    const { categoryId } = request.parameters
    rows.push(['Categoría', context.categories.find(item => item.id === categoryId)?.name ?? 'Todas las categorías'])
  }
  return <>
    <dl className="grid gap-2 sm:grid-cols-2">{rows.map(([label, value]) => <div className="min-w-0 rounded-lg border border-border p-2.5" key={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 text-sm font-semibold wrap-anywhere">{value}</dd>
    </div>)}</dl>
    <section aria-label="Información que se utilizará"><h3 className="text-sm font-semibold">Información que se utilizará</h3>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{analysisCatalog[request.type].sources.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
  </>
}
