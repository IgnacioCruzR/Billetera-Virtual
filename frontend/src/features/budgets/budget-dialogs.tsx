import { useState, type FormEvent } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { useDialogSubmission } from '@/components/ui/use-dialog-submission'
import { expenseCategories, today } from '@/features/dashboard/mock-data'
import type { FinancialRecords } from '@/features/dashboard/model'
import { TransactionHistory } from '@/features/movements/transaction-history'
import { isAnalyzed, microExpenseHistory } from '@/features/micro-expenses/micro-expense-detection'
import { cn, formatMoney } from '@/lib/utils'
import { budgetPeriod, budgetPhase, budgetStatus, conflictingBudgets, DEFAULT_WARNING_THRESHOLD, expensesInBudgetPeriod, parseBudgetPeriod, shiftBudgetPeriod, validateBudget, type BudgetView } from './budget-calculations'
import { BudgetCategoryIcon, BudgetProgress, BudgetStatusBadge, categoryName, percentageLabel, riskLabels } from './budget-cards'
import { BudgetConsumptionChart } from './budget-charts'
import { BudgetPeriodFields, periodLabel } from './budget-controls'
import type { Budget, BudgetFormData, BudgetPeriod } from './budget-model'

type CloseProps = { onClose: () => void; onCloseAutoFocus: (event: Event) => void }
const currentPeriod = parseBudgetPeriod(today.slice(0, 7))!
const expenseIds = expenseCategories.map(item => item.id)
const integer = (value: string) => /^\d+$/.test(value) ? Number(value) : NaN

function FormActions({ busy, label, onCancel, disabled, danger }: { busy: boolean; label: string; onCancel: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
      <Button type="submit" disabled={busy || disabled} className={danger ? 'bg-danger text-background hover:bg-red-400' : undefined}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Procesando…' : label}</Button>
    </div>
  )
}

