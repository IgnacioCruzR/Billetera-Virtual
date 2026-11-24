import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { expenseCategories, incomeCategories, today } from '@/features/dashboard/mock-data'
import { microExpenseLabels, movementTypes, type Account, type MovementType } from '@/features/dashboard/model'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { categories, isIsoDate } from './movement-data'
import { accountLabel, dateOptions, emptyFilters, filterErrors, movementTypeLabel, presetRange, type TransactionFilters } from './history'

type FilterProps = { accounts: Account[]; value: TransactionFilters; onChange: (value: TransactionFilters) => void }

function SearchField({ value, onChange }: Pick<FilterProps, 'value' | 'onChange'>) {
  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <Input type="search" aria-label="Buscar por descripción" placeholder="Buscar por descripción" value={value.search} onChange={event => onChange({ ...value, search: event.target.value })} className="pl-9" />
    </div>
  )
}

function FilterFields({ accounts, value, onChange, drawer = false }: FilterProps & { drawer?: boolean }) {
  const [advanced, setAdvanced] = useState(false)
  const errors = filterErrors(value)
  const showAdvanced = drawer || advanced
  const categoryOptions = value.type === 'gasto' ? expenseCategories : value.type === 'ingreso' ? incomeCategories : categories
  const patch = (fields: Partial<TransactionFilters>) => onChange({ ...value, ...fields })

  function changeType(type: MovementType | '') {
    const allowed = type === 'gasto' ? expenseCategories : type === 'ingreso' ? incomeCategories : categories
    patch({
      type, category: type !== 'transferencia' && allowed.some(item => item.id === value.category) ? value.category : '',
      classification: type === 'ingreso' || type === 'transferencia' ? '' : value.classification,
    })
  }

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-3', !drawer && 'items-end lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]')}>
        {!drawer && <SearchField value={value} onChange={onChange} />}
        <Field label="Tipo">{id => (
          <Select id={id} value={value.type} onChange={event => changeType(event.target.value as MovementType | '')}>
            <option value="">Todos los tipos</option>
            {movementTypes.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
          </Select>
        )}</Field>
        <Field label="Categoría">{id => (
          <Select id={id} value={value.category} onChange={event => patch({ category: event.target.value })} disabled={value.type === 'transferencia'}>
            <option value="">Todas las categorías</option>
            {categoryOptions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
          </Select>
        )}</Field>
        <Field label="Cuenta">{id => (
          <Select id={id} value={value.account} onChange={event => patch({ account: event.target.value })}>
            <option value="">Todas las cuentas</option>
            {accounts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
          </Select>
        )}</Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Fechas del historial">
          {dateOptions.map(option => (
            <Button size="sm" key={option.id} variant={value.preset === option.id ? 'muted' : 'outline'} aria-pressed={value.preset === option.id}
              onClick={() => {
                if (option.id === 'custom') setAdvanced(true)
                patch({ preset: option.id, ...(option.id === 'custom' ? {} : presetRange(option.id)) })
              }}>
              {option.label}
            </Button>
          ))}
        </div>
        {!drawer && (
          <Button size="sm" variant="ghost" aria-expanded={showAdvanced} aria-controls="history-advanced"
            onClick={() => setAdvanced(value => !value)}>
            <SlidersHorizontal aria-hidden="true" /> Filtros avanzados
          </Button>
        )}
      </div>
      {showAdvanced && (
        <div id={drawer ? undefined : 'history-advanced'} className={cn('grid grid-cols-2 gap-3 border-t border-border pt-4', !drawer && 'lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]')}>
          <Field label="Fecha inicial" error={errors.dates}>{(id, attrs) => <Input id={id} type="date" value={value.from} max={today} onChange={event => patch({ preset: 'custom', from: event.target.value })} {...attrs} />}</Field>
          <Field label="Fecha final">{id => <Input id={id} type="date" value={value.to} max={today} onChange={event => patch({ preset: 'custom', to: event.target.value })} />}</Field>
          <Field label="Monto mínimo" error={errors.amounts}>{(id, attrs) => <Input id={id} type="number" inputMode="numeric" min={0} step={1} placeholder="CLP" value={value.minimum} onChange={event => patch({ minimum: event.target.value })} {...attrs} />}</Field>
          <Field label="Monto máximo">{id => <Input id={id} type="number" inputMode="numeric" min={0} step={1} placeholder="CLP" value={value.maximum} onChange={event => patch({ maximum: event.target.value })} />}</Field>
          <div className={cn('col-span-2', !drawer && 'lg:col-span-1')}>
            <Field label="Clasificación">{id => (
              <Select id={id} value={value.classification} disabled={value.type === 'ingreso' || value.type === 'transferencia'} onChange={event => patch({ classification: event.target.value as TransactionFilters['classification'] })}>
                <option value="">Todas las clasificaciones</option>
                {Object.entries(microExpenseLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
              </Select>
            )}</Field>
          </div>
        </div>
      )}
    </div>
  )
}

function activeFilters(accounts: Account[], value: TransactionFilters) {
  const options: { label: string; reset: Partial<TransactionFilters> }[] = []
  const date = (iso: string) => isIsoDate(iso) ? formatDate(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : iso
  if (value.search.trim()) options.push({ label: `Búsqueda: ${value.search.trim()}`, reset: { search: '' } })
  if (value.type) options.push({ label: movementTypeLabel(value.type), reset: { type: '' } })
  if (value.category) options.push({ label: categories.find(item => item.id === value.category)?.name ?? value.category, reset: { category: '' } })
  if (value.account) options.push({ label: accountLabel(accounts, value.account), reset: { account: '' } })
  if (value.preset && value.preset !== 'custom') options.push({ label: dateOptions.find(item => item.id === value.preset)!.label, reset: { preset: '', from: '', to: '' } })
  if (value.preset === 'custom' && (value.from || value.to)) options.push({ label: [value.from && `Desde ${date(value.from)}`, value.to && `Hasta ${date(value.to)}`].filter(Boolean).join(' · '), reset: { preset: '', from: '', to: '' } })
  if (value.minimum !== '' || value.maximum !== '') options.push({ label: [value.minimum !== '' && `Mín. ${formatMoney(Number(value.minimum))}`, value.maximum !== '' && `Máx. ${formatMoney(Number(value.maximum))}`].filter(Boolean).join(' · '), reset: { minimum: '', maximum: '' } })
  if (value.classification) options.push({ label: microExpenseLabels[value.classification], reset: { classification: '' } })
  return options
}

export function HistoryFilters({ accounts, value, onChange, hidden }: FilterProps & { hidden: boolean }) {
  const [open, setOpen] = useState(false)
  const chips = activeFilters(accounts, value)

  return (
    <div className="space-y-3 border-b border-border px-4 py-4 sm:px-5">
      <div className="hidden lg:block"><FilterFields accounts={accounts} value={value} onChange={onChange} /></div>
      <div className="flex gap-2 lg:hidden">
        <div className="min-w-0 flex-1"><SearchField value={value} onChange={onChange} /></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="outline"><SlidersHorizontal aria-hidden="true" /> Filtros{chips.length > 0 && ` (${chips.length})`}</Button></DialogTrigger>
          <DialogContent className="h-dvh max-h-none w-full max-w-md rounded-none border-y-0 border-r-0" style={{ translate: 'none', top: 0, left: 'auto', right: 0 }}>
            <DialogTitle className="panel-heading pr-7 font-sans">Filtros del historial</DialogTitle>
            <DialogDescription className="mt-1 mb-4 text-sm text-muted-foreground">Los filtros se aplican a la lista de movimientos.</DialogDescription>
            <FilterFields accounts={accounts} value={value} onChange={onChange} drawer />
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => onChange(emptyFilters)} disabled={!chips.length}>Restablecer filtros</Button>
              <Button onClick={() => setOpen(false)}>Ver resultados</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {chips.map(chip => {
            const label = hidden && 'minimum' in chip.reset ? 'Rango de montos' : chip.label
            return <Button size="sm" variant="muted" className="h-auto min-h-7 max-w-full py-1" key={Object.keys(chip.reset)[0]} aria-label={`Quitar filtro ${label}`} onClick={() => onChange({ ...value, ...chip.reset })}><span className="truncate">{label}</span><X className="size-3 shrink-0" aria-hidden="true" /></Button>
          })}
          <Button size="sm" variant="ghost" onClick={() => onChange(emptyFilters)}>Restablecer filtros</Button>
        </div>
      )}
    </div>
  )
}
