import { useCategoryCatalog } from '@/features/categories/category-context'
import { useRef, useState } from 'react'
import { Ellipsis, ListChecks, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Select } from '@/components/ui/field'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDialogSubmission } from '@/components/ui/use-dialog-submission'
import type { Account } from '@/features/dashboard/model'
import { accountLabel, categoryLabel, emptyFilters, filterErrors } from '@/features/movements/history'
import { MicroExpenseBadge, TransactionAmount, TransactionPagination, transactionDescription } from '@/features/movements/transaction-history'
import { formatDate } from '@/lib/utils'
import { filterMicroHistory } from './micro-expense-analysis'
import { mobileDrawer } from './detection-settings'
import { classificationLabels, type MicroExpenseClassification, type MicroExpenseFilters, type MicroExpenseHistory, type SpendingPattern } from './micro-expense-model'

export const initialMicroFilters: MicroExpenseFilters = { search: '', category: '', account: '', from: '', to: '', minimum: '', maximum: '', classification: '', patternId: '', includedOnly: false }
const shortDate = (date: string) => formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })
const pageSize = 8
const actions = [
  { id: 'necesario', label: 'Marcar como necesario' }, { id: 'prescindible', label: 'Marcar como prescindible' },
  { id: 'excluido', label: 'Excluir del análisis' }, { id: 'automatica', label: 'Restablecer clasificación' },
] as const
export type ClassificationRequest = { ids: string[]; value?: MicroExpenseClassification; trigger: HTMLElement | null }

function EntryActions({ entry, onMovement, onClassify }: { entry: MicroExpenseHistory; onMovement: (id: string) => void; onClassify: (request: ClassificationRequest) => void }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  return <Popover onOpenChange={open => { if (open) openingDialog.current = false }}>
    <PopoverTrigger asChild><Button ref={trigger} variant="ghost" size="icon" className="size-8" aria-label={`Acciones de ${transactionDescription(entry.movement)}`}><Ellipsis aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="end" aria-label="Acciones de clasificación" className="w-52 p-1" onCloseAutoFocus={event => { if (openingDialog.current) event.preventDefault() }}>
      <PopoverClose asChild><Button variant="ghost" className="h-8 w-full justify-start px-2" onClick={() => onMovement(entry.movement.id)}>Ver detalle</Button></PopoverClose>
      {actions.map(action => <PopoverClose asChild key={action.id}><Button variant="ghost" className="h-8 w-full justify-start px-2" onClick={() => {
        openingDialog.current = true
        onClassify({ ids: [entry.movement.id], value: action.id, trigger: trigger.current })
      }}>{action.label}</Button></PopoverClose>)}
    </PopoverContent>
  </Popover>
}

