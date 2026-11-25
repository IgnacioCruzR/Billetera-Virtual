import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Select } from '@/components/ui/field'
import { useDialogSubmission } from '@/components/ui/use-dialog-submission'
import type { FinancialRecords } from '@/features/dashboard/model'
import { formatMoney } from '@/lib/utils'
import { goalActionLabel, GoalPreview, progressLabel } from './savings-cards'
import { accountReservation, releaseCapacity } from './savings-ledger'
import { goalTemplates, type GoalTemplate, type SavingsContribution, type SavingsGoalFormData, type SavingsGoalHistory, type SavingsReservationType } from './savings-model'
import { reservationError, validateGoal, type LifecycleAction } from './savings-records'

export const mobileSavingsDrawer = 'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-0 max-sm:rounded-b-none'
type CloseProps = { onClose: () => void; onCloseAutoFocus: (event: Event) => void }
type InitialContribution = Pick<SavingsContribution, 'accountId' | 'amount'>
const parseAmount = (value: string) => /^\d+$/.test(value) ? Number(value) : NaN
const formDefaults: SavingsGoalFormData = { name: '', description: '', target: NaN, targetDate: '', monthlyPlan: null, template: 'personal', icon: 'personal', color: '#818CF8' }

function FormFooter({ busy, label, onClose }: { busy: boolean; label: string; onClose: () => void }) {
  return <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3"><Button variant="outline" disabled={busy} onClick={onClose}>Volver</Button><Button disabled={busy} type="submit">{busy ? 'Procesando…' : label}</Button></div>
}

