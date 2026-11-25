import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, Eye, EyeOff, Plus, Target, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import type { useFinancialRecords } from '@/features/accounts/account-data'
import type { MovementPreset } from '@/features/dashboard/model'
import { formatMoney } from '@/lib/utils'
import { SavingsGoalCard, SavingsOverview, statusLabels, type SavingsActionHandler } from './savings-cards'
import { SavingsActivityChart, SavingsDistributionChart } from './savings-charts'
import { SavingsGoalDetail } from './savings-detail'
import { GoalLifecycleDialog, ReservationDialog, SavingsGoalForm } from './savings-dialogs'
import { goalHistory, summarizeSavings } from './savings-ledger'
import type { SavingsGoalAction, SavingsGoalStatus, SavingsScenario } from './savings-model'
import { SavingsPlanner } from './savings-planner'
import { accountsWithUpcomingShortfall } from './savings-planning'

type Modal = { action: 'create' } | { action: SavingsGoalAction; id: string }

function focusPlanner() {
  const title = document.getElementById('planner-title')
  title?.focus({ preventScroll: true })
  title?.scrollIntoView({ block: 'start' })
}

export function SavingsGoalsPage({ finance, today, hidden, onTogglePrivacy, scenarios, query, onToast, onMovement }: {
  finance: ReturnType<typeof useFinancialRecords>; today: string; hidden: boolean; onTogglePrivacy: () => void;
  scenarios: SavingsScenario[]; query?: string; onToast: (message: string) => void; onMovement: (preset: MovementPreset) => void;
}) {
  const params = new URLSearchParams(query)
  const accountId = params.get('cuenta') ?? ''
  const scenarioId = params.get('escenario') ?? undefined
  const { records, status } = finance
  const [filter, setFilter] = useState<SavingsGoalStatus | ''>('')
  const [modal, setModal] = useState<Modal | null>(null)
  const [planner, setPlanner] = useState(Boolean(scenarioId))
  const [plannedId, setPlannedId] = useState('')
  const trigger = useRef<HTMLElement | null>(null)
  const plannerTrigger = useRef<HTMLButtonElement>(null)
  const histories = useMemo(() => records.savingsGoals.map(goal => goalHistory(goal, records, today)), [records, today])
  const summary = useMemo(() => summarizeSavings(records, today), [records, today])
  const shortfalls = useMemo(() => accountsWithUpcomingShortfall(records, today), [records, today])
  const eligible = histories.filter(item => item.goal.status !== 'finalizada' && item.goal.status !== 'cancelada')
  const selectedGoalId = eligible.find(item => item.goal.id === plannedId)?.goal.id ?? eligible[0]?.goal.id ?? ''
  const selectedAccount = records.accounts.find(item => item.id === accountId)
  const visible = histories.filter(history => (!filter || history.goal.status === filter) && (!selectedAccount || (history.byAccount.get(selectedAccount.id) ?? 0) > 0))
  const selected = modal && 'id' in modal ? histories.find(item => item.goal.id === modal.id) : undefined

  function open(value: Modal, source: HTMLElement | null) {
    onToast('')
    if (source?.isConnected && !source.closest('[role="dialog"]')) trigger.current = source
    setModal(value)
  }
  function close() { setModal(null) }
  function restoreFocus(event: Event) {
    event.preventDefault()
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true })
    else document.getElementById('savings-title')?.focus({ preventScroll: true })
  }
  const onAction: SavingsActionHandler = (action, history, source) => open({ action, id: history.goal.id }, source)
  function showPlanner(id?: string) {
    if (id) setPlannedId(id)
    setPlanner(true)
    requestAnimationFrame(focusPlanner)
  }

  useEffect(() => {
    if (status === 'ready' && scenarioId) {
      const frame = requestAnimationFrame(focusPlanner)
      return () => cancelAnimationFrame(frame)
    }
  }, [status, scenarioId])

  const lifecycle = modal?.action === 'pausar' || modal?.action === 'reactivar' || modal?.action === 'finalizar' || modal?.action === 'cancelar' ? modal.action : null
  const reservation = modal?.action === 'aporte' || modal?.action === 'liberacion' ? modal.action : null
  return <main id="metas" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="savings-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 id="savings-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Metas de ahorro</h1><p className="mt-1 text-sm text-muted-foreground">Convierte tus pequeños esfuerzos en grandes objetivos.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onTogglePrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
        <Button ref={plannerTrigger} variant="outline" disabled={status !== 'ready'} aria-expanded={planner} onClick={() => showPlanner()}><Calculator aria-hidden="true" />Abrir planificador</Button>
        <Button disabled={status !== 'ready'} onClick={event => open({ action: 'create' }, event.currentTarget)}><Plus aria-hidden="true" />Nueva meta</Button>
      </div>
    </div>
    {status === 'loading' && <div role="status" aria-label="Cargando metas" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="panel h-24 animate-pulse bg-accent" />)}</div>}
    {status === 'error' && <div role="alert" className="panel flex flex-wrap items-center gap-3 p-4"><p>No se pudieron cargar las metas.</p><Button variant="outline" onClick={finance.reload}>Reintentar</Button></div>}
    {status === 'ready' && <>
      <SavingsOverview summary={summary} hidden={hidden} />
      {(shortfalls.length > 0 || summary.availableForNew === 0) && <section aria-label="Recomendaciones de ahorro" className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/7 p-3.5 text-sm">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-300" aria-hidden="true" />
        <div><h2 className="font-semibold text-amber-200">{shortfalls.length ? 'Revisa los pagos de los próximos 7 días' : 'Dinero libre insuficiente para nuevos aportes'}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{shortfalls.length ? `Los vencimientos pendientes, incluidos los atrasados, podrían superar el dinero libre en ${shortfalls.map(item => item.name).join(', ')}. ` : `Hay ${formatMoney(summary.availableForNew, hidden)} disponible para nuevas reservas. `}
            <a href={shortfalls.length ? '#compromisos' : '#cuentas'} className="font-semibold text-amber-200 hover:underline">{shortfalls.length ? 'Ver cobros y pagos' : 'Revisar mis cuentas'}</a>
          </p>
        </div>
      </section>}
      {planner && <SavingsPlanner histories={eligible} scenarios={scenarios} goalId={selectedGoalId} scenarioId={scenarioId} today={today} hidden={hidden} onGoal={setPlannedId} onClose={() => { setPlanner(false); plannerTrigger.current?.focus() }} />}
      <section aria-labelledby="goal-list-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 id="goal-list-title" className="text-lg font-bold tracking-tight">Mis metas</h2><p className="mt-0.5 text-xs text-muted-foreground">Consulta objetivos vigentes y metas cerradas.</p></div>
          <Field label="Estado de las metas">{id => <Select id={id} value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="">Todas las metas</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}</Field>
        </div>
        {selectedAccount && <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-indigo-200">Reservas en {selectedAccount.name}<a href="#metas" className="text-xs font-semibold text-foreground hover:underline">Quitar filtro</a></p>}
        {visible.length ? <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">{visible.map(history => <SavingsGoalCard key={history.goal.id} history={history} hidden={hidden} onAction={onAction} />)}</div>
          : <div className="panel flex flex-col items-center gap-2 p-6 text-center"><Target className="size-6 text-indigo-300" aria-hidden="true" /><p className="text-sm font-semibold">{histories.length ? 'No hay metas que coincidan con el filtro.' : 'Aún no tienes metas de ahorro registradas.'}</p>{!histories.length && <Button variant="outline" size="sm" onClick={event => open({ action: 'create' }, event.currentTarget)}>Crear primera meta</Button>}</div>}
      </section>
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <SavingsActivityChart operations={records.reservations} today={today} hidden={hidden} /><SavingsDistributionChart histories={histories} hidden={hidden} />
      </div>
    </>}
    {(modal?.action === 'create' || (modal?.action === 'edit' && selected)) && <SavingsGoalForm history={modal.action === 'edit' ? selected : undefined} records={records} today={today} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onSave={async (draft, initial) => {
      const id = modal.action === 'edit' ? modal.id : undefined
      await finance.saveGoal(draft, id, initial)
      setFilter('')
      onToast(id ? 'Meta actualizada.' : 'Meta creada.')
    }} />}
    {selected && reservation && <ReservationDialog history={selected} type={reservation} records={records} today={today} hidden={hidden} preferredAccount={selectedAccount?.id} onClose={close} onCloseAutoFocus={restoreFocus} onSave={async draft => {
      await finance.recordReservation(reservation, draft)
      onToast(reservation === 'aporte' ? 'Aporte registrado.' : 'Liberación registrada.')
    }} />}
    {selected && lifecycle && <GoalLifecycleDialog history={selected} action={lifecycle} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onConfirm={async purchase => {
      await finance.changeGoalStatus(selected.goal.id, lifecycle)
      onToast({ pausar: 'Meta pausada.', reactivar: 'Meta reactivada.', cancelar: 'Meta cancelada.', finalizar: 'Meta finalizada.' }[lifecycle])
      if (purchase && lifecycle === 'finalizar') {
        const sources = [...selected.byAccount].filter(([, amount]) => amount > 0)
        requestAnimationFrame(() => onMovement({ type: 'gasto', description: selected.goal.name, amount: selected.goal.target, accountId: sources.length === 1 ? sources[0][0] : undefined }))
      }
    }} />}
    {selected && modal?.action === 'detail' && <SavingsGoalDetail history={selected} records={records} today={today} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onAction={onAction} onPlanner={() => { close(); showPlanner(selected.goal.id) }} />}
  </main>
}
