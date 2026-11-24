import { useRef } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, Ellipsis, Landmark, Pencil, PiggyBank, RotateCcw, Smartphone, Trash2, Wallet, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Account, AccountType, MovementPreset } from '@/features/dashboard/model'
import { cn, formatMoney } from '@/lib/utils'
import type { AccountWithBalance } from './account-balances'
import { accountTypeLabel } from './account-data'

export const accountIcons = { efectivo: Banknote, corriente: Landmark, vista: WalletCards, ahorro: PiggyBank, digital: Smartphone, otra: Wallet }

export function AccountIcon({ account, className }: { account: Pick<Account, 'icon' | 'color'>; className?: string }) {
  const Icon = accountIcons[account.icon]
  return <span className={cn('grid size-11 shrink-0 place-items-center rounded-xl border border-border text-foreground', className)} style={{ backgroundColor: `${account.color}25` }}><Icon className="size-[21px]" aria-hidden="true" /></span>
}

export function AccountStatusBadge({ status }: { status: Account['status'] }) {
  return <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', status === 'activa' ? 'bg-primary/12 text-emerald-300' : 'bg-secondary text-muted-foreground')}>{status === 'activa' ? 'Activa' : 'Archivada'}</span>
}

type AccountAction = 'detail' | 'edit' | 'adjust' | 'archive' | 'reactivate' | 'delete' | 'history'
export type AccountActionHandler = (action: AccountAction, account: AccountWithBalance, trigger: HTMLElement | null) => void
export type AccountMovementHandler = (preset: MovementPreset, trigger: HTMLElement | null) => void

const quickActions = [
  { type: 'ingreso', label: 'Registrar ingreso', shortLabel: 'Ingreso', icon: ArrowDownLeft, tone: 'text-emerald-300' },
  { type: 'gasto', label: 'Registrar gasto', shortLabel: 'Gasto', icon: ArrowUpRight, tone: 'text-red-300' },
  { type: 'transferencia', label: 'Transferir dinero', shortLabel: 'Transferir', icon: ArrowLeftRight, tone: 'text-blue-300' },
] as const

export function AccountQuickActions({ count, onMovement }: { count: number; onMovement: AccountMovementHandler }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" aria-label="Acciones rápidas" role="group">
      {quickActions.map(({ type, label, shortLabel, icon: Icon, tone }) => (
        <Button variant="outline" key={type} aria-label={label} className="min-w-0 max-sm:h-13 max-sm:flex-col max-sm:gap-0.5 max-sm:px-1 max-sm:text-xs" disabled={count < (type === 'transferencia' ? 2 : 1)} onClick={event => onMovement({ type }, event.currentTarget)}>
          <Icon className={tone} aria-hidden="true" /><span className="sm:hidden">{shortLabel}</span><span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
    </div>
  )
}

function AccountActions({ account, canTransfer, onAction, onMovement }: {
  account: AccountWithBalance; canTransfer: boolean; onAction: AccountActionHandler; onMovement: AccountMovementHandler;
}) {
  const trigger = useRef<HTMLButtonElement | null>(null)
  const selected = useRef(false)
  const active = account.status === 'activa'
  const actions = [
    { id: 'detail', label: 'Ver detalle', icon: Wallet }, { id: 'edit', label: 'Editar cuenta', icon: Pencil },
    ...(active ? [{ id: 'adjust', label: 'Ajustar saldo', icon: Banknote }, { id: 'archive', label: 'Archivar cuenta', icon: WalletCards }] as const
      : [{ id: 'reactivate', label: 'Reactivar cuenta', icon: RotateCcw }] as const),
    { id: 'delete', label: 'Eliminar cuenta', icon: Trash2 },
  ] as const

  return (
    <Popover onOpenChange={open => { if (open) selected.current = false }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" ref={trigger} size="icon" className="size-8" aria-label={`Acciones de ${account.name}`}><Ellipsis aria-hidden="true" /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-46 p-1" align="end" aria-label="Acciones de la cuenta" onCloseAutoFocus={event => { if (selected.current) event.preventDefault() }}>
        {actions.slice(0, 2).map(({ id, label, icon: Icon }) => (
          <PopoverClose asChild key={id}><Button variant="ghost" className="h-8 w-full justify-start px-2" onClick={() => { selected.current = true; onAction(id, account, trigger.current) }}><Icon aria-hidden="true" />{label}</Button></PopoverClose>
        ))}
        {active && quickActions.map(({ type, label, icon: Icon, tone }) => (
          <PopoverClose asChild key={type}><Button variant="ghost" className="h-8 w-full justify-start px-2" disabled={type === 'transferencia' && !canTransfer} onClick={() => {
            selected.current = true
            onMovement({ type, accountId: account.id }, trigger.current)
          }}><Icon className={tone} aria-hidden="true" />{label}</Button></PopoverClose>
        ))}
        {actions.slice(2).map(({ id, label, icon: Icon }) => (
          <PopoverClose asChild key={id}><Button variant="ghost" className={cn('h-8 w-full justify-start px-2', id === 'delete' && 'text-red-300 hover:text-red-200')} onClick={() => { selected.current = true; onAction(id, account, trigger.current) }}><Icon aria-hidden="true" />{label}</Button></PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function AccountCard({ account, hidden, canTransfer, onAction, onMovement }: {
  account: AccountWithBalance; hidden: boolean; canTransfer: boolean; onAction: AccountActionHandler; onMovement: AccountMovementHandler;
}) {
  return (
    <article className="panel relative overflow-hidden px-4 pb-3 pt-4 sm:p-5" aria-label={account.name}>
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: account.color }} aria-hidden="true" />
      <div className="flex min-w-0 items-center gap-3">
        <AccountIcon account={account} />
        <div className="min-w-0 flex-1">
          <button type="button" className="block max-w-full text-left text-[15px] font-bold focus-visible:rounded-sm wrap-anywhere hover:text-emerald-300" onClick={event => onAction('detail', account, event.currentTarget)}>{account.name}</button>
          <p className="mt-0.5 text-xs text-muted-foreground">{accountTypeLabel(account.type)}</p>
        </div>
        <AccountActions account={account} canTransfer={canTransfer} onAction={onAction} onMovement={onMovement} />
      </div>
      {account.description && <p className="mt-3 line-clamp-2 text-sm leading-snug text-muted-foreground">{account.description}</p>}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Saldo actual</p>
          <p className={cn('mt-1 text-[clamp(1.25rem,2.2vw,1.7rem)] leading-tight font-bold tracking-tight tabular-nums wrap-anywhere', account.balance < 0 && 'text-red-300')}>{formatMoney(account.balance, hidden)}</p>
        </div>
        {account.status === 'archivada' && <AccountStatusBadge status={account.status} />}
      </div>
      <div className="mt-3.5 border-t border-border pt-2.5">
        <Button variant="ghost" className="h-8 px-0 text-xs text-emerald-300 hover:bg-transparent hover:text-emerald-200" onClick={event => onAction('history', account, event.currentTarget)}>Ver historial<span className="sr-only"> de {account.name}</span></Button>
      </div>
    </article>
  )
}

export function AccountPreview({ name, type, icon, color, value, hidden }: { name: string; type: AccountType; icon: AccountType; color: string; value: number; hidden: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/70 p-3" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
      <div className="flex items-center gap-2.5">
        <AccountIcon account={{ icon, color }} className="size-9" />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name.trim() || 'Nombre de la cuenta'}</p><p className="mt-0.5 text-xs text-muted-foreground">{accountTypeLabel(type)}</p></div>
        <p className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(value, hidden)}</p>
      </div>
    </div>
  )
}
