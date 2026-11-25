import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { EvolutionChart, ExpenseChart } from './charts'
import { DashboardViews } from './dashboard-views'
import { monthAt, refreshFinancialDate, today, user } from './mock-data'
import type { Movement, MovementDraft, MovementPreset, Period } from './model'
import { MovementDialog } from './movement-dialog'
import { Header, PeriodSelect, RegisterButton, Sidebar, pageTitles, type AppNotification, type ApplicationPage, type DashboardView, type NavigationItem, type Section } from './navigation'
import { BudgetPanel, CommitmentsPanel, DashboardSavingsPanel, FinancialHealthPanel, Recommendations, SmallExpensesPanel, SummaryCards } from './panels'
import { useDashboard } from './use-dashboard'
import { isIsoDate } from '@/features/movements/movement-data'
import { AccountsPage } from '@/features/accounts/accounts-page'
import { useFinancialRecords } from '@/features/accounts/account-data'
import { DeleteTransactionDialog, TransactionDetailDrawer } from '@/features/movements/transaction-dialogs'
import type { TransactionActionHandler } from '@/features/movements/transaction-history'
import { TransactionsPage } from '@/features/movements/transactions-page'
import type { TransactionFilters } from '@/features/movements/history'
import { BudgetsPage } from '@/features/budgets/budgets-page'
import { budgetAlert, budgetAlertMessage } from '@/features/budgets/budget-calculations'
import { categoryName } from '@/features/budgets/budget-cards'
import { NOTIFICATION_DAYS } from '@/features/commitments/cash-flow'
import { compactDate } from '@/features/commitments/commitment-list'
import { CommitmentsPage } from '@/features/commitments/commitments-page'
import { dateInZone, daysBetween } from '@/lib/calendar'
import { defaultDetection, detectMicroExpenses } from '@/features/micro-expenses/micro-expense-detection'
import type { MicroExpenseDetectionConfig } from '@/features/micro-expenses/micro-expense-model'
import { MicroExpensesPage } from '@/features/micro-expenses/micro-expenses-page'
import type { DateRange } from '@/features/micro-expenses/micro-expense-model'
import { reservedAt } from '@/features/savings/savings-ledger'
import type { SavingsScenario } from '@/features/savings/savings-model'
import { SavingsGoalsPage } from '@/features/savings/savings-goals-page'

const sections: Section[] = ['dashboard', 'salud']

function isSection(item: string): item is Section {
  return sections.some(section => section === item)
}

function isApplicationPage(item: string): item is ApplicationPage {
  return Object.hasOwn(pageTitles, item)
}

function historyFilters(query?: string): Partial<TransactionFilters> {
  const params = new URLSearchParams(query)
  const from = params.get('desde') ?? ''
  const to = params.get('hasta') ?? ''
  return {
    account: params.get('cuenta') ?? '', category: params.get('categoria') ?? '', type: params.get('tipo') === 'gasto' ? 'gasto' : '',
    ...(isIsoDate(from) && isIsoDate(to) ? { from, to, preset: 'custom' } : {}),
  }
}

