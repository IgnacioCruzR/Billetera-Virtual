import { useRef } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, Coffee, Ellipsis, Eye, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { microExpenseLabels, type Account, type MicroExpenseStatus, type Movement, type MovementType } from '@/features/dashboard/model'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { accountLabel, categoryLabel, movementTypeLabel } from './history'
import { classificationOf } from './movement-data'

const typeStyles = {
  ingreso: { tone: 'bg-primary/12 text-emerald-300', text: 'text-emerald-300', icon: ArrowDownLeft },
  gasto: { tone: 'bg-danger/12 text-red-300', text: 'text-red-300', icon: ArrowUpRight },
  transferencia: { tone: 'bg-blue-400/12 text-blue-300', text: 'text-blue-300', icon: ArrowLeftRight },
}

export function TransactionIcon({ type, className }: { type: MovementType; className?: string }) {
  const { tone, icon: Icon } = typeStyles[type]
  return <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tone, className)}><Icon className="size-[17px]" aria-hidden="true" /></span>
}

export function TransactionTypeBadge({ type }: { type: MovementType }) {
  return <span className={cn('inline-block rounded-md px-2 py-1 text-xs font-semibold', typeStyles[type].tone)}>{movementTypeLabel(type)}</span>
}

const classificationTone: Record<MicroExpenseStatus, string> = {
  posible: 'bg-warning/12 text-amber-300', necesario: 'bg-accent text-foreground/90',
  prescindible: 'bg-primary/12 text-emerald-200', excluido: 'bg-accent text-muted-foreground', 'sin-clasificacion': 'text-muted-foreground',
}

export function MicroExpenseBadge({ status }: { status: MicroExpenseStatus }) {
  if (status === 'sin-clasificacion') return <span className="text-xs text-muted-foreground">Sin clasificación</span>
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium leading-tight', classificationTone[status])}><Coffee className="size-3 shrink-0" aria-hidden="true" />{microExpenseLabels[status]}</span>
}

export function TransactionAmount({ item, hidden }: { item: Movement; hidden: boolean }) {
  const sign = item.type === 'ingreso' ? '+' : item.type === 'gasto' ? '−' : ''
  return <span className={cn('font-semibold tabular-nums wrap-anywhere', typeStyles[item.type].text)}>{hidden ? formatMoney(item.amount, true) : `${sign}${formatMoney(item.amount)}`}</span>
}

export function transactionDescription(item: Movement) {
  return item.description || (item.type === 'transferencia' ? 'Transferencia interna' : 'Sin descripción')
}

export type TransactionAction = 'detail' | 'edit' | 'delete'
export type TransactionActionHandler = (action: TransactionAction, item: Movement, trigger: HTMLElement | null) => void

const actions = [
  { id: 'detail', label: 'Ver detalle', icon: Eye }, { id: 'edit', label: 'Editar', icon: Pencil },
  { id: 'delete', label: 'Eliminar', icon: Trash2 },
] as const

