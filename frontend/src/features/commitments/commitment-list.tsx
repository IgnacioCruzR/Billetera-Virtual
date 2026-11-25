import { useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Ban, CheckCircle2, Ellipsis, Eye, Pencil, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { expenseCategories, incomeCategories } from '@/features/dashboard/mock-data'
import type { Account } from '@/features/dashboard/model'
import { accountLabel } from '@/features/movements/history'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { filterCommitments, visualStatus } from './cash-flow'
import type { CommitmentFilters, CommitmentSort, CommitmentType, CommitmentVisualStatus, FinancialCommitment } from './commitment-model'

export const commitmentTypes = [{ id: 'cobro', label: 'Cobro' }, { id: 'pago', label: 'Pago' }] as const
export const commitmentTypeLabel = (type: CommitmentType) => type === 'cobro' ? 'Cobro' : 'Pago'
export const categoriesForCommitment = (type: CommitmentType) => type === 'cobro' ? incomeCategories : expenseCategories
export const commitmentCategoryLabel = (item: FinancialCommitment) => categoriesForCommitment(item.type).find(category => category.id === item.categoryId)?.name ?? item.categoryId
export const compactDate = (date: string) => formatDate(date, { day: 'numeric', month: 'short' })
export const longDate = (date: string) => formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })

const statusLabels: Record<CommitmentVisualStatus, { text: string; tone: string }> = {
  pendiente: { text: 'Pendiente', tone: 'bg-accent text-muted-foreground' },
  'por-vencer': { text: 'Por vencer', tone: 'bg-warning/10 text-amber-300' },
  vencido: { text: 'Vencido', tone: 'bg-warning/16 text-amber-200' },
  confirmado: { text: 'Confirmado', tone: 'bg-primary/12 text-emerald-300' },
  cancelado: { text: 'Cancelado', tone: 'bg-secondary text-muted-foreground' },
}

export function CommitmentStatusBadge({ item, today }: { item: FinancialCommitment; today: string }) {
  const style = statusLabels[visualStatus(item, today)]
  return <span className={cn('inline-flex rounded-md px-2 py-1 text-xs font-semibold', style.tone)}>{style.text}</span>
}

export function CommitmentIcon({ type }: { type: CommitmentType }) {
  const Icon = type === 'cobro' ? ArrowDownLeft : ArrowUpRight
  return <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', type === 'cobro' ? 'bg-primary/12 text-emerald-300' : 'bg-danger/12 text-red-300')}><Icon className="size-[18px]" aria-hidden="true" /></span>
}

export function CommitmentAmount({ type, amount, hidden }: { type: CommitmentType; amount: number; hidden: boolean }) {
  return <span className={cn('font-semibold tabular-nums wrap-anywhere', type === 'cobro' ? 'text-emerald-300' : 'text-red-300')}>{!hidden && (type === 'cobro' ? '+' : '−')}{formatMoney(amount, hidden)}</span>
}

export type CommitmentAction = 'detail' | 'edit' | 'confirm' | 'cancel'
export type CommitmentActionHandler = (action: CommitmentAction, id: string, trigger: HTMLElement | null) => void

const actions = [
  { id: 'detail', label: 'Ver detalle', icon: Eye }, { id: 'edit', label: 'Editar compromiso', icon: Pencil },
  { id: 'confirm', label: 'Confirmar compromiso', icon: CheckCircle2 }, { id: 'cancel', label: 'Cancelar compromiso', icon: Ban },
] as const