export function SavingsGoalForm({ history, records, today, hidden, onSave, onClose, onCloseAutoFocus }: CloseProps & {
  history?: SavingsGoalHistory; records: FinancialRecords; today: string; hidden: boolean;
  onSave: (draft: SavingsGoalFormData, initial?: InitialContribution) => Promise<void>;
}) {
  const existing = history?.goal
  const [draft, setDraft] = useState<SavingsGoalFormData>(existing ? {
    name: existing.name, description: existing.description, target: existing.target, targetDate: existing.targetDate, monthlyPlan: existing.monthlyPlan,
    template: existing.template, icon: existing.icon, color: existing.color,
  } : formDefaults)
  const [targetText, setTargetText] = useState(existing ? String(existing.target) : '')
  const [plan, setPlan] = useState(existing?.monthlyPlan ? String(existing.monthlyPlan) : '')
  const [initial, setInitial] = useState('')
  const [accountId, setAccountId] = useState('')
  const [errors, setErrors] = useState<ReturnType<typeof validateGoal>>({})
  const [initialError, setInitialError] = useState('')
  const submission = useDialogSubmission(onClose)
  const accounts = records.accounts.filter(account => account.status === 'activa')
  const initialAmount = parseAmount(initial)
  const target = parseAmount(targetText)
  const patch = (value: Partial<SavingsGoalFormData>) => setDraft(current => ({ ...current, ...value }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = { ...draft, target, monthlyPlan: plan ? parseAmount(plan) : null }
    const validation = validateGoal(values, today, existing, history?.reserved)
    setErrors(validation)
    const hasInitial = !existing && initial !== ''
    const error = hasInitial && (!Number.isSafeInteger(initialAmount) || initialAmount <= 0 || initialAmount > target || !accountId) ? 'Indica un aporte positivo que no supere el objetivo y selecciona una cuenta.' : ''
    setInitialError(error)
    if (!Object.keys(validation).length && !error) void submission.run(() => onSave(values, hasInitial ? { accountId, amount: initialAmount } : undefined))
  }
  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}><DialogContent className={mobileSavingsDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
    <DialogTitle className="pr-8 text-xl font-bold">{existing ? 'Editar meta' : 'Nueva meta'}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">Define tu objetivo, cómo reconocerlo y el ritmo de ahorro que quieres planificar.</DialogDescription>
    <form onSubmit={submit} noValidate className="mt-4 space-y-3">
      <fieldset disabled={submission.busy} className="min-w-0 space-y-3">
        <Field label="Nombre de la meta" error={errors.name}>{(id, attrs) => <Input id={id} value={draft.name} onChange={event => patch({ name: event.target.value })} required maxLength={90} {...attrs} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto objetivo (CLP)" error={errors.target}>{(id, attrs) => <MoneyInput hidden={hidden} id={id} inputMode="numeric" value={targetText} onChange={event => setTargetText(event.target.value)} maxLength={12} required {...attrs} />}</Field>
          <Field label="Fecha objetivo (opcional)" error={errors.targetDate}>{(id, attrs) => <Input id={id} type="date" value={draft.targetDate} onChange={event => patch({ targetDate: event.target.value })} {...attrs} />}</Field>
          <Field label="Aporte mensual planificado (CLP)" error={errors.monthlyPlan}>{(id, attrs) => <MoneyInput hidden={hidden} id={id} inputMode="numeric" value={plan} onChange={event => setPlan(event.target.value)} maxLength={12} placeholder="Opcional" {...attrs} />}</Field>
          <Field label="Plantilla visual" error={errors.template}>{(id, attrs) => <Select id={id} value={draft.template} onChange={event => {
            const template = goalTemplates.find(item => item.id === event.target.value)
            if (template) patch({ template: template.id, icon: template.id, color: template.color, name: draft.name || (template.id !== 'personal' ? template.name : '') })
          }} {...attrs}>{goalTemplates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</Field>
          <Field label="Icono de la meta">{id => <Select id={id} value={draft.icon} onChange={event => patch({ icon: event.target.value as GoalTemplate })}>{goalTemplates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</Field>
          <Field label="Color de la meta" error={errors.color}>{(id, attrs) => <Input id={id} type="color" className="min-w-14 px-2 py-1.5" value={draft.color} onChange={event => patch({ color: event.target.value })} {...attrs} />}</Field>
        </div>
        <Field label="Descripción (opcional)" error={errors.description}>{(id, attrs) => <textarea id={id} value={draft.description} onChange={event => patch({ description: event.target.value })} maxLength={500} className="min-h-14 w-full rounded-lg border border-border bg-secondary p-2 text-sm" {...attrs} />}</Field>
        {!existing && accounts.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Aporte inicial (CLP)" error={initialError}>{(id, attrs) => <MoneyInput hidden={hidden} id={id} inputMode="numeric" value={initial} onChange={event => setInitial(event.target.value)} placeholder="Opcional" maxLength={12} {...attrs} />}</Field>
          {initial && <Field label="Cuenta del aporte inicial">{id => <Select id={id} value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">Selecciona una cuenta</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>}</Field>}
        </div>}
      </fieldset>
      <GoalPreview draft={{ ...draft, target }} amount={history?.reserved ?? (Number.isFinite(initialAmount) ? initialAmount : 0)} hidden={hidden} />
      {submission.error && <p role="alert" className="rounded-lg bg-danger/10 p-2 text-sm text-red-200">{submission.error}</p>}
      <FormFooter busy={submission.busy} label={existing ? 'Guardar cambios' : 'Crear meta'} onClose={submission.close} />
    </form>
  </DialogContent></Dialog>
}

export function ReservationDialog({ history, type, records, today, hidden, preferredAccount, onSave, onClose, onCloseAutoFocus }: CloseProps & {
  history: SavingsGoalHistory; type: SavingsReservationType; records: FinancialRecords; today: string; hidden: boolean; preferredAccount?: string;
  onSave: (draft: SavingsContribution) => Promise<void>;
}) {
  const { goal, byAccount, reserved } = history
  const release = type === 'liberacion'
  const accounts = records.accounts.filter(account => release ? (byAccount.get(account.id) ?? 0) > 0 : account.status === 'activa')
  const [accountId, setAccountId] = useState(() => accounts.find(account => account.id === preferredAccount)?.id ?? (accounts.length === 1 ? accounts[0].id : ''))
  const [amountText, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const submission = useDialogSubmission(onClose)
  const account = accounts.find(item => item.id === accountId)
  const snapshot = account && accountReservation(account, records, today)
  const amount = parseAmount(amountText)
  const delta = Number.isFinite(amount) ? (release ? -amount : amount) : 0
  const releasable = release && account && date && date <= today ? releaseCapacity(records, account.id, goal.id, date, today) : 0
  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}><DialogContent className={mobileSavingsDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
    <DialogTitle className="pr-8 text-xl font-bold">{release ? 'Liberar dinero reservado' : 'Agregar aporte'}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">{goal.name} · {release ? 'Recupera disponibilidad en la cuenta donde se hizo la reserva.' : 'Asigna dinero efectivo de una de tus cuentas a esta meta.'}</DialogDescription>
    <form className="mt-4 space-y-3" noValidate onSubmit={event => {
      event.preventDefault()
      const draft = { goalId: goal.id, accountId, amount, date, description }
      const message = reservationError(records, goal, draft, type, today)
      setError(message)
      if (!message) void submission.run(() => onSave(draft))
    }}>
      <fieldset disabled={submission.busy} className="min-w-0 space-y-3">
        <Field label={release ? 'Cuenta con reserva' : 'Cuenta del aporte'}>{id => <Select id={id} value={accountId} onChange={event => setAccountId(event.target.value)} required><option value="">Selecciona una cuenta</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={release ? 'Monto a liberar (CLP)' : 'Monto del aporte (CLP)'}>{id => <MoneyInput hidden={hidden} id={id} inputMode="numeric" maxLength={12} value={amountText} onChange={event => setAmount(event.target.value)} required />}</Field>
          <Field label="Fecha efectiva">{id => <Input id={id} type="date" max={today} value={date} onChange={event => setDate(event.target.value)} required />}</Field>
        </div>
        <Field label={release ? 'Motivo (opcional)' : 'Descripción (opcional)'}>{id => <Input id={id} value={description} onChange={event => setDescription(event.target.value)} maxLength={500} />}</Field>
      </fieldset>
      {snapshot && <dl className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-secondary/50 p-3 text-sm" aria-label="Vista previa de la reserva">
        <div><dt className="text-xs text-muted-foreground">Saldo de la cuenta</dt><dd>{formatMoney(snapshot.balance, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{release ? 'Reserva liberable' : 'Reservado en la cuenta'}</dt><dd>{formatMoney(release ? releasable : snapshot.reserved, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Dinero libre antes</dt><dd>{formatMoney(snapshot.free, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Dinero libre después</dt><dd>{formatMoney(snapshot.free - delta, hidden)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Progreso resultante</dt><dd>{progressLabel(Math.max(0, (reserved + delta) / goal.target * 100))}</dd></div>
      </dl>}
      {!accounts.length && <p className="text-xs text-muted-foreground">Necesitas una cuenta activa para aportar.</p>}
      {(error || submission.error) && <p role="alert" className="rounded-lg bg-danger/10 p-2 text-sm text-red-200">{submission.error || error}</p>}
      <FormFooter busy={submission.busy} label={release ? 'Confirmar liberación' : 'Confirmar aporte'} onClose={submission.close} />
    </form>
  </DialogContent></Dialog>
}

export function GoalLifecycleDialog({ history, action, hidden, onConfirm, onClose, onCloseAutoFocus }: CloseProps & {
  history: SavingsGoalHistory; action: LifecycleAction; hidden: boolean; onConfirm: (purchase: boolean) => Promise<void>;
}) {
  const [purchase, setPurchase] = useState(false)
  const submission = useDialogSubmission(onClose)
  const description = {
    pausar: 'La meta conservará su dinero reservado mientras esté pausada.',
    reactivar: 'La meta volverá a estar disponible para nuevos aportes.',
    cancelar: `Se liberarán ${formatMoney(history.reserved, hidden)} y la meta quedará en el historial.`,
    finalizar: `Se liberarán ${formatMoney(history.reserved, hidden)} y la meta quedará cerrada como alcanzada.`,
  }[action]
  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}><DialogContent className={mobileSavingsDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
    <DialogTitle className="pr-8 text-xl font-bold">{goalActionLabel(action)}</DialogTitle>
    <DialogDescription className="mt-1 text-sm text-muted-foreground">«{history.goal.name}». {description}</DialogDescription>
    <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void submission.run(() => onConfirm(purchase)) }}>
      {action === 'finalizar' && <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={purchase} disabled={submission.busy} onChange={event => setPurchase(event.target.checked)} />Abrir el formulario para registrar una compra después del cierre</label>}
      {submission.error && <p role="alert" className="text-sm text-red-200">{submission.error}</p>}
      <FormFooter busy={submission.busy} label={goalActionLabel(action)} onClose={submission.close} />
    </form>
  </DialogContent></Dialog>
}
