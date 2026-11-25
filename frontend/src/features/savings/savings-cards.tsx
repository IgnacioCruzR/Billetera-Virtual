import { useRef } from 'react'
import { CarFront, Ellipsis, GraduationCap, HeartPulse, House, Laptop, PiggyBank, Plane, Plus, Shield, ShoppingBag, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { goalTemplates, type GoalTemplate, type SavingsGoal, type SavingsGoalAction, type SavingsGoalHistory, type SavingsGoalStatus, type SavingsSummary } from './savings-model'

const goalIcons = { emergencia: Shield, tecnologia: Laptop, viajes: Plane, educacion: GraduationCap, vivienda: House, vehiculo: CarFront, salud: HeartPulse, compras: ShoppingBag, personal: Target }
export const statusLabels: Record<SavingsGoalStatus, string> = {
  'en-progreso': 'En progreso', pausada: 'Pausada', alcanzada: 'Alcanzada', finalizada: 'Finalizada', cancelada: 'Cancelada',
}
const badgeTones: Record<SavingsGoalStatus, string> = {
  'en-progreso': 'bg-budget-time/12 text-blue-200', pausada: 'bg-warning/12 text-amber-200',
  alcanzada: 'bg-primary/12 text-emerald-200', finalizada: 'bg-reserve/16 text-indigo-200', cancelada: 'bg-accent text-muted-foreground',
}
export const savingsDate = (date: string) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })
const decimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })
export const progressLabel = (value: number) => `${decimal.format(value)} %`
export type SavingsActionHandler = (action: SavingsGoalAction, history: SavingsGoalHistory, trigger: HTMLElement | null) => void

export function GoalIcon({ icon, color }: { icon: GoalTemplate; color: string }) {
  const Icon = goalIcons[icon]
  return <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-secondary" style={{ color }}><Icon className="size-5" aria-hidden="true" /></span>
}

export function GoalStatus({ status, overdue }: { status: SavingsGoalStatus; overdue: boolean }) {
  return <div className="flex flex-wrap gap-1.5"><span className={cn('rounded-md px-2 py-1 text-xs font-semibold', badgeTones[status])}>{statusLabels[status]}</span>{overdue && <span className="rounded-md bg-warning/12 px-2 py-1 text-xs font-semibold text-amber-200">Atrasada</span>}</div>
}

export function GoalProgress({ value, color, label }: { value: number; color: string; label: string }) {
  return <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, Math.round(value)))} aria-valuetext={progressLabel(value)} className="h-2 overflow-hidden rounded-full bg-accent">
    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }} />
  </div>
}

const actionLabels: Record<SavingsGoalAction, string> = {
  detail: 'Ver detalle', edit: 'Editar meta', aporte: 'Agregar aporte', liberacion: 'Liberar dinero reservado', pausar: 'Pausar meta',
  reactivar: 'Reactivar meta', finalizar: 'Finalizar meta', cancelar: 'Cancelar meta',
}

export function goalActions({ goal, reserved }: SavingsGoalHistory): SavingsGoalAction[] {
  const release = reserved > 0 ? ['liberacion' as const] : []
  switch (goal.status) {
    case 'en-progreso': return ['detail', 'edit', 'aporte', ...release, 'pausar', 'cancelar']
    case 'pausada': return ['detail', ...release, 'reactivar', 'cancelar']
    case 'alcanzada': return ['detail', ...release, 'finalizar']
    default: return ['detail']
  }
}

export const goalActionLabel = (action: SavingsGoalAction) => actionLabels[action]

function GoalMenu({ history, onAction }: { history: SavingsGoalHistory; onAction: SavingsActionHandler }) {
  const button = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  return <Popover onOpenChange={open => { if (open) openingDialog.current = false }}>
    <PopoverTrigger asChild><Button ref={button} size="icon" variant="ghost" className="size-8" aria-label={`Acciones de ${history.goal.name}`}><Ellipsis aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent aria-label="Acciones de la meta" align="end" className="w-54 p-1" onCloseAutoFocus={event => { if (openingDialog.current) event.preventDefault() }}>
      {goalActions(history).map(action => <PopoverClose asChild key={action}><Button variant="ghost" className={cn('w-full justify-start', action === 'cancelar' && 'text-red-300')} size="sm" onClick={() => {
        openingDialog.current = true
        onAction(action, history, button.current)
      }}>{actionLabels[action]}</Button></PopoverClose>)}
    </PopoverContent>
  </Popover>
}

