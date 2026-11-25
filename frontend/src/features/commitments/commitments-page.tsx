import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Eye, EyeOff, FlaskConical, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useFinancialRecords } from '@/features/accounts/account-data'
import { reservedAt } from '@/features/savings/savings-ledger'
import { accountsWithUpcomingShortfall } from '@/features/savings/savings-planning'
import { registeredBalance } from '@/features/accounts/account-balances'
import { DEFAULT_HORIZON, findRisks, pendingItems, projectCashFlow, scenarioItems, summarizeCommitments } from './cash-flow'
import { CashFlowSimulator, newScenario } from './cash-flow-simulator'
import { CashFlowChart, CommitmentOverview, FinancialRiskPanel } from './cash-flow-view'
import { CommitmentCalendar } from './commitment-calendar'
import { CancelCommitmentDialog, CommitmentDetailDrawer, CommitmentForm, ConfirmCommitmentDialog } from './commitment-dialogs'
import { CommitmentList, type CommitmentAction, type CommitmentActionHandler } from './commitment-list'
import { projectionHorizons, type CashFlowScenario, type ProjectionHorizon } from './commitment-model'

type Modal = { type: 'create'; date?: string } | { type: CommitmentAction; id: string }

export function CommitmentsPage({ finance, today, hidden, initialId, onClearInitial, onTogglePrivacy, onMovement, onToast }: {
  finance: ReturnType<typeof useFinancialRecords>; today: string; hidden: boolean; initialId: string | null; onClearInitial: () => void;
  onTogglePrivacy: () => void; onMovement: (id: string) => void; onToast: (message: string) => void;
}) {
  const [horizon, setHorizon] = useState<ProjectionHorizon>(DEFAULT_HORIZON)
  const [section, setSection] = useState<'lista' | 'calendario'>('lista')
  const [flowDate, setFlowDate] = useState(today)
  const [scenario, setScenario] = useState<CashFlowScenario | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const simulatorTrigger = useRef<HTMLButtonElement>(null)
  const { records, status } = finance
  const { accounts, commitments } = records
  const canCreate = status === 'ready' && accounts.some(item => item.status === 'activa')
  const pending = useMemo(() => pendingItems(commitments), [commitments])
  const balance = useMemo(() => registeredBalance(records, today), [records, today])
  const reserved = reservedAt(records, today)
  const shortfalls = useMemo(() => accountsWithUpcomingShortfall(records, today), [records, today])
  const base = useMemo(() => projectCashFlow(pending, balance, today, horizon, reserved), [pending, balance, today, horizon, reserved])
  const simulated = useMemo(() => scenario ? projectCashFlow(scenarioItems(pending, scenario), balance, today, horizon, scenario.reserve) : undefined, [pending, scenario, balance, today, horizon])
  const risks = useMemo(() => findRisks(simulated ?? base, today), [simulated, base, today])
  const activeModal = modal ?? (initialId ? { type: 'detail' as const, id: initialId } : null)
  const selected = activeModal && 'id' in activeModal ? commitments.find(item => item.id === activeModal.id) : undefined

  function open(value: Modal, source: HTMLElement | null) {
    onToast('')
    trigger.current = source
    setModal(value)
  }

  function close() {
    setModal(null)
    if (initialId) onClearInitial()
  }

  function restoreFocus(event: Event) {
    event.preventDefault()
    if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true })
    else document.getElementById('commitments-title')?.focus({ preventScroll: true })
  }

  const onAction: CommitmentActionHandler = (type, id, source) => open({ type, id }, source)
  const onCreate = (date?: string, source: HTMLElement | null = null) => {
    if (canCreate) open({ type: 'create', date }, source)
    else onToast('Activa una cuenta para registrar compromisos.')
  }

  return <main id="compromisos" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="commitments-title">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 id="commitments-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Cobros y pagos</h1><p className="mt-1 text-sm text-muted-foreground">Anticipa tus ingresos y organiza tus compromisos.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onTogglePrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
        <Button disabled={!canCreate} onClick={event => onCreate(undefined, event.currentTarget)}><Plus aria-hidden="true" />Nuevo compromiso</Button>
      </div>
    </div>
    {status === 'ready' && !canCreate && <p className="text-sm text-muted-foreground">Activa una cuenta en <a className="font-semibold text-primary hover:underline" href="#cuentas">Mis cuentas</a> para registrar compromisos.</p>}
    {status === 'loading' && <div role="status" aria-label="Cargando compromisos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="panel h-24 animate-pulse bg-accent" />)}</div>}
    {status === 'error' && <div role="alert" className="panel flex flex-wrap items-center gap-3 p-4"><p>No se pudieron cargar los compromisos.</p><Button variant="outline" onClick={finance.reload}>Reintentar</Button></div>}
    {status === 'ready' && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-xs font-semibold text-muted-foreground">Horizonte de proyección</span>
          <div role="group" aria-label="Horizonte de proyección" className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-secondary/55 p-0.5">
            {projectionHorizons.map(value => <Button key={value} variant={horizon === value ? 'muted' : 'ghost'} size="sm" className="h-7 px-1.5 text-[11px] sm:px-2.5 sm:text-xs" aria-pressed={horizon === value} onClick={() => { setHorizon(value); setFlowDate(today) }}>{value} días</Button>)}
          </div>
        </div>
        <Button ref={simulatorTrigger} variant="outline" onClick={() => setScenario(value => value ? null : newScenario(base.reserve))} aria-expanded={Boolean(scenario)} aria-controls={scenario ? 'cash-flow-simulator' : undefined} className="text-violet-200"><FlaskConical aria-hidden="true" />{scenario ? 'Salir de la simulación' : 'Abrir simulador'}</Button>
      </div>
      <CommitmentOverview summary={summarizeCommitments(pending, base, today)} projection={base} hidden={hidden} />
      {reserved > 0 && shortfalls.length > 0 && <p className="rounded-xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-amber-100">El dinero libre podría ser insuficiente para los pagos próximos o atrasados en {shortfalls.map(item => item.name).join(', ')}. <a href="#metas" className="font-semibold hover:underline">Revisar reservas</a></p>}
      {scenario && simulated && <CashFlowSimulator pending={pending} scenario={scenario} base={base} simulated={simulated} today={today} hidden={hidden} onChange={setScenario} onClose={() => { setScenario(null); simulatorTrigger.current?.focus() }} />}
      <div className="grid min-w-0 items-start gap-4 sm:gap-5 min-[1080px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <CashFlowChart base={base} simulated={simulated} date={flowDate} onDay={setFlowDate} hidden={hidden} onAction={onAction} />
        <FinancialRiskPanel risks={risks} simulated={Boolean(simulated)} hidden={hidden} onDay={setFlowDate} />
      </div>
      <div role="group" aria-label="Vista de compromisos" className="flex flex-wrap gap-2">
        <Button variant={section === 'lista' ? 'muted' : 'outline'} aria-pressed={section === 'lista'} onClick={() => setSection('lista')}><List aria-hidden="true" />Lista</Button>
        <Button variant={section === 'calendario' ? 'muted' : 'outline'} aria-pressed={section === 'calendario'} onClick={() => setSection('calendario')}><CalendarDays aria-hidden="true" />Calendario</Button>
      </div>
      {section === 'lista' ? <CommitmentList items={commitments} accounts={accounts} today={today} hidden={hidden} onAction={onAction} />
        : <CommitmentCalendar commitments={commitments} accounts={accounts} today={today} hidden={hidden} onAction={onAction} onCreate={onCreate} canCreate={canCreate} />}
      {initialId && !selected && <div role="alert" className="panel p-4">El compromiso solicitado ya no está disponible. <Button variant="ghost" onClick={close}>Cerrar</Button></div>}
    </>}
    {(activeModal?.type === 'create' || (activeModal?.type === 'edit' && selected)) && <CommitmentForm editing={selected} dueDate={activeModal.type === 'create' ? activeModal.date : undefined} accounts={accounts} today={today} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onSave={async (draft, id) => {
      await finance.saveCommitment(draft, id)
      onToast(id ? 'Compromiso actualizado.' : 'Compromiso creado.')
    }} />}
    {activeModal?.type === 'confirm' && selected && <ConfirmCommitmentDialog item={selected} records={records} today={today} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onConfirm={async draft => {
      await finance.confirmCommitment(selected.id, draft)
      onToast(selected.type === 'cobro' ? 'Cobro confirmado.' : 'Pago confirmado.')
    }} />}
    {activeModal?.type === 'cancel' && selected && <CancelCommitmentDialog item={selected} onClose={close} onCloseAutoFocus={restoreFocus} onCancel={async () => {
      await finance.cancelCommitment(selected.id)
      onToast('Compromiso cancelado.')
    }} />}
    {activeModal?.type === 'detail' && selected && <CommitmentDetailDrawer item={selected} accounts={accounts} today={today} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onMove={onMovement} onAction={type => setModal({ type, id: selected.id })} />}
  </main>
}
