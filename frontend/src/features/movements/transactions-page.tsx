import { useCategoryCatalog } from '@/features/categories/category-context'
import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, CircleAlert, Download, Eye, EyeOff, ListFilter, Plus, ReceiptText, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { PeriodSelect } from '@/features/dashboard/navigation'
import type { Account, Movement, Period } from '@/features/dashboard/model'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { downloadHistory, emptyFilters, filterErrors, filterHistory, type HistorySort, type TransactionFilters } from './history'
import { getPeriodRange, totals } from './movement-data'
import { HistoryFilters } from './transaction-filters'
import { TransactionHistory, TransactionPagination, type TransactionActionHandler } from './transaction-history'

const pageSize = 8

const ordering = [
  { id: 'date-desc', label: 'Fecha · Más recientes' }, { id: 'date-asc', label: 'Fecha · Más antiguos' },
  { id: 'amount-desc', label: 'Monto · Mayor a menor' }, { id: 'amount-asc', label: 'Monto · Menor a mayor' },
] as const

type Status = 'loading' | 'ready' | 'error'
const dateLabel = (value: string) => formatDate(value, { day: 'numeric', month: 'short', year: 'numeric' })

function TransactionSummary({ movements, period, onPeriod, hidden, status }: {
  movements: Movement[]; period: Period; onPeriod: (value: Period) => void; hidden: boolean; status: Status
}) {
  const { from, to } = getPeriodRange(period)
  const { income, expense, net } = totals(movements.filter(item => item.date >= from && item.date <= to))
  const cards = [
    { label: 'Total de ingresos', amount: income, icon: ArrowDownLeft, color: 'text-emerald-300', surface: 'bg-primary/12' },
    { label: 'Total de gastos', amount: expense, icon: ArrowUpRight, color: 'text-red-300', surface: 'bg-danger/12' },
    { label: 'Balance neto', amount: net, icon: Wallet, color: net < 0 ? 'text-red-300' : 'text-blue-300', surface: net < 0 ? 'bg-danger/12' : 'bg-blue-400/12' },
  ]

  return (
    <section aria-labelledby="transaction-summary-title" aria-busy={status === 'loading'}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h2 id="transaction-summary-title" className="text-[15px] font-bold">Resumen del período</h2><p className="mt-0.5 text-xs text-muted-foreground">{dateLabel(from)} – {dateLabel(to)}</p></div>
        <PeriodSelect period={period} onChange={onPeriod} label="Período de análisis" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3" aria-label="Totales del período de movimientos">
        {cards.map(({ label, amount, icon: Icon, color, surface }) => (
          <article className="panel flex items-start justify-between gap-2 p-3.5 sm:p-[18px]" key={label}>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
              {status === 'loading' ? <div className="mt-2 h-8 w-27 animate-pulse rounded-md bg-accent" aria-hidden="true" />
                : <p className={cn('mt-1.5 text-[clamp(1.35rem,2.5vw,1.85rem)] leading-tight font-bold tracking-[-0.045em] tabular-nums wrap-anywhere', label === 'Balance neto' && color)}>{status === 'ready' ? formatMoney(amount, hidden) : '—'}</p>}
              {label === 'Balance neto' && <p className="mt-1 text-xs text-muted-foreground">Ingresos menos gastos</p>}
            </div>
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg sm:size-9', surface, color)}><Icon className="size-[18px]" aria-hidden="true" /></span>
          </article>
        ))}
      </div>
    </section>
  )
}

function HistoryState({ status, empty, invalid, onReset, onRetry, onRegister }: {
  status: Status; empty: boolean; invalid: boolean; onReset: () => void; onRetry: () => void; onRegister?: () => void
}) {
  if (status === 'loading') return (
    <div className="space-y-3 p-5" role="status" aria-label="Cargando movimientos">
      {Array.from({ length: 4 }, (_, index) => <div className="h-11 animate-pulse rounded-lg bg-accent/85" aria-hidden="true" key={index} />)}
    </div>
  )
  const state = status === 'error'
    ? { icon: CircleAlert, title: 'No se pudieron cargar los movimientos', text: 'Vuelve a intentar para consultar el historial.', button: 'Reintentar', run: onRetry }
    : invalid ? { icon: CircleAlert, title: 'Revisa los rangos de filtros', text: 'Corrige las fechas o los montos para consultar el historial.', button: 'Restablecer filtros', run: onReset }
      : empty ? { icon: ReceiptText, title: 'Aún no tienes movimientos', text: onRegister ? 'Agrega un ingreso, gasto o transferencia para comenzar.' : 'Crea o reactiva una cuenta para registrar movimientos.', button: 'Nuevo movimiento', run: onRegister }
        : { icon: ListFilter, title: 'Sin resultados', text: 'Ajusta la búsqueda o restablece los filtros activos.', button: 'Restablecer filtros', run: onReset }
  const Icon = state.icon
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center" role={status === 'error' ? 'alert' : undefined}>
      <span className="mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <h3 className="font-semibold">{state.title}</h3><p className="mt-1 text-sm text-muted-foreground">{state.text}</p>
      {state.run && <Button variant="outline" size="sm" className="mt-4" onClick={state.run}>{state.button}</Button>}
    </div>
  )
}

