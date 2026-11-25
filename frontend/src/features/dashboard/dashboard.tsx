import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CheckCircle2, Eye, EyeOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { EvolutionChart, ExpenseChart } from './charts'
import { refreshFinancialDate } from './mock-data'
import { dashboardPeriod } from './financial-period'
import type { Movement, MovementDraft, MovementPreset, Period } from './model'
import { MovementDialog } from './movement-dialog'
import { Header, PeriodSelect, RegisterButton, Sidebar, pageTitles, type ApplicationPage, type NavigationItem } from './navigation'
import { BudgetPanel, CommitmentsPanel, DashboardSavingsPanel, FinancialHealthPanel, Recommendations, SmallExpensesPanel, SummaryCards } from './panels'
import { useDashboard } from './use-dashboard'
import { isIsoDate } from '@/features/movements/movement-data'
import { AccountsPage } from '@/features/accounts/accounts-page'
import { createMockFinancialRepository, useFinancialRecords } from '@/features/accounts/account-data'
import { DeleteTransactionDialog, TransactionDetailDrawer } from '@/features/movements/transaction-dialogs'
import type { TransactionActionHandler } from '@/features/movements/transaction-history'
import { TransactionsPage } from '@/features/movements/transactions-page'
import type { TransactionFilters } from '@/features/movements/history'
import { BudgetsPage } from '@/features/budgets/budgets-page'
import { CommitmentsPage } from '@/features/commitments/commitments-page'
import { detectMicroExpenses } from '@/features/micro-expenses/micro-expense-detection'
import { MicroExpensesPage } from '@/features/micro-expenses/micro-expenses-page'
import type { DateRange } from '@/features/micro-expenses/micro-expense-model'
import type { SavingsScenario } from '@/features/savings/savings-model'
import { SavingsGoalsPage } from '@/features/savings/savings-goals-page'
import { createMockHealthRepository, loadHealth } from '@/features/health/health-data'
import { healthPeriods, type FinancialHealthPeriod } from '@/features/health/health-model'
import type { AnalysisContext } from '@/features/assistant/assistant-model'
import { createDemoAnalysisProvider } from '@/features/assistant/assistant-provider'
import { useAssistantSession } from '@/features/assistant/use-assistant-session'
import { DashboardAnalysis } from '@/features/assistant/assistant-dashboard-panel'

import { CategoryContext } from '@/features/categories/category-context'
import { filterCategories, readCategories } from '@/features/categories/category-model'
import { useSettingsSession } from '@/features/settings/use-settings-session'
import type { SecuritySettings } from '@/features/settings/preferences-model'
import { ConfirmationDialog } from '@/features/settings/settings-confirmation'
import { demoNotifications } from './demo-notifications'