function TransactionActions({ item, onAction }: { item: Movement; onAction: TransactionActionHandler }) {
  const trigger = useRef<HTMLButtonElement | null>(null)
  const selected = useRef(false)
  return (
    <Popover onOpenChange={open => { if (open) selected.current = false }}>
      <PopoverTrigger asChild>
        <Button ref={trigger} variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${transactionDescription(item)}`}><Ellipsis aria-hidden="true" /></Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Acciones del movimiento" className="w-40 p-1" onCloseAutoFocus={event => { if (selected.current) event.preventDefault() }}>
        {actions.filter(action => action.id !== 'delete' || !item.commitmentId).map(({ id, label, icon: Icon }) => (
          <PopoverClose asChild key={id}>
            <Button variant="ghost" className={cn('h-9 w-full justify-start px-2 font-medium', id === 'delete' && 'text-red-300 hover:bg-danger/10 hover:text-red-200')}
              onClick={() => { selected.current = true; onAction(id, item, trigger.current) }}>
              <Icon aria-hidden="true" />{label}
            </Button>
          </PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function TransactionAccounts({ item, accounts }: { item: Movement; accounts: Account[] }) {
  return item.type === 'transferencia'
    ? <span className="block leading-snug">{accountLabel(accounts, item.accountId)} <span className="text-muted-foreground" aria-label="a">→</span> {accountLabel(accounts, item.destinationId)}</span>
    : <span>{accountLabel(accounts, item.accountId)}</span>
}

type HistoryRowsProps = { items: Movement[]; accounts: Account[]; detected: ReadonlySet<string>; hidden: boolean; onAction?: TransactionActionHandler }

const displayDate = (date: string) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })

function TransactionTable({ items, accounts, detected, hidden, onAction }: HistoryRowsProps) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Historial de movimientos filtrados</caption>
        <thead className="border-b border-border bg-secondary/55 text-xs font-semibold text-muted-foreground">
          <tr>
            <th scope="col" className="w-14 py-3 pl-5"><span className="sr-only">Icono</span></th>
            {['Descripción', 'Tipo', 'Categoría', 'Cuenta', 'Fecha', 'Monto', 'Clasificación'].map(label => <th scope="col" key={label} className={cn('px-2 py-3', label === 'Monto' && 'text-right')}>{label}</th>)}
            {onAction && <th scope="col" className="w-13 py-3 pr-4"><span className="sr-only">Acciones</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(item => (
            <tr key={item.id} className="transition-colors hover:bg-white/2">
              <td className="py-2.5 pl-5"><TransactionIcon type={item.type} className="size-8" /></td>
              <th scope="row" className="max-w-52 px-2 py-2.5 font-semibold wrap-anywhere">{transactionDescription(item)}</th>
              <td className="px-2 py-2.5"><TransactionTypeBadge type={item.type} /></td>
              <td className="px-2 py-2.5 text-muted-foreground">{categoryLabel(item) || '—'}</td>
              <td className="max-w-42 px-2 py-2.5 text-muted-foreground"><TransactionAccounts item={item} accounts={accounts} /></td>
              <td className="px-2 py-2.5 text-muted-foreground"><time dateTime={item.date}>{displayDate(item.date)}</time></td>
              <td className="px-2 py-2.5 text-right"><TransactionAmount item={item} hidden={hidden} /></td>
              <td className="max-w-37 px-2 py-2.5">{item.type === 'gasto' ? <MicroExpenseBadge status={classificationOf(item, detected)} /> : <span className="text-muted-foreground">—</span>}</td>
              {onAction && <td className="py-2.5 pr-3 text-right"><TransactionActions item={item} onAction={onAction} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TransactionCards({ items, accounts, detected, hidden, onAction }: HistoryRowsProps) {
  return (
    <ul className="space-y-2.5 px-3 py-3 lg:hidden" aria-label="Movimientos del historial">
      {items.map(item => {
        const classification = classificationOf(item, detected)
        return (
          <li key={item.id} className="rounded-xl border border-border bg-secondary/65 p-3">
            <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5">
              <TransactionIcon type={item.type} />
              <div className="min-w-0"><p className="text-sm font-semibold wrap-anywhere">{transactionDescription(item)}</p><time className="text-xs text-muted-foreground" dateTime={item.date}>{displayDate(item.date)}</time></div>
              {onAction && <TransactionActions item={item} onAction={onAction} />}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><TransactionTypeBadge type={item.type} /><TransactionAmount item={item} hidden={hidden} /></div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
              <TransactionAccounts item={item} accounts={accounts} />{categoryLabel(item) && <span>{categoryLabel(item)}</span>}
              {classification !== 'sin-clasificacion' && <MicroExpenseBadge status={classification} />}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function TransactionHistory(props: HistoryRowsProps) {
  return <><TransactionTable {...props} /><TransactionCards {...props} /></>
}

export function TransactionPagination({ page, pageSize, count, onPage }: { page: number; pageSize: number; count: number; onPage: (page: number) => void }) {
  const last = Math.ceil(count / pageSize)
  return (
    <nav aria-label="Paginación del historial" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5 sm:px-5">
      <p className="text-sm tabular-nums text-muted-foreground">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, count)} de {count} movimientos</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
        <span className="min-w-16 text-center text-sm font-medium tabular-nums" aria-live="polite">{page} de {last}</span>
        <Button variant="outline" size="icon" className="size-8" onClick={() => onPage(page + 1)} disabled={page >= last} aria-label="Página siguiente"><ChevronRight aria-hidden="true" /></Button>
      </div>
    </nav>
  )
}