export function TransactionsPage({ movements, accounts, detected, status, onRetry, period, onPeriod, hidden, onTogglePrivacy, onRegister, onAction, initialFilters }: {
  movements: Movement[]; accounts: Account[]; detected: ReadonlySet<string>; status: Status; onRetry: () => void;
  period: Period; onPeriod: (period: Period) => void; hidden: boolean; onTogglePrivacy: () => void;
  onRegister: () => void; onAction: TransactionActionHandler; initialFilters?: Partial<TransactionFilters>;
}) {
  const catalog = useCategoryCatalog()
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...initialFilters }))
  const [sort, setSort] = useState<HistorySort>('date-desc')
  const [page, setPage] = useState(1)
  const { dates, amounts } = filterErrors(filters)
  const canRegister = status === 'ready' && accounts.some(account => account.status === 'activa')
  const invalid = Boolean(dates || amounts)
  const filtered = useMemo(() => invalid ? [] : filterHistory(movements, filters, detected, sort), [movements, filters, detected, sort, invalid])
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function applyFilters(value: TransactionFilters) {
    setFilters(value)
    setPage(1)
  }

  return (
    <main id="movimientos" className="dashboard-anchor mx-auto flex max-w-[1600px] flex-col gap-5 px-4 pt-5 pb-8 sm:px-7 sm:pt-7 2xl:px-9" aria-labelledby="movements-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="movements-title" tabIndex={-1} className="text-[clamp(1.7rem,3vw,2.1rem)] leading-tight font-bold tracking-[-0.045em] outline-none">Movimientos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controla tus ingresos, gastos y transferencias.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
          <Button variant="outline" disabled={!filtered.length || status !== 'ready'} onClick={() => downloadHistory(filtered, accounts, detected, catalog)} title={hidden ? 'El CSV incluye los montos' : undefined}><Download aria-hidden="true" /> Exportar CSV</Button>
          <Button className="flex-1 sm:flex-none" disabled={!canRegister} onClick={onRegister}><Plus aria-hidden="true" /> Nuevo movimiento</Button>
        </div>
      </div>
      <TransactionSummary movements={movements} period={period} onPeriod={onPeriod} hidden={hidden} status={status} />
      <section className="panel" aria-labelledby="history-title" aria-busy={status === 'loading'}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div>
            <h2 id="history-title" className="flex items-center gap-2.5 text-lg font-bold tracking-[-0.025em]"><ReceiptText className="size-[18px] text-primary" aria-hidden="true" /> Historial de movimientos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Busca y filtra los registros del historial.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Ordenar por">{id => <Select id={id} value={sort} onChange={event => { setSort(event.target.value as HistorySort); setPage(1) }} className="h-9">
              {ordering.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </Select>}</Field>
            <Button variant="outline" className="h-9 max-sm:w-9 max-sm:px-0" onClick={onTogglePrivacy} aria-pressed={hidden}>
              {hidden ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}<span className="max-sm:sr-only">{hidden ? 'Mostrar montos' : 'Ocultar montos'}</span>
            </Button>
          </div>
        </div>
        <HistoryFilters accounts={accounts} value={filters} onChange={applyFilters} hidden={hidden} />
        {status !== 'ready' || !filtered.length
          ? <HistoryState status={status} empty={!movements.length} invalid={invalid} onReset={() => applyFilters(emptyFilters)} onRetry={onRetry} onRegister={canRegister ? onRegister : undefined} />
          : <><TransactionHistory items={visible} accounts={accounts} detected={detected} hidden={hidden} onAction={onAction} />
            <TransactionPagination page={currentPage} pageSize={pageSize} count={filtered.length} onPage={setPage} /></>}
      </section>
    </main>
  )
}
