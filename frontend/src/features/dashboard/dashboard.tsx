import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { EvolutionChart, ExpenseChart } from './charts'
import { DashboardViews } from './dashboard-views'
import { alerts as seedAlerts, monthAt, smallExpenseCriteria, today } from './mock-data'
import type { MicroExpenseCriteria, Movement, MovementDraft, MovementPreset, Period } from './model'
import { MovementDialog } from './movement-dialog'
import { Header, PeriodSelect, RegisterButton, Sidebar, pageTitles, type AppNotification, type ApplicationPage, type DashboardView, type NavigationItem, type Section } from './navigation'
import { BudgetPanel, CommitmentsPanel, FinancialHealthPanel, Recommendations, SmallExpensesPanel, SummaryCards } from './panels'
import { useDashboard } from './use-dashboard'
import { detectMicroExpenses, isIsoDate } from '@/features/movements/movement-data'
import { AccountsPage } from '@/features/accounts/accounts-page'
import { useFinancialRecords } from '@/features/accounts/account-data'
import { DeleteTransactionDialog, TransactionDetailDrawer } from '@/features/movements/transaction-dialogs'
import type { TransactionActionHandler } from '@/features/movements/transaction-history'
import { TransactionsPage } from '@/features/movements/transactions-page'
import type { TransactionFilters } from '@/features/movements/history'
import { BudgetsPage } from '@/features/budgets/budgets-page'
import { budgetAlert, budgetAlertMessage } from '@/features/budgets/budget-calculations'
import { categoryName } from '@/features/budgets/budget-cards'

const sections: Section[] = ['dashboard', 'compromisos', 'hormiga', 'salud']

function isSection(item: string): item is Section {
  return sections.some(section => section === item)
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
  const [hidden, setHidden] = useState(false)
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  const [editor, setEditor] = useState<{ record: Movement | null; preset?: MovementPreset } | null>(null)
  const [operation, setOperation] = useState<{ item: Movement; type: 'detail' | 'delete' } | null>(null)
  const [view, setView] = useState<DashboardView | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [criteria, setCriteria] = useState<MicroExpenseCriteria>(smallExpenseCriteria)
  const lastFocus = useRef<HTMLElement | null>(null)
  const finance = useFinancialRecords()
  const { records, status, saveMovement: save, removeMovement: remove, reload } = finance
  const { movements, accounts } = records
  const detected = useMemo(() => detectMicroExpenses(movements, criteria), [movements, criteria])
  const snapshot = useDashboard(period, records, detected)
  const alerts: AppNotification[] = [...snapshot.budgets.flatMap(budget => {
    const kind = budgetAlert(budget.used, budget)
    return kind ? [{ id: `${budget.id}-${kind}-${kind === 'threshold' ? budget.warningThreshold : ''}`, title: `Presupuesto de ${categoryName(budget.categoryId)}`,
      detail: budgetAlertMessage(kind, budget.warningThreshold), section: 'presupuestos' as const }] : []
  }), ...seedAlerts]
  const [route, query] = hash.split('?', 2)
  const page: ApplicationPage = route === 'movimientos' || route === 'cuentas' || route === 'presupuestos' ? route : 'dashboard'
  const section = isSection(hash) ? hash : 'dashboard'
  const active = page === 'dashboard' ? view ?? section : page
  const heading = { dashboard: 'dashboard-title', movimientos: 'movements-title', cuentas: 'accounts-title', presupuestos: 'budgets-title' }[page]
  const canRegister = status === 'ready' && accounts.some(account => account.status === 'activa')

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
    if (item === 'movimientos' || item === 'cuentas' || item === 'presupuestos' || isSection(item)) {
      if (window.location.hash !== `#${item}`) window.location.hash = item
      else document.getElementById(item)?.scrollIntoView({ block: 'start' })
      return
    }
    rememberFocus()
    setView(item)
  }

  function openRegister(preset?: MovementPreset, trigger?: HTMLElement | null) {
    if (!canRegister) return
    if (trigger) lastFocus.current = trigger
    else rememberFocus()
    setAnnouncement('')
    setEditor({ record: null, preset })
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
        {page === 'cuentas' && <AccountsPage finance={finance} detected={detected} hidden={hidden} onTogglePrivacy={togglePrivacy} onMovement={openRegister} onHistory={id => { window.location.hash = `movimientos?cuenta=${encodeURIComponent(id)}` }} onToast={setAnnouncement} />}
        {page === 'presupuestos' && <BudgetsPage finance={finance} detected={detected} hidden={hidden} onTogglePrivacy={togglePrivacy} onHistory={(category, from, to) => { window.location.hash = `movimientos?${new URLSearchParams({ categoria: category, desde: from, hasta: to, tipo: 'gasto' })}` }} onToast={setAnnouncement} />}
        {page === 'movimientos' && <TransactionsPage key={query} initialFilters={historyFilters(query)} movements={movements} accounts={accounts} detected={detected} status={status} onRetry={reload} period={period} onPeriod={setPeriod} hidden={hidden} onTogglePrivacy={togglePrivacy} onRegister={() => openRegister()} onAction={onAction} />}
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
            <CommitmentsPanel commitments={snapshot.commitments} hidden={hidden} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
            <SmallExpensesPanel data={snapshot.smallExpenses} hidden={hidden} />
            <FinancialHealthPanel data={snapshot.health} />
          </div>
          <Recommendations data={snapshot} period={period} hidden={hidden} onAssistant={() => navigate('asistente')} />
          </>}
        </main>
        )}
      </div>
      <MovementDialog open={Boolean(editor)} record={editor?.record ?? null} preset={editor?.preset} onOpenChange={open => { if (!open) setEditor(null) }} records={records} onSave={saveMovement} onCloseAutoFocus={restoreFocus} />
      {operation?.type === 'detail' && <TransactionDetailDrawer item={operation.item} accounts={accounts} detected={detected} hidden={hidden} onClose={() => setOperation(null)} onCloseAutoFocus={restoreFocus} />}
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
