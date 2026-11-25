import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Coffee, Eye, EyeOff, FlaskConical, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import type { useFinancialRecords } from '@/features/accounts/account-data'
import { parseBudgetPeriod } from '@/features/budgets/budget-calculations'
import { DetectionSettings } from './detection-settings'
import { analyzeMicroExpenses, emptySavingsScenario } from './micro-expense-analysis'
import { MicroExpenseCharts } from './micro-expense-charts'
import { ClassificationDialog, initialMicroFilters, MicroHistory, type ClassificationRequest } from './micro-expense-history'
import type { DateRange, MicroExpenseDetectionConfig, MicroExpenseRecommendation, MicroExpensePeriod, SavingsScenario } from './micro-expense-model'
import { MicroExpenseOverview, MicroExpenseRecommendations, microRecommendations, rangeLabel, SpendingPatterns } from './micro-expense-overview'
import { SavingsSimulator } from './savings-simulator'

function focusSection(id: string) {
  const target = document.getElementById(id)
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({ block: 'start' })
}

export function MicroExpensesPage({ finance, detected, today, criteria, onCriteria, hidden, onTogglePrivacy, query, onMovement, onToast, onUseSavings }: {
  finance: ReturnType<typeof useFinancialRecords>; detected: ReadonlySet<string>; today: string;
  criteria: MicroExpenseDetectionConfig; onCriteria: (criteria: MicroExpenseDetectionConfig) => Promise<void>;
  hidden: boolean; onTogglePrivacy: () => void; query?: string; onMovement: (id: string) => void; onToast: (text: string) => void;
  onUseSavings: (monthly: number, range: DateRange) => void;
}) {
  const params = new URLSearchParams(query)
  const currentMonth = today.slice(0, 7)
  const initialMonth = parseBudgetPeriod(params.get('mes') ?? '')
  const [month, setMonth] = useState(initialMonth && initialMonth <= currentMonth ? initialMonth : '')
  const [range, setRange] = useState<MicroExpensePeriod['range']>('month')
  const [filters, setFilters] = useState(() => ({ ...initialMicroFilters, account: params.get('cuenta') ?? '', category: params.get('categoria') ?? '', includedOnly: params.has('categoria') || params.has('cuenta') }))
  const [showSettings, setShowSettings] = useState(false)
  const [classify, setClassify] = useState<ClassificationRequest | null>(null)
  const [scenario, setScenario] = useState<SavingsScenario | null>(() => params.has('simulador') ? { ...emptySavingsScenario, includeDiscretionary: params.get('simulador') === 'prescindibles' } : null)
  const settingsTrigger = useRef<HTMLButtonElement>(null)
  const simulatorTrigger = useRef<HTMLButtonElement>(null)
  const { records, status } = finance
  const selectedMonth = month || currentMonth
  const analysis = useMemo(() => analyzeMicroExpenses(records.movements, detected, { month: selectedMonth, range }, today), [records.movements, detected, selectedMonth, range, today])
  const mostFrequent = [...analysis.patterns].sort((a, b) => b.count - a.count)[0]

  useLayoutEffect(() => {
    const params = new URLSearchParams(query)
    const target = params.has('simulador') ? 'savings-title' : params.has('categoria') || params.has('cuenta') ? 'micro-history-title' : null
    if (status === 'ready' && target) {
      const frame = requestAnimationFrame(() => focusSection(target))
      return () => cancelAnimationFrame(frame)
    }
  }, [query, status])

  function openSimulator(discretionary = false) {
    setScenario({ ...emptySavingsScenario, includeDiscretionary: discretionary })
    requestAnimationFrame(() => focusSection('savings-title'))
  }

  function showPattern(id: string) {
    setFilters({ ...initialMicroFilters, patternId: id, includedOnly: true })
    focusSection('micro-history-title')
  }

  function recommendation(item: MicroExpenseRecommendation) {
    if (item.action === 'simulator') openSimulator(true)
    else if (item.action === 'pattern' && mostFrequent) showPattern(mostFrequent.id)
    else {
      setFilters({ ...initialMicroFilters, includedOnly: true, classification: item.id === 'review' ? 'posible' : '' })
      focusSection('micro-history-title')
    }
  }

  return <main id="hormiga" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="micro-expenses-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 id="micro-expenses-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Gastos hormiga</h1><p className="mt-1 text-sm text-muted-foreground">Pequeños gastos, grandes impactos.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onTogglePrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
        <Button ref={settingsTrigger} variant="outline" onClick={() => { onToast(''); setShowSettings(true) }}><Settings2 aria-hidden="true" />Configurar detección</Button>
        <Button ref={simulatorTrigger} aria-expanded={Boolean(scenario)} disabled={status !== 'ready'} onClick={() => { if (scenario) focusSection('savings-title'); else openSimulator() }}><FlaskConical aria-hidden="true" />Simular ahorro</Button>
      </div>
    </div>
    <div className="panel flex flex-wrap items-end justify-between gap-3 px-3.5 py-3 sm:px-4">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/12 text-amber-300"><Coffee className="size-[17px]" aria-hidden="true" /></span>
        <div><p className="text-sm font-semibold">Período de análisis</p><p className="text-xs text-muted-foreground" aria-live="polite">{rangeLabel(analysis.range)}</p></div>
      </div>
      <div className="grid w-full min-w-0 gap-2 min-[440px]:grid-cols-2 sm:w-auto">
        <Field label="Vista del período">{id => <Select id={id} value={range} onChange={event => setRange(event.target.value as MicroExpensePeriod['range'])}><option value="month">Mes</option><option value="quarter">3 meses</option><option value="year">Año al corte</option></Select>}</Field>
        <Field label="Mes de corte">{id => <Input id={id} type="month" max={currentMonth} value={selectedMonth} onChange={event => {
          const value = parseBudgetPeriod(event.target.value)
          if (value && value <= currentMonth) setMonth(value)
        }} />}</Field>
      </div>
    </div>
    {status === 'loading' && <div role="status" aria-label="Cargando gastos hormiga" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="panel h-24 animate-pulse bg-accent" />)}</div>}
    {status === 'error' && <div role="alert" className="panel flex flex-wrap items-center gap-3 p-4"><p>No se pudieron cargar los gastos.</p><Button variant="outline" onClick={finance.reload}>Reintentar</Button></div>}
    {status === 'ready' && <>
      {(!criteria.enabled || !analysis.summary.count) && <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-sm text-amber-100" role="status">
        {!criteria.enabled && <p>Detección automática desactivada. Se conservan las marcas manuales.</p>}
        {!analysis.summary.count && <p>{analysis.history.length ? 'Aún no hay gastos incluidos en el análisis de este período.' : 'Aún no hay gastos registrados para este período.'}</p>}
      </div>}
      <MicroExpenseOverview analysis={analysis} hidden={hidden} />
      {scenario && <SavingsSimulator key={`simulation-${selectedMonth}-${range}`} analysis={analysis} scenario={scenario} onScenario={setScenario} hidden={hidden} onClose={() => { setScenario(null); simulatorTrigger.current?.focus() }} onUseScenario={amount => onUseSavings(amount, analysis.range)} />}
      <MicroExpenseCharts analysis={analysis} hidden={hidden} view={criteria.frequencyView} onView={frequencyView => { void onCriteria({ ...criteria, frequencyView }).catch(() => onToast('No se pudo actualizar la vista de frecuencia.')) }} />
      <SpendingPatterns patterns={analysis.patterns} hidden={hidden} onPattern={showPattern} />
      <MicroExpenseRecommendations items={microRecommendations(analysis, hidden)} onAction={recommendation} />
      <MicroHistory key={`history-${selectedMonth}-${range}`} history={analysis.history} patterns={analysis.patterns} accounts={records.accounts} hidden={hidden} filters={filters} onFilters={setFilters} onMovement={onMovement} onClassify={setClassify} />
    </>}
    {showSettings && <DetectionSettings config={criteria} hidden={hidden} onSave={async value => {
      await onCriteria(value)
      setShowSettings(false)
      onToast('Criterio de gastos hormiga actualizado.')
    }} onClose={() => setShowSettings(false)} onCloseAutoFocus={event => { event.preventDefault(); settingsTrigger.current?.focus({ preventScroll: true }) }} />}
    {classify && <ClassificationDialog request={classify} onSave={async value => {
      await finance.classifyExpenses(classify.ids, value)
      onToast(classify.ids.length === 1 ? 'Clasificación actualizada.' : 'Clasificaciones actualizadas.')
    }} onClose={() => setClassify(null)} onCloseAutoFocus={event => {
      event.preventDefault()
      if (classify.trigger?.isConnected) classify.trigger.focus({ preventScroll: true })
      else document.getElementById('micro-history-title')?.focus({ preventScroll: true })
    }} />}
  </main>
}