export function MicroHistory({ history, patterns, accounts, hidden, filters, onFilters, onMovement, onClassify }: {
  history: MicroExpenseHistory[]; patterns: SpendingPattern[]; accounts: Account[]; hidden: boolean; filters: MicroExpenseFilters;
  onFilters: (filters: MicroExpenseFilters) => void; onMovement: (id: string) => void; onClassify: (request: ClassificationRequest) => void;
}) {
  const catalog = useCategoryCatalog()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const errors = filterErrors({ ...emptyFilters, ...filters })
  const filtered = errors.amounts || errors.dates ? [] : filterMicroHistory(history, filters)
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)
  const selection = filtered.filter(entry => selected.has(entry.movement.id)).map(entry => entry.movement.id)
  const allVisible = visible.length > 0 && visible.every(entry => selected.has(entry.movement.id))
  const patch = (value: Partial<MicroExpenseFilters>) => { setPage(1); onFilters({ ...filters, ...value }) }
  function choose(ids: string[], checked: boolean) {
    setSelected(current => {
      const next = new Set(current)
      ids.forEach(id => { if (checked) next.add(id); else next.delete(id) })
      return next
    })
  }
  const checkbox = (entry: MicroExpenseHistory) => <input type="checkbox" className="size-4 shrink-0 accent-primary" aria-label={`Seleccionar ${transactionDescription(entry.movement)} del ${shortDate(entry.movement.date)}`} checked={selected.has(entry.movement.id)} onChange={event => choose([entry.movement.id], event.target.checked)} />
  const entryButton = (entry: MicroExpenseHistory) => <button type="button" className="rounded-sm text-left text-sm font-semibold wrap-anywhere hover:text-primary focus-visible:outline-primary" onClick={() => onMovement(entry.movement.id)}>{transactionDescription(entry.movement)}</button>
  const entryActions = (entry: MicroExpenseHistory) => <EntryActions entry={entry} onClassify={onClassify} onMovement={onMovement} />

  return <section id="micro-history" aria-labelledby="micro-history-title" className="panel scroll-mt-22">
    <div className="space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="micro-history-title" tabIndex={-1} className="scroll-mt-24 text-lg font-bold tracking-tight">Historial de gastos</h2><p className="mt-0.5 text-xs text-muted-foreground">Consulta y clasifica los gastos efectivos del período.</p></div><Button variant="outline" size="sm" onClick={() => { setPage(1); setSelected(new Set()); onFilters(initialMicroFilters) }}>Limpiar filtros</Button></div>
      <div className="grid gap-2.5 min-[460px]:grid-cols-2 lg:grid-cols-4">
        <div className="relative min-[460px]:col-span-2"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" /><Input type="search" aria-label="Buscar gastos" placeholder="Buscar por descripción" value={filters.search} onChange={event => patch({ search: event.target.value })} className="pl-9" /></div>
        <Select aria-label="Categoría de gasto" value={filters.category} onChange={event => patch({ category: event.target.value })}><option value="">Todas las categorías</option>{catalog.filter(item => item.type === 'gasto').map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>
        <Select aria-label="Cuenta de gasto" value={filters.account} onChange={event => patch({ account: event.target.value })}><option value="">Todas las cuentas</option>{accounts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>
        <Select aria-label="Clasificación del gasto" value={filters.classification} onChange={event => patch({ classification: event.target.value as MicroExpenseFilters['classification'] })}><option value="">Todas las clasificaciones</option>{Object.entries(classificationLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>
        <Select aria-label="Patrón de consumo" value={filters.patternId} onChange={event => patch({ patternId: event.target.value })}><option value="">Todos los patrones</option>{patterns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{filters.patternId && !patterns.some(item => item.id === filters.patternId) && <option value={filters.patternId}>Patrón sin gastos incluidos</option>}</Select>
        <label className="flex items-center gap-2 text-sm lg:col-span-2"><input type="checkbox" className="size-4 accent-primary" checked={filters.includedOnly} onChange={event => patch({ includedOnly: event.target.checked })} />Solo gastos incluidos en el análisis</label>
      </div>
      <div className="grid gap-2.5 min-[460px]:grid-cols-2 lg:grid-cols-4">
        <Field label="Fecha desde">{id => <Input id={id} type="date" value={filters.from} onChange={event => patch({ from: event.target.value })} />}</Field>
        <Field label="Fecha hasta" error={errors.dates}>{(id, attrs) => <Input id={id} type="date" value={filters.to} onChange={event => patch({ to: event.target.value })} {...attrs} />}</Field>
        <Field label="Monto mínimo (CLP)">{id => <MoneyInput hidden={hidden} id={id} inputMode="numeric" value={filters.minimum} onChange={event => patch({ minimum: event.target.value })} />}</Field>
        <Field label="Monto máximo (CLP)" error={errors.amounts}>{(id, attrs) => <MoneyInput hidden={hidden} id={id} inputMode="numeric" value={filters.maximum} onChange={event => patch({ maximum: event.target.value })} {...attrs} />}</Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'} · {selection.length} {selection.length === 1 ? 'seleccionado' : 'seleccionados'}</p>
        <Button size="sm" variant="outline" disabled={!selection.length} onClick={event => onClassify({ ids: selection, trigger: event.currentTarget })}><ListChecks aria-hidden="true" />Clasificar selección</Button>
      </div>
    </div>
    {visible.length ? <>
      <div className="hidden overflow-x-auto min-[1060px]:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Historial de clasificación de gastos hormiga</caption>
          <thead className="border-y border-border bg-secondary/65 text-xs text-muted-foreground"><tr>
            <th scope="col" className="p-2 pl-4"><input type="checkbox" className="size-4 accent-primary" aria-label="Seleccionar gastos de esta página" checked={allVisible} onChange={event => choose(visible.map(entry => entry.movement.id), event.target.checked)} /></th>
            {['Descripción', 'Categoría', 'Cuenta', 'Fecha', 'Monto', 'Clasificación', 'Origen', 'Acciones'].map(label => <th scope="col" className="px-2 py-2.5" key={label}>{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">{visible.map(entry => <tr key={entry.movement.id} className="hover:bg-secondary/45">
            <td className="p-2 pl-4">{checkbox(entry)}</td><th scope="row" className="p-2">{entryButton(entry)}</th>
            <td className="p-2 text-muted-foreground">{categoryLabel(entry.movement, catalog)}</td><td className="p-2 text-muted-foreground">{accountLabel(accounts, entry.movement.accountId)}</td>
            <td className="p-2"><time dateTime={entry.movement.date}>{shortDate(entry.movement.date)}</time></td><td className="p-2"><TransactionAmount item={entry.movement} hidden={hidden} /></td>
            <td className="p-2"><MicroExpenseBadge status={entry.status} /></td><td className="p-2 text-xs text-muted-foreground capitalize">{entry.source}</td><td className="p-2">{entryActions(entry)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="grid gap-2 px-3 pb-3 min-[1060px]:hidden" aria-label="Tarjetas de gastos identificados">{visible.map(entry => <li key={entry.movement.id} className="min-w-0 rounded-xl border border-border bg-secondary/55 p-3">
        <div className="flex items-center gap-2">{checkbox(entry)}<div className="min-w-0 flex-1">{entryButton(entry)}</div>{entryActions(entry)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{categoryLabel(entry.movement, catalog)} · {accountLabel(accounts, entry.movement.accountId)} · <time dateTime={entry.movement.date}>{shortDate(entry.movement.date)}</time></div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><MicroExpenseBadge status={entry.status} /><TransactionAmount item={entry.movement} hidden={hidden} /></div>
        <div className="mt-1 text-xs text-muted-foreground capitalize">{entry.source}</div>
      </li>)}</ul>
      <TransactionPagination page={current} pageSize={pageSize} count={filtered.length} onPage={setPage} />
    </> : <p className="border-t border-border p-4 text-sm text-muted-foreground">{errors.amounts || errors.dates ? 'Corrige los filtros para consultar resultados.' : history.length ? 'Ningún gasto coincide con los filtros.' : 'El período aún no tiene gastos efectivos registrados.'}</p>}
  </section>
}

export function ClassificationDialog({ request, onSave, onClose, onCloseAutoFocus }: {
  request: ClassificationRequest; onSave: (classification: MicroExpenseClassification) => Promise<void>; onClose: () => void; onCloseAutoFocus: (event: Event) => void;
}) {
  const [value, setValue] = useState<MicroExpenseClassification>(request.value ?? 'necesario')
  const submission = useDialogSubmission(onClose)
  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}><DialogContent className={mobileDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
    <DialogTitle className="pr-8 text-xl font-bold">{request.ids.length > 1 ? 'Confirmar clasificación múltiple' : 'Confirmar clasificación'}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">{request.ids.length === 1 ? 'Se actualizará 1 movimiento.' : `Se actualizarán ${request.ids.length} movimientos.`} La clasificación se aplica al análisis de hábitos.</DialogDescription>
    <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void submission.run(() => onSave(value)) }}>
      <Field label="Nueva clasificación">{id => <Select id={id} value={value} disabled={submission.busy} onChange={event => setValue(event.target.value as MicroExpenseClassification)}>{actions.map(action => <option key={action.id} value={action.id}>{action.label}</option>)}</Select>}</Field>
      {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button disabled={submission.busy} variant="outline" onClick={submission.close}>Volver</Button><Button type="submit" disabled={submission.busy}>{submission.busy ? 'Guardando…' : 'Aplicar clasificación'}</Button></div>
    </form>
  </DialogContent></Dialog>
}