const FinancialAssistantPage = lazy(() => import('@/features/assistant/financial-assistant-page'))
const FinancialHealthPage = lazy(() => import('@/features/health/financial-health-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))

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

function formatPeriod(period: Period, asOf: string) {
  const date = formatDate(asOf, { month: 'long', year: 'numeric' })
  if (period === 'month') return date
  const { from } = dashboardPeriod(period, asOf).current
  const sameYear = from.slice(0, 4) === asOf.slice(0, 4)
  const first = formatDate(from, { month: 'long', year: sameYear ? undefined : 'numeric' })
  return `${first} – ${date}`
}

export function Dashboard({ session, onLogout }: { session: SecuritySettings; onLogout: () => void }) {
  const settings = useSettingsSession()
  const { preferences } = settings
  const { regional, financial, appearance, detection: criteria } = preferences
  const [period, setPeriod] = useState<Period>(regional.dashboardPeriod)
  const [asOf, setAsOf] = useState(refreshFinancialDate)
  const [hidden, setHidden] = useState(preferences.privacy.hideOnStart)
  const [hash, setHash] = useState(() => window.location.hash.slice(1))
  const [editor, setEditor] = useState<{ record: Movement | null; preset?: MovementPreset } | null>(null)
  const [operation, setOperation] = useState<{ item: Movement; type: 'detail' | 'delete' } | null>(null)
  const [dirty, setDirty] = useState(false)
  const [pendingRoute, setPendingRoute] = useState<string | null>(null)
  const [logout, setLogout] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [healthPeriod, setHealthPeriod] = useState<FinancialHealthPeriod>(financial.analysisPeriod)
  const [savingsScenarios, setSavingsScenarios] = useState<SavingsScenario[]>([])
  const lastFocus = useRef<HTMLElement | null>(null)
  const [repository] = useState(createMockFinancialRepository)
  const finance = useFinancialRecords(repository)
  const { records, status, saveMovement: save, removeMovement: remove, reload } = finance
  const catalog = readCategories(records)
  const analysisContext = useMemo<AnalysisContext>(() => ({
    records, criteria, today: asOf, timeZone: regional.timeZone, categories: filterCategories(catalog, 'gasto'), scenarios: savingsScenarios, defaults: financial,
  }), [records, catalog, criteria, asOf, regional.timeZone, savingsScenarios, financial])
  const analysisVersion = useMemo(() => Symbol(), [analysisContext])
  const analysisProvider = useMemo(() => createDemoAnalysisProvider(analysisContext, status === 'ready'), [analysisContext, status])
  const assistant = useAssistantSession(analysisProvider, analysisVersion, preferences.assistant.enabled)
  const latestAnalysis = assistant.history[0]
  const { movements, accounts } = records
  const detected = useMemo(() => detectMicroExpenses(movements, criteria, asOf).candidateIds, [movements, criteria, asOf])
  const snapshot = useDashboard(period, records, detected, asOf, financial.horizon)
  const healthRepository = useMemo(() => createMockHealthRepository(records, asOf, criteria, regional.timeZone), [records, asOf, criteria, regional.timeZone])
  const currentHealth = useMemo(() => loadHealth(healthRepository, 'month', status), [healthRepository, status])
  const health = useMemo(() => healthPeriod === 'month' ? currentHealth : loadHealth(healthRepository, healthPeriod, status), [currentHealth, healthRepository, healthPeriod, status])
  const alerts = demoNotifications(records, snapshot, currentHealth, asOf, regional.timeZone, settings.notifications)
  const [route, query] = hash.split('?', 2)
  const page: ApplicationPage = isApplicationPage(route) ? route : 'dashboard'
  const heading = { dashboard: 'dashboard-title', movimientos: 'movements-title', cuentas: 'accounts-title', presupuestos: 'budgets-title', compromisos: 'commitments-title', hormiga: 'micro-expenses-title', metas: 'savings-title', salud: 'financial-health-title', asistente: 'assistant-title', configuracion: 'settings-title' }[page]
  const canRegister = status === 'ready' && accounts.some(account => account.status === 'activa')
  const params = new URLSearchParams(query)
  const movementId = page === 'movimientos' ? params.get('movimiento') : null
  const reduction = params.get('reduccion')
  const initialHealthReduction = reduction && /^(?:[0-9]{1,2}|100)$/.test(reduction) ? Number(reduction) : undefined
  const linkedHealthPeriod = page === 'salud' ? healthPeriods.find(item => item.id === params.get('periodo'))?.id : undefined
  const detailMovement = operation?.type === 'detail' ? operation.item : movements.find(item => item.id === movementId)

  useEffect(() => {
    const refresh = () => setAsOf(refreshFinancialDate(regional.timeZone))
    refresh()
    const interval = window.setInterval(refresh, 15_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh) }
  }, [regional.timeZone])

  useEffect(() => {
    const sync = () => {
      const next = window.location.hash.slice(1)
      if (dirty && page === 'configuracion' && next !== hash) {
        window.history.replaceState(null, '', '#' + hash)
        setPendingRoute(next || 'dashboard')
      } else setHash(next)
    }
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('hashchange', sync)
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('beforeunload', warn) }
  }, [dirty, hash, page])

  useLayoutEffect(() => {
    const element = document.documentElement
    element.dataset.walletText = appearance.textSize
    element.dataset.walletMotion = appearance.reducedMotion ? 'reduced' : 'system'
    return () => { delete element.dataset.walletText; delete element.dataset.walletMotion }
  }, [appearance.textSize, appearance.reducedMotion])

  useEffect(() => { setPeriod(regional.dashboardPeriod) }, [regional.dashboardPeriod])
  useEffect(() => { setHealthPeriod(financial.analysisPeriod) }, [financial.analysisPeriod])

  useEffect(() => {
    if (linkedHealthPeriod) setHealthPeriod(linkedHealthPeriod)
  }, [linkedHealthPeriod])

  useEffect(() => {
    document.title = `${pageTitles[page]} · Billetera Virtual`
    if (page !== 'dashboard') {
      window.scrollTo(0, 0)
      document.getElementById(heading)?.focus({ preventScroll: true })
    } else {
      document.getElementById('dashboard')?.scrollIntoView({ block: 'start' })
    }
  }, [page, heading, query])

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

  function requestRoute(next: string) {
    if (next === hash) return
    if (dirty && page === 'configuracion') setPendingRoute(next)
    else window.location.hash = next
  }

  function navigate(item: NavigationItem) {
    if (window.location.hash !== '#' + item) requestRoute(item)
    else document.getElementById(item)?.scrollIntoView({ block: 'start' })
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
    <CategoryContext.Provider value={catalog}><div className='wallet-layout' data-density={appearance.density} style={appearance.compactSidebar ? { '--sidebar-width': '4.25rem' } as CSSProperties : undefined}>
      <a href={`#${heading}`} onClick={event => { event.preventDefault(); document.getElementById(heading)?.focus() }} className="sr-only z-50 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Saltar al contenido</a>
      <Sidebar active={page} onNavigate={navigate} compact={appearance.compactSidebar} />
      <div className="min-w-0 lg:ml-[var(--sidebar-width)]">
        <Header active={page} onNavigate={navigate} period={period} onPeriod={setPeriod} onRegister={() => openRegister()} page={page} ready={canRegister} alerts={alerts} profile={settings.profile} hidden={hidden} />
        {page === 'cuentas' && <AccountsPage finance={finance} detected={detected} hidden={hidden} initialAccountId={params.get('cuenta') ?? undefined} onClearInitial={() => clearDetail('cuentas')} onTogglePrivacy={togglePrivacy} onMovement={openRegister} onHistory={id => { window.location.hash = `movimientos?cuenta=${encodeURIComponent(id)}` }} onToast={setAnnouncement} />}
        {page === 'presupuestos' && <BudgetsPage defaultWarning={financial.budgetWarning} finance={finance} detected={detected} hidden={hidden} query={query} onClearInitial={() => clearDetail('presupuestos')} onTogglePrivacy={togglePrivacy} onHistory={(category, from, to) => { window.location.hash = `movimientos?${new URLSearchParams({ categoria: category, desde: from, hasta: to, tipo: 'gasto' })}` }} onToast={setAnnouncement} />}
        {page === 'compromisos' && <CommitmentsPage defaultHorizon={financial.horizon} minimumFree={financial.minimumFree} finance={finance} today={asOf} hidden={hidden} initialId={params.get('compromiso')} onClearInitial={() => clearDetail('compromisos')} onTogglePrivacy={togglePrivacy} onMovement={id => { lastFocus.current = null; window.location.hash = `movimientos?movimiento=${encodeURIComponent(id)}` }} onToast={setAnnouncement} />}
        {page === 'hormiga' && <MicroExpensesPage key={query} finance={finance} detected={detected} today={asOf} criteria={criteria} onCriteria={value => settings.updatePreference('detection', value)} hidden={hidden} onTogglePrivacy={togglePrivacy} query={query} onMovement={id => { lastFocus.current = null; window.location.hash = `movimientos?movimiento=${encodeURIComponent(id)}` }} onToast={setAnnouncement} onUseSavings={carrySavingsScenario} />}
        {page === 'metas' && <SavingsGoalsPage key={query} finance={finance} today={asOf} hidden={hidden} onTogglePrivacy={togglePrivacy} scenarios={savingsScenarios} query={query} onToast={setAnnouncement} onMovement={openRegister} />}
        {page === 'salud' && <Suspense fallback={<p role="status" className="p-5 text-sm text-muted-foreground">Cargando Salud financiera…</p>}>
          <FinancialHealthPage key={initialHealthReduction} data={health} repository={healthRepository} period={healthPeriod} hidden={hidden} initialReduction={initialHealthReduction} onPeriod={setHealthPeriod} onPrivacy={togglePrivacy} onRetry={reload} />
        </Suspense>}
        {page === 'asistente' && <Suspense fallback={<main className="mx-auto max-w-[1600px] p-5" aria-busy="true"><p role="status" className="text-sm text-muted-foreground">Cargando Asistente financiero…</p></main>}>
          <FinancialAssistantPage context={analysisContext} session={assistant} selected={params.get('informe')} hidden={hidden} onPrivacy={togglePrivacy} onRegister={openRegister} />
        </Suspense>}
        {page === 'configuracion' && <Suspense fallback={<p role='status' className='p-5 text-sm text-muted-foreground'>Cargando configuración…</p>}>
          <SettingsPage settings={settings} finance={finance} assistant={assistant} session={session} today={asOf} detected={detected} hidden={hidden} dirty={dirty} section={params.get('seccion')}
            onPrivacy={togglePrivacy} onDirty={setDirty} onSection={section => requestRoute('configuracion?seccion=' + section)} onLogout={() => setLogout(true)} onToast={setAnnouncement} />
        </Suspense>}
        {page === 'movimientos' && <>
          <TransactionsPage key={query} initialFilters={historyFilters(query)} movements={movements} accounts={accounts} detected={detected} status={status} onRetry={reload} period={period} onPeriod={setPeriod} hidden={hidden} onTogglePrivacy={togglePrivacy} onRegister={() => openRegister()} onAction={onAction} />
          {movementId && status === 'ready' && !detailMovement && <div role="alert" className="mx-4 mb-4 rounded-xl border border-border p-3">El movimiento solicitado ya no está disponible. <Button variant="ghost" onClick={closeMovementDetail}>Cerrar</Button></div>}
        </>}
        {page === 'dashboard' && (
        <main id="dashboard" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="dashboard-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="dashboard-title" tabIndex={-1} className="font-display text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-extrabold tracking-[-0.045em] outline-none">Resumen financiero</h1>
              <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{formatPeriod(period, asOf)}</p>
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
          <SummaryCards snapshot={snapshot} hidden={hidden} horizon={financial.horizon} />
          {appearance.charts && <div className="grid gap-4 sm:gap-5 min-[1200px]:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <EvolutionChart data={snapshot.chart} hidden={hidden} />
            <ExpenseChart distribution={snapshot.distribution} hidden={hidden} />
          </div>}
          <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
            <BudgetPanel budgets={snapshot.budgets} hidden={hidden} />
            <CommitmentsPanel commitments={snapshot.commitments} today={asOf} hidden={hidden} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 sm:gap-5">
            <SmallExpensesPanel data={snapshot.smallExpenses} hidden={hidden} />
            <FinancialHealthPanel data={health} />
          </div>
          <DashboardSavingsPanel data={snapshot.savings} shortfall={snapshot.savingsShortfall} hidden={hidden} />
          <Recommendations data={snapshot} period={period} hidden={hidden} onAssistant={() => navigate('asistente')} />
          </>}
          <DashboardAnalysis item={latestAnalysis} timeZone={analysisContext.timeZone} hidden={hidden} stale={Boolean(latestAnalysis && latestAnalysis.contextVersion !== analysisVersion)} />
        </main>
        )}
      </div>
      <MovementDialog open={Boolean(editor)} record={editor?.record ?? null} preset={editor?.preset} hidden={hidden} onOpenChange={open => { if (!open) setEditor(null) }} records={records} onSave={saveMovement} onCloseAutoFocus={restoreFocus} />
      {page === 'movimientos' && detailMovement && <TransactionDetailDrawer item={detailMovement} accounts={accounts} detected={detected} hidden={hidden} onClose={closeMovementDetail} onCloseAutoFocus={restoreFocus} onCommitment={id => { setOperation(null); window.location.hash = `compromisos?compromiso=${encodeURIComponent(id)}` }} />}
      {operation?.type === 'delete' && <DeleteTransactionDialog item={operation.item} onDelete={deleteMovement} onClose={() => setOperation(null)} onCloseAutoFocus={restoreFocus} />}
      {pendingRoute && <ConfirmationDialog title='Descartar cambios pendientes' description='Los valores sin guardar se perderán si cambias de sección.' action='Descartar cambios' onClose={() => setPendingRoute(null)} onConfirm={() => {
        window.history.pushState(null, '', '#' + pendingRoute)
        setHash(pendingRoute); setPendingRoute(null); setDirty(false)
      }} />}
      {logout && <ConfirmationDialog title='Cerrar sesión de demostración' description='Se limpiarán los registros locales de esta sesión, los informes y las solicitudes pendientes.' action='Confirmar cierre de sesión' onClose={() => setLogout(false)} onConfirm={onLogout} />}
      <div role="status" aria-atomic="true" className="fixed right-4 bottom-4 z-30 sm:right-7 sm:bottom-6">
        {announcement && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-card px-3 py-2 text-sm font-semibold shadow-xl">
            <CheckCircle2 className="size-[18px] text-primary" aria-hidden="true" />{announcement}
            <Button variant="ghost" size="icon" className="ml-1 size-7" aria-label="Cerrar confirmación" onClick={() => setAnnouncement('')}><X /></Button>
          </div>
        )}
      </div>
    </div></CategoryContext.Provider>
  )
}
