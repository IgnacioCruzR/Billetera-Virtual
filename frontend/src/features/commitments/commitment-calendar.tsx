import { useMemo, useState } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BudgetPeriodSelector, periodLabel } from '@/features/budgets/budget-controls'
import { daysInBudgetPeriod, parseBudgetPeriod } from '@/features/budgets/budget-calculations'
import type { BudgetPeriod } from '@/features/budgets/budget-model'
import type { Account } from '@/features/dashboard/model'
import { cn } from '@/lib/utils'
import { calendarDays, visualStatus } from './cash-flow'
import { CommitmentRows, longDate, type CommitmentActionHandler } from './commitment-list'
import type { FinancialCommitment } from './commitment-model'

const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const markers = [
  { letter: 'C', label: 'Cobros previstos', tone: 'bg-primary/12 text-emerald-300', matches: (item: FinancialCommitment) => item.status === 'pendiente' && item.type === 'cobro' },
  { letter: 'P', label: 'Pagos previstos', tone: 'bg-danger/12 text-red-300', matches: (item: FinancialCommitment) => item.status === 'pendiente' && item.type === 'pago' },
  { letter: 'V', label: 'Vencidos', tone: 'bg-warning/15 text-amber-300', matches: (item: FinancialCommitment, today: string) => visualStatus(item, today) === 'vencido' },
  { letter: '✓', label: 'Confirmados', tone: 'bg-budget-time/12 text-blue-300', matches: (item: FinancialCommitment) => item.status === 'confirmado' },
] as const

export function CommitmentCalendar({ commitments, accounts, today, hidden, onAction, onCreate, canCreate }: {
  commitments: FinancialCommitment[]; accounts: Account[]; today: string; hidden: boolean;
  onAction: CommitmentActionHandler; onCreate: (date: string, trigger: HTMLElement) => void; canCreate: boolean;
}) {
  const thisMonth = parseBudgetPeriod(today.slice(0, 7))!
  const [month, setMonth] = useState<BudgetPeriod>(thisMonth)
  const [selected, setSelected] = useState(today)
  const byDay = useMemo(() => {
    const days = new Map<string, FinancialCommitment[]>()
    for (const item of commitments) {
      if (item.status === 'cancelado' || !item.dueDate.startsWith(`${month}-`)) continue
      const entries = days.get(item.dueDate) ?? []
      entries.push(item)
      days.set(item.dueDate, entries)
    }
    return days
  }, [commitments, month])
  const dayItems = byDay.get(selected) ?? []

  function navigate(value: BudgetPeriod) { setMonth(value); setSelected(value === thisMonth ? today : `${value}-01`) }

  return <section className="panel p-3 sm:p-5" aria-label="Calendario financiero">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-4 text-primary" aria-hidden="true" /> Calendario financiero</h2><p className="mt-0.5 text-xs text-muted-foreground first-letter:uppercase" aria-live="polite">{periodLabel(month)}</p></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2"><BudgetPeriodSelector period={month} onPeriod={navigate} context="calendario" /><Button variant="outline" size="sm" onClick={() => navigate(thisMonth)}>Mes actual</Button></div>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label="Días del mes">
          {weekdays.map(day => <span className="text-center text-[11px] font-medium text-muted-foreground" key={day}>{day}</span>)}
          {calendarDays(month, daysInBudgetPeriod(month)).map((date, index) => {
            if (!date) return <span key={`blank-${index}`} className="rounded-md bg-secondary/30" aria-hidden="true" />
            const entries = byDay.get(date) ?? []
            const counts = markers.map(marker => ({ ...marker, count: entries.filter(item => marker.matches(item, today)).length })).filter(item => item.count)
            return <button key={date} type="button" onClick={() => setSelected(date)} aria-label={`${longDate(date)}${counts.length ? `, ${counts.map(item => `${item.label}: ${item.count}`).join(', ')}` : ''}`} aria-pressed={date === selected} aria-current={date === today ? 'date' : undefined} className={cn('flex min-h-13 min-w-0 flex-col items-start gap-1 rounded-md border p-1 text-xs hover:border-primary/70 sm:min-h-16 sm:p-1.5', date === selected ? 'border-primary bg-primary/8' : 'border-border bg-secondary/70')}>
              <span className={cn('font-semibold tabular-nums', date === today && 'text-emerald-300')}>{Number(date.slice(8))}</span><span className="flex max-w-full flex-wrap gap-px" aria-hidden="true">
                {counts.map(item => <span className={cn('rounded px-0.5 text-[9px] leading-3 font-bold sm:px-1 sm:text-[10px]', item.tone)} key={item.letter}>{item.letter}<span className="hidden sm:inline">{item.count}</span></span>)}
              </span>
            </button>
          })}
        </div>
        {byDay.size === 0 && <p className="mt-3 text-sm text-muted-foreground">Este mes no tiene vencimientos activos ni confirmados.</p>}
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{markers.map(marker => <li className="flex items-center gap-1.5" key={marker.letter}><span className={cn('rounded px-1.5 py-0.5 font-semibold', marker.tone)} aria-hidden="true">{marker.letter}</span>{marker.label}</li>)}</ul>
      </div>
      <div className="min-w-0 rounded-xl border border-border p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{longDate(selected)}</h3><Button variant="outline" size="sm" disabled={!canCreate} onClick={event => onCreate(selected, event.currentTarget)}><Plus aria-hidden="true" /> Agregar compromiso</Button></div>
        {dayItems.length ? <CommitmentRows items={dayItems} accounts={accounts} today={today} hidden={hidden} onAction={onAction} compact /> : <p className="text-sm text-muted-foreground">No hay compromisos para el día seleccionado.</p>}
      </div>
    </div>
  </section>
}
