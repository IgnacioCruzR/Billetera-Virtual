import { useState, type FormEvent } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { useDialogSubmission } from '@/components/ui/use-dialog-submission'
import type { Account, FinancialRecords } from '@/features/dashboard/model'
import { accountLabel } from '@/features/movements/history'
import { maximumMovementAmount } from '@/features/movements/movement-data'
import { daysBetween } from '@/lib/calendar'
import { cn, formatMoney } from '@/lib/utils'
import type { CommitmentConfirmation, CommitmentFormData, CommitmentType, FinancialCommitment } from './commitment-model'
import { categoriesForCommitment, CommitmentAmount, commitmentCategoryLabel, CommitmentIcon, CommitmentStatusBadge, commitmentTypeLabel, commitmentTypes, longDate, type CommitmentAction } from './commitment-list'
import { confirmationError, validateCommitment } from './commitment-records'

type CloseProps = { onClose: () => void; onCloseAutoFocus: (event: Event) => void }
const mobileDrawer = 'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-0 max-sm:rounded-b-none'

function SubmitActions({ busy, label, onClose, danger }: { busy: boolean; label: string; onClose: () => void; danger?: boolean }) {
  return <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
    <Button variant="outline" onClick={onClose} disabled={busy}>Volver</Button>
    <Button type="submit" disabled={busy} className={danger ? 'bg-danger text-background hover:bg-red-400' : undefined}>{busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Procesando…' : label}</Button>
  </div>
}

export function CommitmentForm({ editing, dueDate, accounts, today, hidden, onSave, onClose, onCloseAutoFocus }: CloseProps & {
  editing?: FinancialCommitment; dueDate?: string; accounts: Account[]; today: string; hidden: boolean;
  onSave: (draft: CommitmentFormData, id?: string) => Promise<void>;
}) {
  const submission = useDialogSubmission(onClose)
  const [type, setType] = useState<CommitmentType>(editing?.type ?? 'pago')
  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [accountId, setAccount] = useState(editing?.accountId ?? '')
  const [categoryId, setCategory] = useState(editing?.categoryId ?? '')
  const [date, setDate] = useState(editing?.dueDate ?? dueDate ?? today)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [errors, setErrors] = useState<ReturnType<typeof validateCommitment>>({})
  const categories = categoriesForCommitment(type)
  const liveAccounts = accounts.filter(item => item.status === 'activa')
  const parsedAmount = /^\d+$/.test(amount) ? Number(amount) : NaN

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const draft = { type, name, amount: parsedAmount, accountId, categoryId, dueDate: date, notes }
    const invalid = validateCommitment(draft, accounts, categories.map(item => item.id), today, maximumMovementAmount, editing)
    setErrors(invalid)
    if (!Object.keys(invalid).length) void submission.run(() => onSave(draft, editing?.id))
  }

  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
    <DialogContent className={mobileDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
      <DialogTitle className="pr-8 text-xl font-bold">{editing ? 'Editar compromiso' : 'Nuevo compromiso'}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-muted-foreground">{editing ? 'Actualiza la planificación del compromiso pendiente.' : 'Planifica un cobro o un pago y registra el movimiento cuando ocurra.'}</DialogDescription>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <fieldset className="min-w-0 space-y-3" disabled={submission.busy}>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary p-1" role="group" aria-label="Tipo de compromiso">{commitmentTypes.map(item => <Button key={item.id} variant={item.id === type ? 'muted' : 'ghost'} aria-pressed={item.id === type} disabled={Boolean(editing) && item.id !== type} onClick={() => { if (item.id !== type) { setType(item.id); setCategory(''); setErrors({}) } }}>{item.label}</Button>)}</div>
          <Field label={type === 'pago' ? 'Nombre del pago' : 'Nombre del cobro'} error={errors.name}>{(id, attrs) => <Input id={id} value={name} maxLength={120} onChange={event => setName(event.target.value)} required {...attrs} />}</Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Monto (CLP)" error={errors.amount}>{(id, attrs) => <Input id={id} value={amount} inputMode="numeric" maxLength={12} onChange={event => setAmount(event.target.value)} placeholder="Ej. 65000" required {...attrs} />}</Field>
            <Field label={type === 'pago' ? 'Fecha de vencimiento' : 'Fecha prevista de recepción'} error={errors.dueDate}>{(id, attrs) => <Input id={id} type="date" value={date} onChange={event => setDate(event.target.value)} required {...attrs} />}</Field>
            <Field label={type === 'pago' ? 'Cuenta de origen' : 'Cuenta de destino'} error={errors.accountId}>{(id, attrs) => <Select id={id} value={accountId} onChange={event => setAccount(event.target.value)} required {...attrs}><option value="">Selecciona una cuenta</option>{liveAccounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</Field>
            <Field label="Categoría" error={errors.categoryId}>{(id, attrs) => <Select id={id} value={categoryId} onChange={event => setCategory(event.target.value)} required {...attrs}><option value="">Selecciona una categoría</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>}</Field>
          </div>
          <Field label="Descripción o notas (opcional)" error={errors.notes}>{(id, attrs) => <textarea id={id} className="min-h-18 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus-visible:outline-primary" value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} {...attrs} />}</Field>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-secondary/60 p-3" aria-label="Vista previa del compromiso">
          <div className="flex items-center gap-2.5"><CommitmentIcon type={type} /><div><p className="text-xs text-muted-foreground">Efecto proyectado</p><p className="text-sm font-semibold wrap-anywhere">{name.trim() || commitmentTypeLabel(type)}</p></div></div>
          {Number.isSafeInteger(parsedAmount) && parsedAmount > 0 && <CommitmentAmount type={type} amount={parsedAmount} hidden={hidden} />}
        </div>
        {date && date < today && <p className="text-xs text-amber-200">El vencimiento pasado se incluye hoy en la proyección mientras siga pendiente.</p>}
        {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
        <SubmitActions busy={submission.busy} label={editing ? 'Guardar cambios' : 'Crear compromiso'} onClose={submission.close} />
      </form>
    </DialogContent>
  </Dialog>
}

export function ConfirmCommitmentDialog({ item, records, today, hidden, onConfirm, onClose, onCloseAutoFocus }: CloseProps & {
  item: FinancialCommitment; records: FinancialRecords; today: string; hidden: boolean; onConfirm: (draft: CommitmentConfirmation) => Promise<void>;
}) {
  const { accounts } = records
  const submission = useDialogSubmission(onClose)
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [error, setError] = useState('')
  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
    <DialogContent className={mobileDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
      <DialogTitle className="pr-8 text-xl font-bold">Confirmar {item.type}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-muted-foreground">Registra como movimiento efectivo «{item.name}».</DialogDescription>
      <form className="mt-4 space-y-4" noValidate onSubmit={event => {
        event.preventDefault()
        const message = confirmationError(item, accounts, effectiveDate, today, records)
        setError(message)
        if (!message) void submission.run(() => onConfirm({ effectiveDate }))
      }}>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/50 p-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">{item.type === 'pago' ? 'Cuenta de origen' : 'Cuenta de destino'}</dt><dd className="mt-1 font-semibold">{accountLabel(accounts, item.accountId)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Monto a confirmar</dt><dd className="mt-1 font-semibold tabular-nums">{formatMoney(item.amount, hidden)}</dd></div>
        </dl>
        <Field label={item.type === 'pago' ? 'Fecha efectiva del pago' : 'Fecha efectiva de recepción'} error={error}>{(id, attrs) => <Input id={id} type="date" value={effectiveDate} max={today} disabled={submission.busy} onChange={event => setEffectiveDate(event.target.value)} required {...attrs} />}</Field>
        <p className="text-xs text-muted-foreground">Si el monto real es distinto, actualiza el compromiso antes de confirmar.</p>
        {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
        {[error, submission.error].some(message => message?.includes('dinero reservado')) && <a className="inline-block text-sm font-semibold text-indigo-200 hover:underline" href={`#metas?cuenta=${encodeURIComponent(item.accountId)}`} onClick={submission.close}>Revisar reservas de la cuenta</a>}
        <SubmitActions busy={submission.busy} label={`Confirmar ${item.type}`} onClose={submission.close} />
      </form>
    </DialogContent>
  </Dialog>
}

export function CancelCommitmentDialog({ item, onCancel, onClose, onCloseAutoFocus }: CloseProps & { item: FinancialCommitment; onCancel: () => Promise<void> }) {
  const submission = useDialogSubmission(onClose)
  return <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
    <DialogContent className={mobileDrawer} onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
      <TriangleAlert className="mb-3 size-6 text-warning" aria-hidden="true" />
      <DialogTitle className="pr-8 text-xl font-bold">Cancelar compromiso</DialogTitle>
      <DialogDescription className="mt-2 text-sm text-muted-foreground">«{item.name}» permanecerá en el historial y saldrá de las proyecciones.</DialogDescription>
      <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void submission.run(onCancel) }}>
        {submission.error && <p role="alert" className="text-sm text-red-300">{submission.error}</p>}
        <SubmitActions busy={submission.busy} label="Cancelar compromiso" onClose={submission.close} danger />
      </form>
    </DialogContent>
  </Dialog>
}

export function CommitmentDetailDrawer({ item, accounts, today, hidden, onMove, onAction, onClose, onCloseAutoFocus }: CloseProps & {
  item: FinancialCommitment; accounts: Account[]; today: string; hidden: boolean; onMove: (id: string) => void; onAction: (action: CommitmentAction) => void;
}) {
  const days = daysBetween(today, item.dueDate)
  const items = [
    { label: 'Tipo', value: commitmentTypeLabel(item.type) }, { label: 'Cuenta asociada', value: accountLabel(accounts, item.accountId) },
    { label: 'Categoría', value: commitmentCategoryLabel(item) }, { label: 'Fecha de vencimiento', value: longDate(item.dueDate) },
    ...(item.originalDueDate ? [{ label: 'Vencimiento original', value: longDate(item.originalDueDate) }] : []),
    ...(item.status === 'pendiente' ? [{ label: 'Plazo', value: days === 0 ? 'Vence hoy' : days < 0 ? `${-days} ${days === -1 ? 'día' : 'días'} de atraso` : `${days} ${days === 1 ? 'día restante' : 'días restantes'}` }]
      : item.status === 'confirmado' ? [{ label: 'Fecha efectiva', value: longDate(item.effectiveDate) }] : [{ label: 'Fecha de cancelación', value: longDate(item.cancelledOn) }]),
  ]

  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="h-dvh max-h-none w-full max-w-xl rounded-none border-y-0 border-r-0" style={{ top: 0, left: 'auto', right: 0, translate: 'none' }}>
      <div className="flex items-center gap-3 pr-7"><CommitmentIcon type={item.type} /><div className="min-w-0"><DialogTitle className="text-xl font-bold wrap-anywhere">{item.name}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Detalle del compromiso financiero</DialogDescription></div></div>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/50 p-3"><div><p className="text-xs text-muted-foreground">Monto del compromiso</p><p className="mt-0.5 text-xl font-bold tabular-nums wrap-anywhere">{formatMoney(item.amount, hidden)}</p></div><CommitmentStatusBadge item={item} today={today} /></div>
      <dl className="mt-4 grid grid-cols-2 gap-2.5">{items.map(entry => <div key={entry.label} className="rounded-lg border border-border p-2.5"><dt className="text-xs text-muted-foreground">{entry.label}</dt><dd className="mt-0.5 text-sm font-semibold wrap-anywhere">{entry.value}</dd></div>)}</dl>
      <div className="mt-4 rounded-xl border border-border p-3"><h3 className="text-sm font-semibold">Efecto financiero</h3>
        <p className={cn('mt-1 text-sm', item.status === 'pendiente' ? 'text-blue-200' : 'text-muted-foreground')}>{item.status === 'pendiente'
          ? <>Incluido en la proyección para {days < 0 ? 'hoy como vencimiento pendiente' : longDate(item.dueDate)} · <CommitmentAmount type={item.type} amount={item.amount} hidden={hidden} /></>
          : item.status === 'confirmado' ? 'El movimiento asociado ya forma parte del saldo efectivo.' : 'El compromiso quedó fuera de la proyección.'}</p>
      </div>
      <div className="mt-4 rounded-xl border border-border p-3"><h3 className="text-sm font-semibold">Notas</h3><p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground wrap-anywhere">{item.notes || 'Sin notas registradas.'}</p></div>
      {item.status === 'pendiente' && <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => onAction('confirm')}>Confirmar {item.type}</Button><Button variant="outline" onClick={() => onAction('edit')}>Editar compromiso</Button><Button variant="ghost" onClick={() => onAction('cancel')}>Cancelar compromiso</Button></div>}
      {item.status === 'confirmado' && <Button variant="outline" className="mt-4" onClick={() => onMove(item.movementId)}>Ver movimiento asociado</Button>}
    </DialogContent>
  </Dialog>
}
