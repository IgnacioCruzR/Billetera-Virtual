import { useMemo, useState } from 'react'
import { Copy, Eye, EyeOff, Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { useFinancialRecords } from '@/features/accounts/account-data'
import { budgetBounds, budgetHistory, budgetPhase, parseBudgetPeriod, summarizeBudgets } from './budget-calculations'
import type { BudgetPeriod } from './budget-model'
import { BudgetCard, type BudgetActionHandler } from './budget-cards'
import { BudgetDistributionChart, BudgetHistoryChart } from './budget-charts'
import { BudgetPeriodSelector, periodLabel } from './budget-controls'
import { BudgetDetailDrawer, BudgetForm, DeleteBudgetDialog, DuplicateBudgetDialog } from './budget-dialogs'
import { BudgetAlerts, BudgetPace, BudgetRecommendations, BudgetSummaryCards, UnbudgetedExpenses } from './budget-overview'

type Modal = { type: 'create'; category?: string } | { type: 'copy-all' } | { type: 'detail' | 'edit' | 'duplicate' | 'delete'; id: string }
export function BudgetsPage({ defaultWarning, finance, detected, today, hidden, onTogglePrivacy, onHistory, onToast, query, onClearInitial }: {
  defaultWarning: number; today: string;
  finance: ReturnType<typeof useFinancialRecords>; detected: ReadonlySet<string>; hidden: boolean; onTogglePrivacy: () => void;
  onHistory: (category: string, from: string, to: string) => void; onToast: (message: string) => void;
  query?: string; onClearInitial: () => void;
}) {
  const currentPeriod = parseBudgetPeriod(today.slice(0, 7))!
  const params = new URLSearchParams(query)
  const initialId = params.get('presupuesto')
  const [period, setPeriod] = useState<BudgetPeriod>(() => parseBudgetPeriod(params.get('mes') ?? '') ?? currentPeriod)
  const [modal, setModal] = useState<Modal | null>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const { records, status } = finance
  const data = useMemo(() => summarizeBudgets(records.budgets, records.movements, period, today), [records.budgets, records.movements, period, today])
  const history = useMemo(() => budgetHistory(records.budgets, records.movements, period, today), [records.budgets, records.movements, period, today])
  const activeModal = modal ?? (initialId ? { type: 'detail' as const, id: initialId } : null)
  const selected = activeModal && 'id' in activeModal ? data.items.find(item => item.id === activeModal.id) : undefined
  const source = modal?.type === 'copy-all' ? data.items : selected ? [selected] : []

  function open(value: Modal, source: HTMLElement | null) { onToast(''); setTrigger(source); setModal(value) }
  function close() { setModal(null); if (initialId) onClearInitial() }
  function restoreFocus(event: Event) {
    event.preventDefault()
    if (trigger?.isConnected) trigger.focus({ preventScroll: true })
    else document.getElementById('budgets-title')?.focus({ preventScroll: true })
  }
  const onAction: BudgetActionHandler = (type, id, element) => open({ type, id }, element)

  return (
    <main id="presupuestos" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-4 px-4 pt-5 pb-8 sm:gap-5 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="budgets-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 id="budgets-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-bold tracking-[-0.045em] outline-none">Presupuestos</h1><p className="mt-1 text-sm text-muted-foreground">Planifica tus gastos y toma el control.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onTogglePrivacy} aria-pressed={hidden}>{hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}{hidden ? 'Mostrar montos' : 'Ocultar montos'}</Button>
          <Button disabled={status !== 'ready'} onClick={event => open({ type: 'create' }, event.currentTarget)}><Plus aria-hidden="true" /> Nuevo presupuesto</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5" aria-label="Controles de planificación">
        <div className="min-w-0"><h2 className="text-[15px] font-bold first-letter:uppercase" aria-live="polite">{periodLabel(period)}</h2><p className="mt-0.5 text-xs text-muted-foreground">Período de planificación</p></div>
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <BudgetPeriodSelector period={period} onPeriod={setPeriod} />
          {period !== currentPeriod && <Button variant="ghost" onClick={() => setPeriod(currentPeriod)}>Este mes</Button>}
          <Button variant="outline" disabled={status !== 'ready' || !data.items.length} onClick={event => open({ type: 'copy-all' }, event.currentTarget)}><Copy aria-hidden="true" /> Duplicar planificación</Button>
        </div>
      </div>
      {status === 'loading' && <div role="status" aria-label="Cargando presupuestos" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="panel h-22 animate-pulse bg-accent" />)}</div>}
      {status === 'error' && <div role="alert" className="panel flex flex-wrap items-center gap-3 p-4"><p>No se pudieron cargar los presupuestos.</p><Button variant="outline" onClick={finance.reload}>Reintentar</Button></div>}
      {status === 'ready' && <>
        <BudgetSummaryCards summary={data.summary} hidden={hidden} />
        <BudgetPace summary={data.summary} period={period} phase={budgetPhase(period, today)} today={today} hidden={hidden} />
        <section aria-label="Presupuestos por categoría">
          <h2 className="mb-3 text-lg font-bold tracking-tight">Presupuestos por categoría</h2>
          {data.items.length ? <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            {data.items.map(budget => <BudgetCard budget={budget} key={budget.id} hidden={hidden} onAction={onAction} />)}
          </div> : <div className="panel flex flex-col items-center gap-2 px-4 py-7 text-center"><Target className="size-6 text-primary" aria-hidden="true" /><p className="font-semibold">El mes aún no tiene presupuestos.</p><Button variant="outline" size="sm" className="mt-1" onClick={event => open({ type: 'create' }, event.currentTarget)}>Crear un presupuesto</Button></div>}
        </section>
        <div className="grid gap-4 sm:gap-5 min-[1150px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <BudgetHistoryChart data={history} hidden={hidden} /><BudgetDistributionChart budgets={data.items} hidden={hidden} />
        </div>
        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <UnbudgetedExpenses summary={data.summary} hidden={hidden} onCreate={(category, element) => open({ type: 'create', category }, element)} />
          <BudgetRecommendations budgets={data.items} summary={data.summary} history={history} />
        </div>
        <BudgetAlerts budgets={data.items} />
      </>}
      {(modal?.type === 'create' || (modal?.type === 'edit' && selected)) && <BudgetForm defaultWarning={defaultWarning} records={records} period={period} suggestedCategory={modal.type === 'create' ? modal.category : undefined} editing={selected} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onSave={async (draft, id) => {
        await finance.saveBudget(draft, id)
        setPeriod(draft.period)
        onToast(id ? 'Presupuesto actualizado.' : 'Presupuesto creado.')
      }} />}
      {(modal?.type === 'duplicate' || modal?.type === 'copy-all') && source.length > 0 && <DuplicateBudgetDialog source={source} budgets={records.budgets} all={modal.type === 'copy-all'} onClose={close} onCloseAutoFocus={restoreFocus} onDuplicate={async (ids, destination) => {
        await finance.duplicateBudgets(ids, destination)
        setPeriod(destination)
        onToast(modal.type === 'copy-all' ? 'Planificación duplicada.' : 'Presupuesto duplicado.')
      }} />}
      {modal?.type === 'delete' && selected && <DeleteBudgetDialog budget={selected} onClose={close} onCloseAutoFocus={restoreFocus} onDelete={async () => {
        await finance.removeBudget(selected.id)
        onToast('Presupuesto eliminado.')
      }} />}
      {initialId && status === 'ready' && !selected && <div role="alert" className="panel p-3 text-sm">El presupuesto solicitado ya no está disponible. <Button variant="ghost" size="sm" onClick={close}>Cerrar</Button></div>}
      {activeModal?.type === 'detail' && selected && <BudgetDetailDrawer budget={selected} records={records} detected={detected} hidden={hidden} onClose={close} onCloseAutoFocus={restoreFocus} onHistory={() => {
        const { from, to } = budgetBounds(selected.period)
        close()
        onHistory(selected.categoryId, from, to)
      }} />}
    </main>
  )
}
