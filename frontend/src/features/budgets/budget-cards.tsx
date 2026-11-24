import { useRef } from 'react'
import { Activity, ChartNoAxesCombined, Clapperboard, Copy, Ellipsis, HeartPulse, House, Pencil, Target, TrainFront, Trash2, Utensils, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { expenseCategories } from '@/features/dashboard/mock-data'
import { cn, formatMoney } from '@/lib/utils'
import type { BudgetView } from './budget-calculations'
import type { BudgetRisk, BudgetStatus } from './budget-model'

export const categoryName = (id: string) => expenseCategories.find(item => item.id === id)?.name ?? id

const percent = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })
const precisePercent = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 12 })

export function percentageLabel(value: number) {
  const rounded = Math.round(value * 10) / 10
  return `${([0, 80, 100].includes(rounded) && rounded !== value ? precisePercent : percent).format(value)} %`
}

export const budgetPresentation = {
  within: { label: 'Dentro del presupuesto', bar: 'bg-primary', badge: 'bg-primary/12 text-emerald-300' },
  near: { label: 'Cerca del límite', bar: 'bg-warning', badge: 'bg-warning/12 text-amber-300' },
  limit: { label: 'Límite alcanzado', bar: 'bg-budget-limit', badge: 'bg-budget-limit/15 text-orange-300' },
  exceeded: { label: 'Excedido', bar: 'bg-danger', badge: 'bg-danger/12 text-red-300' },
} satisfies Record<BudgetStatus, { label: string; bar: string; badge: string }>

export const riskLabels: Record<BudgetRisk, string> = {
  'on-pace': 'Vas a buen ritmo', ahead: 'El consumo avanza más rápido que el mes',
  'projected-excess': 'Podrías superar este presupuesto', 'at-limit': 'Has alcanzado el límite', exceeded: 'Has excedido el presupuesto',
  insufficient: 'Datos insuficientes para proyectar', planned: 'El mes aún no comienza', closed: 'Resultado al corte',
}

const categoryIcons = new Map([['alimentacion', Utensils], ['transporte', TrainFront], ['vivienda', House], ['salud', HeartPulse], ['entretenimiento', Clapperboard], ['otros', WalletCards]])

export function BudgetCategoryIcon({ categoryId }: { categoryId: string }) {
  const Icon = categoryIcons.get(categoryId) ?? Target
  const color = expenseCategories.find(item => item.id === categoryId)?.color ?? 'var(--primary)'
  return <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary" style={{ color }}><Icon className="size-[19px]" aria-hidden="true" /></span>
}

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const presentation = budgetPresentation[status]
  return <span className={cn('inline-block rounded-md px-2 py-1 text-xs font-semibold leading-tight', presentation.badge)}>{presentation.label}</span>
}

export function BudgetProgress({ value, label, status, time }: { value: number; label: string; status: BudgetStatus; time?: number }) {
  const capped = Math.min(100, Math.max(0, value))
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(capped)} aria-valuetext={`${percentageLabel(value)} utilizado`} className="relative h-1.5 rounded-full bg-secondary">
      <div className={cn('h-full rounded-full transition-[width]', budgetPresentation[status].bar)} style={{ width: `${capped}%` }} />
      {time !== undefined && time > 0 && time < 100 && <span className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-budget-time ring-1 ring-card" style={{ left: `${time}%` }} aria-hidden="true" />}
    </div>
  )
}

export type BudgetActionHandler = (action: 'detail' | 'edit' | 'duplicate' | 'delete', id: string, trigger: HTMLElement | null) => void

const actions = [
  { id: 'detail', label: 'Ver detalle', icon: ChartNoAxesCombined }, { id: 'edit', label: 'Editar presupuesto', icon: Pencil },
  { id: 'duplicate', label: 'Duplicar presupuesto', icon: Copy }, { id: 'delete', label: 'Eliminar presupuesto', icon: Trash2 },
] as const

function BudgetActions({ budget, onAction }: { budget: BudgetView; onAction: BudgetActionHandler }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = useRef(false)
  return (
    <Popover onOpenChange={open => { if (open) selected.current = false }}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" className="size-8" ref={trigger} aria-label={`Acciones de ${categoryName(budget.categoryId)}`}><Ellipsis aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent aria-label="Acciones del presupuesto" align="end" className="w-51 p-1" onCloseAutoFocus={event => { if (selected.current) event.preventDefault() }}>
        {actions.filter(action => action.id !== 'edit' || budget.projection.phase !== 'closed').map(({ id, label, icon: Icon }) => (
          <PopoverClose asChild key={id}><Button variant="ghost" className={cn('h-8 w-full justify-start px-2', id === 'delete' && 'text-red-300 hover:text-red-200')} onClick={() => {
            selected.current = true; onAction(id, budget.id, trigger.current)
          }}><Icon aria-hidden="true" />{label}</Button></PopoverClose>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function BudgetCard({ budget, hidden, onAction }: { budget: BudgetView; hidden: boolean; onAction: BudgetActionHandler }) {
  const name = categoryName(budget.categoryId)
  const { risk } = budget.projection
  return (
    <article aria-label={name} className="panel flex min-w-0 flex-col gap-3 p-4 sm:p-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <BudgetCategoryIcon categoryId={budget.categoryId} />
        <h3 className="min-w-0 flex-1"><button type="button" className="max-w-full text-left text-[15px] font-bold wrap-anywhere hover:text-emerald-300" onClick={event => onAction('detail', budget.id, event.currentTarget)}>{name}</button></h3>
        <BudgetActions budget={budget} onAction={onAction} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1.5"><BudgetStatusBadge status={budget.status} /><span className="text-sm font-semibold tabular-nums">{percentageLabel(budget.percentage)}</span></div>
      <BudgetProgress value={budget.percentage} label={`Consumo de ${name}`} status={budget.status} time={budget.projection.phase === 'current' ? budget.projection.timePercentage : undefined} />
      <div className="grid grid-cols-2 gap-2 text-sm tabular-nums">
        <div><p className="text-xs text-muted-foreground">Consumido</p><p className="mt-0.5 font-bold wrap-anywhere">{formatMoney(budget.used, hidden)}</p></div>
        <div className="text-right"><p className="text-xs text-muted-foreground">Límite mensual</p><p className="mt-0.5 font-bold wrap-anywhere">{formatMoney(budget.limit, hidden)}</p></div>
      </div>
      <div className="mt-auto border-t border-border pt-2.5">
        <p className={cn('text-sm font-semibold tabular-nums wrap-anywhere', budget.remaining < 0 ? 'text-red-300' : 'text-foreground')}>{formatMoney(Math.abs(budget.remaining), hidden)} {budget.remaining < 0 ? 'de exceso' : 'restantes'}</p>
        <p className={cn('mt-1 flex items-start gap-1.5 text-xs leading-snug', risk === 'projected-excess' || risk === 'ahead' ? 'text-amber-300' : 'text-muted-foreground')}><Activity className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{riskLabels[risk]}</p>
      </div>
    </article>
  )
}