export function BudgetForm({ records, period, suggestedCategory, editing, hidden, onSave, onClose, onCloseAutoFocus }: CloseProps & {
  records: FinancialRecords; period: BudgetPeriod; suggestedCategory?: string; editing?: Budget; hidden: boolean;
  onSave: (data: BudgetFormData, id?: string) => Promise<void>;
}) {
  const submission = useDialogSubmission(onClose)
  const initialPeriod = editing?.period ?? (period < currentPeriod ? currentPeriod : period)
  const [year, setYear] = useState(initialPeriod.slice(0, 4))
  const [month, setMonth] = useState(initialPeriod.slice(5))
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? suggestedCategory ?? '')
  const [limit, setLimit] = useState(editing ? String(editing.limit) : '')
  const [threshold, setThreshold] = useState(String(editing?.warningThreshold ?? DEFAULT_WARNING_THRESHOLD))
  const [description, setDescription] = useState(editing?.description ?? '')
  const [errors, setErrors] = useState<ReturnType<typeof validateBudget>>({})
  const selectedPeriod = budgetPeriod(year, month)
  const numericLimit = integer(limit)
  const used = selectedPeriod ? expensesInBudgetPeriod(records.movements, selectedPeriod, today)
    .reduce((sum, item) => item.categoryId === categoryId ? sum + item.amount : sum, 0) : 0
  const previewAvailable = Boolean(selectedPeriod && categoryId && Number.isSafeInteger(numericLimit) && numericLimit > 0)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = { categoryId, period: selectedPeriod ?? '', limit: numericLimit, warningThreshold: integer(threshold), description }
    const validation = validateBudget(data, records.budgets, expenseIds, today, editing)
    setErrors(validation)
    if (selectedPeriod && !Object.keys(validation).length) void submission.run(() => onSave({ ...data, period: selectedPeriod }, editing?.id))
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
        <DialogTitle className="pr-8 text-xl font-bold">{editing ? 'Editar presupuesto' : 'Nuevo presupuesto'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">{editing ? 'Actualiza el límite y la advertencia de esta categoría.' : 'Define un límite mensual para una categoría de gasto.'}</DialogDescription>
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <fieldset className="min-w-0 space-y-3" disabled={submission.busy}>
            <Field label="Categoría de gasto" error={errors.categoryId}>{(id, attrs) => (
              <Select id={id} value={categoryId} onChange={event => setCategoryId(event.target.value)} disabled={Boolean(editing)} required {...attrs}>
                <option value="">Selecciona una categoría</option>
                {expenseCategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}</Field>
            <fieldset className="min-w-0" disabled={Boolean(editing)}>
              <BudgetPeriodFields year={year} month={month} onYear={setYear} onMonth={setMonth} error={errors.period} />
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Límite mensual (CLP)" error={errors.limit}>{(id, attrs) => <Input id={id} value={limit} inputMode="numeric" maxLength={12} onChange={event => setLimit(event.target.value)} placeholder="Ej. 150000" required {...attrs} />}</Field>
              <Field label="Umbral de advertencia (%)" error={errors.warningThreshold}>{(id, attrs) => <Input id={id} value={threshold} inputMode="numeric" maxLength={3} onChange={event => setThreshold(event.target.value)} required {...attrs} />}</Field>
            </div>
            <Field label="Descripción (opcional)" error={errors.description}>{(id, attrs) => <Input id={id} value={description} maxLength={160} onChange={event => setDescription(event.target.value)} {...attrs} />}</Field>
          </fieldset>
          <div className="rounded-xl border border-border bg-secondary/65 p-3" aria-label="Vista previa del presupuesto">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Vista previa</p>
            <div className="flex items-center gap-2.5"><BudgetCategoryIcon categoryId={categoryId} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{categoryId ? categoryName(categoryId) : 'Categoría de gasto'}</p>{selectedPeriod && <p className="text-xs text-muted-foreground">{periodLabel(selectedPeriod)}</p>}</div>
              {previewAvailable && <BudgetStatusBadge status={budgetStatus(used, numericLimit)} />}
            </div>
            {previewAvailable && <div className="mt-3 space-y-1.5"><BudgetProgress label="Consumo en la vista previa" value={used / numericLimit * 100} status={budgetStatus(used, numericLimit)} /><p className="text-xs tabular-nums text-muted-foreground">{formatMoney(used, hidden)} de {formatMoney(numericLimit, hidden)}</p></div>}
          </div>
          {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
          <FormActions busy={submission.busy} label={editing ? 'Guardar cambios' : 'Crear presupuesto'} onCancel={submission.close} />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DuplicateBudgetDialog({ source, budgets, all, onDuplicate, onClose, onCloseAutoFocus }: CloseProps & {
  source: Budget[]; budgets: Budget[]; all: boolean; onDuplicate: (ids: string[], period: BudgetPeriod) => Promise<void>;
}) {
  const submission = useDialogSubmission(onClose)
  const next = shiftBudgetPeriod(source[0].period, 1)
  const defaultPeriod = next && next >= currentPeriod ? next : currentPeriod
  const [year, setYear] = useState(defaultPeriod.slice(0, 4))
  const [month, setMonth] = useState(defaultPeriod.slice(5))
  const period = budgetPeriod(year, month)
  const conflicts = period ? conflictingBudgets(budgets, source, period) : []
  const periodError = !period ? 'Selecciona un mes y un año válidos.' : budgetPhase(period, today) === 'closed' ? 'Selecciona el mes actual o uno futuro.' : ''
  return (
    <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
        <DialogTitle className="pr-8 text-xl font-bold">{all ? 'Duplicar planificación' : 'Duplicar presupuesto'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">Copia {all ? `${source.length} presupuestos` : categoryName(source[0].categoryId)} de {periodLabel(source[0].period)} al período de destino.</DialogDescription>
        <form className="mt-4 space-y-4" onSubmit={event => {
          event.preventDefault()
          if (period && !periodError && !conflicts.length) void submission.run(() => onDuplicate(source.map(item => item.id), period))
        }} noValidate>
          <fieldset className="min-w-0" disabled={submission.busy}><BudgetPeriodFields year={year} month={month} onYear={setYear} onMonth={setMonth} error={periodError} /></fieldset>
          {conflicts.length > 0 && <p className="rounded-lg bg-warning/10 p-3 text-sm text-amber-200" role="alert">Ya existe planificación para {conflicts.map(item => categoryName(item.categoryId)).join(', ')}. Elige otro período de destino.</p>}
          {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
          <FormActions busy={submission.busy} label={all ? 'Copiar planificación' : 'Copiar presupuesto'} onCancel={submission.close} disabled={Boolean(periodError || conflicts.length)} />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteBudgetDialog({ budget, onDelete, onClose, onCloseAutoFocus }: CloseProps & { budget: Budget; onDelete: () => Promise<void> }) {
  const submission = useDialogSubmission(onClose)
  return (
    <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
        <span className="mb-3 grid size-10 place-items-center rounded-lg bg-danger/12 text-red-300"><TriangleAlert className="size-5" aria-hidden="true" /></span>
        <DialogTitle className="pr-8 text-xl font-bold">Eliminar presupuesto</DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">Confirma la eliminación del presupuesto de {categoryName(budget.categoryId)} para {periodLabel(budget.period)}. Tus gastos y saldos se conservan.</DialogDescription>
        <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void submission.run(onDelete) }}>
          {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
          <FormActions busy={submission.busy} label="Eliminar presupuesto" onCancel={submission.close} danger />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BudgetDetailDrawer({ budget, records, detected, hidden, onHistory, onClose, onCloseAutoFocus }: CloseProps & {
  budget: BudgetView; records: FinancialRecords; detected: ReadonlySet<string>; hidden: boolean; onHistory: () => void;
}) {
  const expenses = expensesInBudgetPeriod(records.movements, budget.period, today).filter(item => item.categoryId === budget.categoryId)
  const previous = shiftBudgetPeriod(budget.period, -1)
  const previousBudget = records.budgets.find(item => item.period === previous && item.categoryId === budget.categoryId)
  const previousSpent = previous ? expensesInBudgetPeriod(records.movements, previous, today).reduce((sum, item) => item.categoryId === budget.categoryId ? sum + item.amount : sum, 0) : null
  const { phase, dailyAverage, projected, dailyMargin, elapsedDays, remainingDays, timePercentage, concentrated, risk } = budget.projection
  const money = (value: number | null) => value === null ? '—' : formatMoney(Math.round(value), hidden)
  const metrics = [
    { label: 'Límite mensual', value: money(budget.limit) }, { label: 'Consumido', value: money(budget.used) }, { label: budget.remaining < 0 ? 'Excedido por' : 'Margen restante', value: money(Math.abs(budget.remaining)) },
    { label: 'Días transcurridos', value: elapsedDays }, { label: 'Días restantes', value: remainingDays }, { label: 'Promedio diario', value: money(dailyAverage) },
    { label: phase === 'closed' ? 'Gasto al cierre' : 'Proyección al cierre', value: phase === 'closed' ? money(budget.used) : money(projected) },
    { label: 'Margen diario recomendado', value: money(dailyMargin) },
  ]
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const smallExpenses = expenses.filter(item => isAnalyzed(microExpenseHistory(item, detected)))
  const smallTotal = smallExpenses.reduce((sum, item) => sum + item.amount, 0)
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="h-dvh max-h-none w-full max-w-4xl rounded-none border-y-0 border-r-0" style={{ top: 0, left: 'auto', right: 0, translate: 'none' }}>
        <div className="flex items-center gap-3 pr-8">
          <BudgetCategoryIcon categoryId={budget.categoryId} />
          <div><DialogTitle className="text-xl font-bold">{categoryName(budget.categoryId)}</DialogTitle><DialogDescription className="text-sm text-muted-foreground first-letter:uppercase">Presupuesto de {periodLabel(budget.period)}</DialogDescription></div>
        </div>
        {budget.description && <p className="mt-3 text-sm text-muted-foreground wrap-anywhere">{budget.description}</p>}
        <div className="mt-4 space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><BudgetStatusBadge status={budget.status} /><strong className="text-sm tabular-nums">{percentageLabel(budget.percentage)} utilizado</strong></div>
          <BudgetProgress status={budget.status} time={timePercentage} value={budget.percentage} label="Consumo del presupuesto" />
          <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span>{riskLabels[risk]}</span><span>Tiempo transcurrido · {percentageLabel(timePercentage)}</span></div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Indicadores del presupuesto">
          {metrics.map(item => <div key={item.label} className="min-w-0 rounded-lg border border-border p-2.5"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-1 text-sm font-bold tabular-nums wrap-anywhere">{item.value}</dd></div>)}
        </dl>
        {phase === 'current' && <div className={cn('mt-3 text-xs', concentrated ? 'text-amber-200' : 'text-muted-foreground')}>
          {projected === null && remainingDays > 0 ? 'La estimación requiere tres días transcurridos y gastos en al menos dos fechas.' : projected !== null ? 'Estimación lineal al ritmo del gasto registrado.' : 'El mes llegó a su último día.'}
          {concentrated && ' Un movimiento concentra más del 75 % del consumo.'}
        </div>}
        <div className="mt-4"><BudgetConsumptionChart budget={budget} expenses={expenses} hidden={hidden} /></div>
        {previous && <section className="mt-4 rounded-xl border border-border p-3 sm:p-4" aria-label="Comparación con el mes anterior">
          <h3 className="font-bold">Comparación con {periodLabel(previous)}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Límite anterior</dt><dd className="mt-0.5 font-semibold">{previousBudget ? money(previousBudget.limit) : 'Sin presupuesto'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Gasto del mes anterior</dt><dd className="mt-0.5 font-semibold">{money(previousSpent)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Diferencia de gasto al corte</dt><dd className="mt-0.5 font-semibold">{money(phase === 'future' || previousSpent === null ? null : budget.used - previousSpent)}</dd></div>
          </dl>
        </section>}
        <section className="mt-4 rounded-xl border border-border" aria-label="Gastos asociados">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3"><h3 className="font-bold">Gastos asociados</h3><Button variant="outline" size="sm" onClick={onHistory}>Ver gastos del presupuesto</Button></div>
          {phase !== 'future' && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 text-sm">
            <span>Gastos hormiga de la categoría · <strong>{money(smallTotal)}</strong>{budget.used > 0 && ` · ${percentageLabel(smallTotal / budget.used * 100)} del gasto efectivo`}</span>
            <Button asChild variant="ghost" size="sm"><a href={`#hormiga?${new URLSearchParams({ categoria: budget.categoryId, mes: budget.period })}`} onClick={onClose}>Ver análisis de la categoría</a></Button>
          </div>}
          {recent.length ? <TransactionHistory items={recent} accounts={records.accounts} detected={detected} hidden={hidden} /> : <p className="p-3 text-sm text-muted-foreground">Esta categoría aún no registra gastos para este mes.</p>}
        </section>
      </DialogContent>
    </Dialog>
  )
}
