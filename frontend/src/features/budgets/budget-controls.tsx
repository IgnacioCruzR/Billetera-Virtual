import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { formatDate } from '@/lib/utils'
import { budgetPeriod, shiftBudgetPeriod } from './budget-calculations'
import type { BudgetPeriod } from './budget-model'

const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function periodLabel(period: BudgetPeriod, short = false) {
  return formatDate(`${period}-01`, { month: short ? 'short' : 'long', year: 'numeric' })
}

function MonthOptions() {
  return months.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)
}

export function BudgetPeriodFields({ month, year, onMonth, onYear, error }: {
  month: string; year: string; onMonth: (value: string) => void; onYear: (value: string) => void; error?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Mes">{id => <Select id={id} value={month} onChange={event => onMonth(event.target.value)}><MonthOptions /></Select>}</Field>
      <Field label="Año" error={error}>{(id, attrs) => <Input id={id} value={year} inputMode="numeric" maxLength={4} onChange={event => onYear(event.target.value)} required {...attrs} />}</Field>
    </div>
  )
}

export function BudgetPeriodSelector({ period, onPeriod, context = 'presupuestos' }: { period: BudgetPeriod; onPeriod: (value: BudgetPeriod) => void; context?: string }) {
  const [year, month] = period.split('-')
  const previous = shiftBudgetPeriod(period, -1)
  const next = shiftBudgetPeriod(period, 1)
  return (
    <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto" role="group" aria-label={`Período de ${context}`}>
      <Button variant="outline" size="icon" disabled={!previous} onClick={() => { if (previous) onPeriod(previous) }} aria-label="Mes anterior"><ChevronLeft aria-hidden="true" /></Button>
      <div className="min-w-0 flex-1 sm:w-34 sm:flex-none">
        <Select aria-label={`Mes de ${context}`} value={month} onChange={event => { const value = budgetPeriod(year, event.target.value); if (value) onPeriod(value) }}><MonthOptions /></Select>
      </div>
      <Input key={year} className="w-16 text-center tabular-nums" aria-label={`Año de ${context}`} inputMode="numeric" maxLength={4} defaultValue={year}
        onBlur={event => {
          const value = budgetPeriod(event.target.value, month)
          if (value) onPeriod(value)
          else event.target.value = year
        }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
      <Button variant="outline" size="icon" disabled={!next} onClick={() => { if (next) onPeriod(next) }} aria-label="Mes siguiente"><ChevronRight aria-hidden="true" /></Button>
    </div>
  )
}