export function SavingsGoalCard({ history, hidden, onAction }: { history: SavingsGoalHistory; hidden: boolean; onAction: SavingsActionHandler }) {
  const { goal, reserved, progress, remaining, overdue } = history
  const closed = goal.status === 'finalizada' || goal.status === 'cancelada'
  const level = goal.status === 'finalizada' ? 100 : progress
  return <article aria-label={goal.name} className="panel min-w-0 p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <GoalIcon icon={goal.icon} color={goal.color} />
      <div className="min-w-0 flex-1"><button type="button" className="rounded-sm text-left font-bold wrap-anywhere hover:text-indigo-200" onClick={event => onAction('detail', history, event.currentTarget)}>{goal.name}</button><p className="mt-0.5 text-xs text-muted-foreground">{goalTemplates.find(item => item.id === goal.template)?.name}</p></div>
      <GoalMenu history={history} onAction={onAction} />
    </div>
    <div className="mt-3"><GoalStatus status={goal.status} overdue={overdue} /></div>
    <div className="mt-4 flex flex-wrap items-end justify-between gap-1.5"><span className="text-lg font-extrabold text-indigo-200 wrap-anywhere tabular-nums">{formatMoney(reserved, hidden)}</span><span className="text-sm text-muted-foreground">Meta de {formatMoney(goal.target, hidden)}</span></div>
    <div className="mt-2"><GoalProgress value={level} color={goal.color} label={`Progreso de ${goal.name}`} /></div>
    <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
      <span>{goal.status === 'finalizada' ? 'Objetivo alcanzado al cierre' : progressLabel(level)}</span><span>{closed ? `Cerrada el ${goal.closedOn ? savingsDate(goal.closedOn) : '—'}` : `Restan ${formatMoney(remaining, hidden)}`}</span>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">{goal.targetDate ? `Fecha objetivo · ${savingsDate(goal.targetDate)}` : 'Sin fecha objetivo'}</span>
      {goal.status === 'en-progreso' && <Button variant="outline" size="sm" onClick={event => onAction('aporte', history, event.currentTarget)}><Plus aria-hidden="true" />Agregar aporte</Button>}
    </div>
  </article>
}

export function SavingsOverview({ summary, hidden }: { summary: SavingsSummary; hidden: boolean }) {
  const cards = [
    ['Dinero reservado', summary.reserved], ['Objetivo de metas en progreso', summary.target],
    ['Aportes netos del mes', summary.netThisMonth], ['Disponible para nuevas reservas', summary.availableForNew],
  ] as const
  return <section aria-label="Resumen de ahorro" className="space-y-3">
    <div className="grid gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">{cards.map(([label, amount], index) => <article aria-label={label} className="panel p-4" key={label}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-muted-foreground">{label}</h2><PiggyBank className={cn('size-4 shrink-0', index === 3 ? 'text-primary' : 'text-indigo-300')} aria-hidden="true" /></div>
      <p className="mt-2 text-[clamp(1.3rem,2.5vw,1.85rem)] font-extrabold tracking-tight wrap-anywhere tabular-nums">{formatMoney(amount, hidden)}</p>
    </article>)}</div>
    <div className="panel grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><h2 className="font-semibold">Progreso de metas en curso</h2><span className="text-indigo-200">{summary.progress === null ? 'Sin metas en progreso' : progressLabel(summary.progress)}</span></div><GoalProgress value={summary.progress ?? 0} color="var(--reserve)" label="Progreso global de las metas en progreso" /><p className="mt-2 text-xs text-muted-foreground">{summary.activeCount} en progreso · {summary.reachedCount} alcanzadas o finalizadas</p></div>
      <dl className="grid gap-3 text-sm min-[480px]:grid-cols-3">
        <div><dt className="text-xs text-muted-foreground">Saldo total registrado</dt><dd className="font-semibold tabular-nums wrap-anywhere">{formatMoney(summary.registered, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Dinero libre no reservado</dt><dd className={cn('font-semibold tabular-nums wrap-anywhere', summary.free < 0 && 'text-red-300')}>{formatMoney(summary.free, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Excedente financiero del mes</dt><dd className="font-semibold tabular-nums wrap-anywhere">{formatMoney(summary.financialSurplus, hidden)}</dd></div>
      </dl>
    </div>
  </section>
}

export function GoalPreview({ draft, amount, hidden }: { draft: Pick<SavingsGoal, 'name' | 'target' | 'icon' | 'color'>; amount: number; hidden: boolean }) {
  const level = draft.target > 0 && Number.isFinite(draft.target) ? amount / draft.target * 100 : 0
  return <div className="rounded-xl border border-border bg-secondary/50 p-3" aria-label="Vista previa de la meta">
    <div className="flex items-center gap-3"><GoalIcon icon={draft.icon} color={draft.color} /><div className="min-w-0"><p className="text-xs text-muted-foreground">Vista previa</p><p className="text-sm font-semibold wrap-anywhere">{draft.name.trim() || 'Tu nueva meta'}</p></div></div>
    <p className="my-2 text-sm font-semibold">{formatMoney(amount, hidden)} de {Number.isFinite(draft.target) ? formatMoney(draft.target, hidden) : 'un objetivo'}</p>
    <GoalProgress value={level} color={draft.color} label="Progreso previsto de la meta" />
  </div>
}