function CommitmentActions({ item, onAction }: { item: FinancialCommitment; onAction: CommitmentActionHandler }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = useRef(false)
  return (
    <Popover onOpenChange={open => { if (open) selected.current = false }}>
      <PopoverTrigger asChild><Button size="icon" variant="ghost" className="size-8" ref={trigger} aria-label={`Acciones de ${item.name}`}><Ellipsis aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent aria-label="Acciones del compromiso" align="end" className="w-54 p-1" onCloseAutoFocus={event => { if (selected.current) event.preventDefault() }}>
        {actions.filter(action => action.id === 'detail' || item.status === 'pendiente').map(({ id, icon: Icon, label }) => (
          <PopoverClose asChild key={id}><Button variant="ghost" className={cn('h-8 w-full justify-start px-2', id === 'cancel' && 'text-red-300 hover:text-red-200')} onClick={() => { selected.current = true; onAction(id, item.id, trigger.current) }}><Icon aria-hidden="true" />{label}</Button></PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function CommitmentRows({ items, accounts, today, hidden, onAction, compact = false }: {
  items: FinancialCommitment[]; accounts: Account[]; today: string; hidden: boolean; onAction: CommitmentActionHandler; compact?: boolean;
}) {
  return <>
    {!compact && <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm">
      <caption className="sr-only">Listado de cobros y pagos</caption>
      <thead className="border-y border-border bg-secondary/60 text-xs text-muted-foreground"><tr>{['Nombre', 'Tipo', 'Categoría', 'Cuenta', 'Vencimiento', 'Monto', 'Estado', 'Acciones'].map(label => <th key={label} scope="col" className="px-3 py-3 first:pl-5 last:text-right">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-border">{items.map(item => <tr key={item.id} className={visualStatus(item, today) === 'vencido' ? 'bg-warning/4' : undefined}>
        <th scope="row" className="px-3 py-2.5 pl-5"><div className="flex items-center gap-2.5"><CommitmentIcon type={item.type} /><Button variant="ghost" className="h-auto justify-start px-0 py-1 text-left font-semibold whitespace-normal text-foreground wrap-anywhere hover:text-emerald-300" onClick={event => onAction('detail', item.id, event.currentTarget)}>{item.name}</Button></div></th>
        <td className="px-3 py-2.5">{commitmentTypeLabel(item.type)}</td><td className="px-3 py-2.5 text-muted-foreground">{commitmentCategoryLabel(item)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{accountLabel(accounts, item.accountId)}</td><td className="px-3 py-2.5"><time dateTime={item.dueDate}>{longDate(item.dueDate)}</time></td>
        <td className="px-3 py-2.5"><CommitmentAmount type={item.type} amount={item.amount} hidden={hidden} /></td><td className="px-3 py-2.5"><CommitmentStatusBadge item={item} today={today} /></td>
        <td className="px-3 py-2.5 text-right"><CommitmentActions item={item} onAction={onAction} /></td>
      </tr>)}</tbody>
    </table></div>}
    <ul className={cn('grid gap-2.5', compact ? '' : 'px-3 py-3 lg:hidden')} aria-label={compact ? 'Compromisos del día' : 'Cobros y pagos'}>{items.map(item => <li className={cn('min-w-0 rounded-xl border border-border bg-secondary/50 p-3', visualStatus(item, today) === 'vencido' && 'border-warning/35')} key={item.id}>
      <div className="flex min-w-0 items-start gap-2.5"><CommitmentIcon type={item.type} /><div className="min-w-0 flex-1"><Button variant="ghost" className="h-auto max-w-full justify-start px-0 py-0 text-left whitespace-normal text-foreground wrap-anywhere" onClick={event => onAction('detail', item.id, event.currentTarget)}>{item.name}</Button><p className="mt-0.5 text-xs text-muted-foreground">{commitmentTypeLabel(item.type)} · <time dateTime={item.dueDate}>{longDate(item.dueDate)}</time></p></div><CommitmentActions item={item} onAction={onAction} /></div>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5"><CommitmentStatusBadge item={item} today={today} /><CommitmentAmount type={item.type} amount={item.amount} hidden={hidden} /></div>
      <p className="mt-2 text-xs text-muted-foreground">{accountLabel(accounts, item.accountId)} · {commitmentCategoryLabel(item)}</p>
    </li>)}</ul>
  </>
}

const emptyFilters: CommitmentFilters = { search: '', type: '', status: '', accountId: '', categoryId: '', from: '', to: '' }

export function CommitmentList({ items, accounts, today, hidden, onAction }: { items: FinancialCommitment[]; accounts: Account[]; today: string; hidden: boolean; onAction: CommitmentActionHandler }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [sort, setSort] = useState<CommitmentSort>('prioridad')
  const filtered = useMemo(() => filterCommitments(items, filters, sort, today), [items, filters, sort, today])
  const categories = filters.type ? categoriesForCommitment(filters.type) : [...incomeCategories, ...expenseCategories]
  const patch = (value: Partial<CommitmentFilters>) => setFilters(current => ({ ...current, ...value }))
  const invalid = Boolean(filters.from && filters.to && filters.from > filters.to)

  return <section className="panel" aria-label="Historial de compromisos">
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold tracking-tight">Historial de compromisos</h2><Button size="sm" variant="ghost" onClick={() => { setFilters(emptyFilters); setSort('prioridad') }} disabled={filters === emptyFilters && sort === 'prioridad'}>Limpiar filtros</Button></div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <div className="relative col-span-2"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" /><Input type="search" value={filters.search} onChange={event => patch({ search: event.target.value })} placeholder="Buscar por nombre o notas" aria-label="Buscar compromisos" className="pl-9" /></div>
        <Select aria-label="Tipo de compromiso" value={filters.type} onChange={event => patch({ type: event.target.value as CommitmentFilters['type'], categoryId: '' })}><option value="">Todos los tipos</option><option value="cobro">Cobros</option><option value="pago">Pagos</option></Select>
        <Select aria-label="Estado del compromiso" value={filters.status} onChange={event => patch({ status: event.target.value as CommitmentFilters['status'] })}><option value="">Todos los estados</option><option value="pendiente">Pendientes</option><option value="vencido">Vencidos</option><option value="confirmado">Confirmados</option><option value="cancelado">Cancelados</option></Select>
        <Select aria-label="Cuenta del compromiso" value={filters.accountId} onChange={event => patch({ accountId: event.target.value })}><option value="">Todas las cuentas</option>{accounts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>
        <Select aria-label="Categoría del compromiso" value={filters.categoryId} onChange={event => patch({ categoryId: event.target.value })}><option value="">Todas las categorías</option>{categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>
        <div className="col-span-2 min-w-0"><Select aria-label="Ordenar compromisos" value={sort} onChange={event => setSort(event.target.value as CommitmentSort)}><option value="prioridad">Ordenar por prioridad</option><option value="fecha">Por fecha de vencimiento</option><option value="monto">Por monto</option><option value="estado">Por estado</option></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:max-w-sm"><Field label="Vencimiento desde">{id => <Input id={id} type="date" value={filters.from} onChange={event => patch({ from: event.target.value })} />}</Field><Field label="Vencimiento hasta" error={invalid ? 'Elige una fecha igual o posterior a la de inicio.' : undefined}>{(id, attrs) => <Input id={id} type="date" value={filters.to} onChange={event => patch({ to: event.target.value })} {...attrs} />}</Field></div>
    </div>
    {invalid ? null : filtered.length ? <CommitmentRows items={filtered} accounts={accounts} today={today} hidden={hidden} onAction={onAction} /> : <p className="border-t border-border p-6 text-center text-sm text-muted-foreground">{items.length ? 'No hay compromisos que coincidan con los filtros.' : 'Aún no hay compromisos registrados.'}</p>}
  </section>
}