function formatPeriod(period: Period) {
  const date = formatDate(today, { month: 'long', year: 'numeric' })
  if (period === 'month') return date
  const start = period === 'quarter' ? monthAt(-2) : `${today.slice(0, 4)}-01`
  const sameYear = start.slice(0, 4) === today.slice(0, 4)
  const first = formatDate(`${start}-01`, { month: 'long', year: sameYear ? undefined : 'numeric' })
  return `${first} – ${date}`
}

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('month')
  const [asOf, setAsOf] = useState(refreshFinancialDate)
  const [hidden, setHidden] = useState(false)
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  const [editor, setEditor] = useState<{ record: Movement | null; preset?: MovementPreset } | null>(null)
  const [operation, setOperation] = useState<{ item: Movement; type: 'detail' | 'delete' } | null>(null)
  const [view, setView] = useState<DashboardView | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [criteria, setCriteria] = useState<MicroExpenseDetectionConfig>(defaultDetection)
  const [savingsScenarios, setSavingsScenarios] = useState<SavingsScenario[]>([])
  const lastFocus = useRef<HTMLElement | null>(null)
  const finance = useFinancialRecords()
  const { records, status, saveMovement: save, removeMovement: remove, reload } = finance
  const { movements, accounts } = records
  const detected = useMemo(() => detectMicroExpenses(movements, criteria, asOf).candidateIds, [movements, criteria, asOf])
  const snapshot = useDashboard(period, records, detected, asOf)
  const commitmentAlerts = records.commitments.flatMap((item): AppNotification[] => {
    const section = 'compromisos'
    if (item.status === 'cancelado') return []
    if (item.status === 'confirmado') {
      if (daysBetween(dateInZone(new Date(item.confirmedAt), user.timeZone), asOf) > NOTIFICATION_DAYS) return []
      return [{ id: `${item.id}-confirmed`, title: item.type === 'cobro' ? 'Cobro confirmado' : 'Pago confirmado', detail: `${item.name} quedó registrado el ${compactDate(item.effectiveDate)}.`, section }]
    }
    const days = daysBetween(asOf, item.dueDate)
    if (days > NOTIFICATION_DAYS) return []
    return [{ id: `${item.id}-${days < 0 ? 'overdue' : 'due'}-${item.dueDate}`, title: days < 0 ? 'Compromiso vencido' : 'Vencimiento cercano', detail: `${item.name} · ${compactDate(item.dueDate)}`, section }]
  })
  if (snapshot.projection.firstDeficit) commitmentAlerts.push({ id: `deficit-${snapshot.projection.firstDeficit}`, title: 'Riesgo de saldo insuficiente', detail: `Revisa los compromisos del ${compactDate(snapshot.projection.firstDeficit)}.`, section: 'compromisos' })
  const savingsAlerts = records.savingsGoals.flatMap((goal): AppNotification[] => {
    const section = 'metas'
    if (goal.status === 'alcanzada' || goal.status === 'finalizada') return [{ id: `reached-${goal.id}-${goal.reachedOn}`, title: 'Meta alcanzada', detail: goal.name, section }]
    if (goal.status === 'cancelada') return []
    const result: AppNotification[] = []
    if (goal.targetDate) {
      const days = daysBetween(asOf, goal.targetDate)
      if (days <= 7) result.push({ id: `goal-${days < 0 ? 'overdue' : 'due'}-${goal.id}-${goal.targetDate}`, title: days < 0 ? 'Meta atrasada' : 'Fecha objetivo cercana', detail: `${goal.name} · ${compactDate(goal.targetDate)}`, section })
    }
    const milestone = Math.floor((reservedAt(records, asOf, undefined, goal.id) / goal.target) * 4) * 25
    if (milestone > 0) result.push({ id: `milestone-${goal.id}-${milestone}`, title: `Hito de ahorro · ${milestone} %`, detail: goal.name, section })
    return result
  })
  const alerts: AppNotification[] = [...snapshot.budgets.flatMap(budget => {
    const kind = budgetAlert(budget.used, budget)
    return kind ? [{ id: `${budget.id}-${kind}-${kind === 'threshold' ? budget.warningThreshold : ''}`, title: `Presupuesto de ${categoryName(budget.categoryId)}`,
      detail: budgetAlertMessage(kind, budget.warningThreshold), section: 'presupuestos' as const }] : []
  }), ...commitmentAlerts, ...savingsAlerts]
  const [route, query] = hash.split('?', 2)
  const page: ApplicationPage = isApplicationPage(route) ? route : 'dashboard'
  const section = isSection(hash) ? hash : 'dashboard'
  const active = page === 'dashboard' ? view ?? section : page
  const heading = { dashboard: 'dashboard-title', movimientos: 'movements-title', cuentas: 'accounts-title', presupuestos: 'budgets-title', compromisos: 'commitments-title', hormiga: 'micro-expenses-title', metas: 'savings-title' }[page]
  const canRegister = status === 'ready' && accounts.some(account => account.status === 'activa')
  const params = new URLSearchParams(query)
  const movementId = page === 'movimientos' ? params.get('movimiento') : null
  const detailMovement = operation?.type === 'detail' ? operation.item : movements.find(item => item.id === movementId)

  useEffect(() => {
    const refresh = () => setAsOf(refreshFinancialDate())
    const interval = window.setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  useEffect(() => {
    const sync = () => setHash(window.location.hash.slice(1))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    document.title = `${pageTitles[page]} · Billetera Virtual`
    if (page !== 'dashboard') {
      window.scrollTo(0, 0)
      document.getElementById(heading)?.focus({ preventScroll: true })
    } else {
      document.getElementById(section)?.scrollIntoView({ block: 'start' })
    }
  }, [page, heading, section, query])

  useEffect(() => {
    if (page === 'dashboard' && section !== 'dashboard' && status === 'ready') {
      document.getElementById(section)?.scrollIntoView({ block: 'start' })
    }
  }, [section, status, page])

  useEffect(() => {
    if (!announcement) return
    const timeout = window.setTimeout(() => setAnnouncement(''), 5_000)
    return () => window.clearTimeout(timeout)
  }, [announcement])

  function rememberFocus() {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  function restoreFocus(event: Event) {
    event.preventDefault()
    if (lastFocus.current?.isConnected) lastFocus.current.focus()
    else document.getElementById(heading)?.focus({ preventScroll: true })
  }

  function navigate(item: NavigationItem) {
    if (isApplicationPage(item) || isSection(item)) {
      if (window.location.hash !== `#${item}`) window.location.hash = item
      else document.getElementById(item)?.scrollIntoView({ block: 'start' })
      return
    }
    rememberFocus()
    setView(item)
  }

  function clearDetail(target: ApplicationPage) {
    window.history.replaceState(null, '', `#${target}`)
    setHash(target)
  }

  function closeMovementDetail() {
    setOperation(null)
    if (movementId) clearDetail('movimientos')
  }

  function openRegister(preset?: MovementPreset, trigger?: HTMLElement | null) {
    if (!canRegister) return
    if (trigger) lastFocus.current = trigger
    else rememberFocus()
    setAnnouncement('')
    setEditor({ record: null, preset })
  }

  function carrySavingsScenario(monthlyPotential: number, range: DateRange) {
    const id = crypto.randomUUID()
    setSavingsScenarios(items => [...items, { ...range, id, monthlyPotential, name: `Gastos hormiga · Escenario ${items.length + 1}` }])
    window.location.hash = `metas?escenario=${id}`
  }

  async function saveMovement(draft: MovementDraft, id?: string) {
    await save(draft, id)
    setAnnouncement(id ? 'Movimiento actualizado.' : draft.type === 'transferencia' ? 'Transferencia registrada.' : 'Movimiento registrado.')
  }

  async function deleteMovement(id: string) {
    await remove(id)
    setAnnouncement('Movimiento eliminado.')
  }

  function togglePrivacy() {
    setHidden(value => !value)
  }

  const onAction: TransactionActionHandler = (action, item, trigger) => {
    lastFocus.current = trigger
    setAnnouncement('')
    if (action === 'edit') setEditor({ record: item })
    else setOperation({ type: action, item })
  }

  return (
    <>
      <a href={`#${heading}`} onClick={event => { event.preventDefault(); document.getElementById(heading)?.focus() }} className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
      <Sidebar active={active} onNavigate={navigate} />
      <div className="min-w-0 lg:ml-[var(--sidebar-width)]">
        <Header active={active} onNavigate={navigate} period={period} onPeriod={setPeriod} onRegister={() => openRegister()} page={page} ready={canRegister} alerts={alerts} />
        {page === 'cuentas' && <AccountsPage finance={finance} detected={detected} hidden={hidden} initialAccountId={params.get('cuenta') ?? undefined} onClearInitial={() => clearDetail('cuentas')} onTogglePrivacy={togglePrivacy} onMovement={openRegister} onHistory={id => { window.location.hash = `movimientos?cuenta=${encodeURIComponent(id)}` }} onToast={setAnnouncement} />}
        {page === 'presupuestos' && <BudgetsPage finance={finance} detected={detected} hidden={hidden} onTogglePrivacy={togglePrivacy} onHistory={(category, from, to) => { window.location.hash = `movimientos?${new URLSearchParams({ categoria: category, desde: from, hasta: to, tipo: 'gasto' })}` }} onToast={setAnnouncement} />}
        {page === 'compromisos' && <CommitmentsPage finance={finance} today={asOf} hidden={hidden} initialId={params.get('compromiso')} onClearInitial={() => clearDetail('compromisos')} onTogglePrivacy={togglePrivacy} onMovement={id => { lastFocus.current = null; window.location.hash = `movimientos?movimiento=${encodeURIComponent(id)}` }} onToast={setAnnouncement} />}
        {page === 'hormiga' && <MicroExpensesPage key={query} finance={finance} detected={detected} today={asOf} criteria={criteria} onCriteria={setCriteria} hidden={hidden} onTogglePrivacy={togglePrivacy} query={query} onMovement={id => { lastFocus.current = null; window.location.hash = `movimientos?movimiento=${encodeURIComponent(id)}` }} onToast={setAnnouncement} onUseSavings={carrySavingsScenario} />}
        {page === 'metas' && <SavingsGoalsPage key={query} finance={finance} today={asOf} hidden={hidden} onTogglePrivacy={togglePrivacy} scenarios={savingsScenarios} query={query} onToast={setAnnouncement} onMovement={openRegister} />}
        {page === 'movimientos' && <>
          <TransactionsPage key={query} initialFilters={historyFilters(query)} movements={movements} accounts={accounts} detected={detected} status={status} onRetry={reload} period={period} onPeriod={setPeriod} hidden={hidden} onTogglePrivacy={togglePrivacy} onRegister={() => openRegister()} onAction={onAction} />
          {movementId && status === 'ready' && !detailMovement && <div role="alert" className="mx-4 mb-4 rounded-xl border border-border p-3">El movimiento solicitado ya no está disponible. <Button variant="ghost" onClick={closeMovementDetail}>Cerrar</Button></div>}
        </>}
        {page === 'dashboard' && (
        <main id="dashboard" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="dashboard-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="dashboard-title" tabIndex={-1} className="font-display text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Resumen financiero</h1>
              <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{formatPeriod(period)}</p>
            </div>
            <Button variant="outline" className="h-9 gap-2 bg-secondary/65 text-muted-foreground" onClick={togglePrivacy} aria-pressed={hidden}>
              {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}
            </Button>
          </div>
          <div className="grid gap-2.5 min-[390px]:grid-cols-[minmax(0,1fr)_auto] sm:hidden">
            <PeriodSelect period={period} onChange={setPeriod} compact />
            <RegisterButton className="w-full" onClick={() => openRegister()} disabled={!canRegister} />
          </div>
          {status === 'loading' && <div role="status" aria-label="Cargando resumen financiero" className="panel h-32 animate-pulse bg-accent" />}
          {status === 'error' && <div role="alert" className="panel flex flex-wrap items-center gap-3 p-4"><p>No se pudo cargar el resumen financiero.</p><Button variant="outline" onClick={reload}>Reintentar</Button></div>}
          {status === 'ready' && <>
          <SummaryCards snapshot={snapshot} hidden={hidden} />
          <div className="grid gap-4 sm:gap-5 min-[1200px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <EvolutionChart data={snapshot.chart} hidden={hidden} />
            <ExpenseChart distribution={snapshot.distribution} hidden={hidden} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
            <BudgetPanel budgets={snapshot.budgets} hidden={hidden} />
            <CommitmentsPanel commitments={snapshot.commitments} today={asOf} hidden={hidden} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
            <SmallExpensesPanel data={snapshot.smallExpenses} hidden={hidden} />
            <FinancialHealthPanel data={snapshot.health} />
          </div>
          <DashboardSavingsPanel data={snapshot.savings} shortfall={snapshot.savingsShortfall} hidden={hidden} />
          <Recommendations data={snapshot} period={period} hidden={hidden} onAssistant={() => navigate('asistente')} />
          </>}
        </main>
        )}
      </div>
      <MovementDialog open={Boolean(editor)} record={editor?.record ?? null} preset={editor?.preset} onOpenChange={open => { if (!open) setEditor(null) }} records={records} onSave={saveMovement} onCloseAutoFocus={restoreFocus} />
      {page === 'movimientos' && detailMovement && <TransactionDetailDrawer item={detailMovement} accounts={accounts} detected={detected} hidden={hidden} onClose={closeMovementDetail} onCloseAutoFocus={restoreFocus} onCommitment={id => { setOperation(null); window.location.hash = `compromisos?compromiso=${encodeURIComponent(id)}` }} />}
      {operation?.type === 'delete' && <DeleteTransactionDialog item={operation.item} onDelete={deleteMovement} onClose={() => setOperation(null)} onCloseAutoFocus={restoreFocus} />}
      <DashboardViews view={view} onClose={() => setView(null)} onCloseAutoFocus={restoreFocus} data={snapshot} hidden={hidden} onTogglePrivacy={togglePrivacy} criteria={criteria} onCriteria={value => {
        setCriteria(value)
        setView(null)
        setAnnouncement('Criterio de gastos hormiga actualizado.')
      }} />
      <div role="status" aria-atomic="true" className="fixed right-4 bottom-4 z-30 sm:right-7 sm:bottom-6">
        {announcement && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm font-semibold shadow-xl">
            <CheckCircle2 className="size-[18px] text-primary" aria-hidden="true" />{announcement}
            <Button variant="ghost" size="icon" className="ml-1 size-7" aria-label="Cerrar confirmación" onClick={() => setAnnouncement('')}><X /></Button>
          </div>
        )}
      </div>
    </>
  )
}
