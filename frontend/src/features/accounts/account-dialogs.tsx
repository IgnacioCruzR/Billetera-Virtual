import { useState, type FormEvent } from 'react'
import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { useDialogSubmission } from '@/components/ui/use-dialog-submission'
import { today } from '@/features/dashboard/mock-data'
import { PeriodSelect } from '@/features/dashboard/navigation'
import { accountTypes, type Account, type AccountFormData, type AccountType, type FinancialRecords, type Period } from '@/features/dashboard/model'
import { getPeriodRange } from '@/features/movements/movement-data'
import { TransactionHistory } from '@/features/movements/transaction-history'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { accountActivity, balanceOn, involvesAccount, type AccountWithBalance } from './account-balances'
import { AccountIcon, AccountPreview, AccountStatusBadge, accountIcons } from './account-cards'
import { AccountBalanceChart, BalanceChartTitle } from './account-charts'
import { accountReferences, accountTypeLabel, deletionReasons, validateAccount, validateAdjustment, type AdjustmentDraft } from './account-data'

type CloseProps = { onClose: () => void; onCloseAutoFocus: (event: Event) => void }

function FormActions({ busy, label, onCancel, destructive = false }: { busy: boolean; label: string; onCancel: () => void; destructive?: boolean }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
      <Button type="submit" disabled={busy} className={destructive ? 'bg-danger text-background hover:bg-red-400' : undefined}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Procesando…' : label}
      </Button>
    </div>
  )
}

const defaultForm: AccountFormData = { name: '', type: 'vista', icon: 'vista', color: '#10B981', initialBalance: 0, description: '' }

export function AccountFormDialog({ account, hidden, onSave, onClose, onCloseAutoFocus }: CloseProps & {
  account?: AccountWithBalance; hidden: boolean; onSave: (draft: AccountFormData, id?: string) => Promise<void>;
}) {
  const submission = useDialogSubmission(onClose)
  const [draft, setDraft] = useState<AccountFormData>(account ?? defaultForm)
  const [amount, setAmount] = useState(String(account?.initialBalance ?? 0))
  const [errors, setErrors] = useState<ReturnType<typeof validateAccount>>({})
  const initialBalance = /^\d+$/.test(amount) ? Number(amount) : NaN
  const patch = (fields: Partial<AccountFormData>) => setDraft(current => ({ ...current, ...fields }))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = { ...draft, initialBalance }
    const validation = validateAccount(data)
    setErrors(validation)
    if (!Object.keys(validation).length) void submission.run(() => onSave(data, account?.id))
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
        <DialogTitle className="pr-8 text-xl font-bold">{account ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">{account ? 'Personaliza cómo aparece esta cuenta.' : 'Agrega una ubicación para registrar tu dinero.'}</DialogDescription>
        <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
          <fieldset className="min-w-0 space-y-3" disabled={submission.busy}>
            <Field label="Nombre de la cuenta" error={errors.name}>{(id, attrs) => <Input id={id} value={draft.name} onChange={event => patch({ name: event.target.value })} required maxLength={60} placeholder="Ej. Efectivo para el mes" {...attrs} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de cuenta" error={errors.type}>{(id, attrs) => (
                <Select id={id} value={draft.type} onChange={event => {
                  const type = event.target.value as AccountType
                  patch({ type, icon: draft.icon === draft.type ? type : draft.icon })
                }} {...attrs}>{accountTypes.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}</Select>
              )}</Field>
              <Field label="Color personalizado" error={errors.color}>{(id, attrs) => <Input id={id} className="px-1.5 py-1" type="color" value={draft.color} onChange={event => patch({ color: event.target.value })} {...attrs} />}</Field>
            </div>
            {!account && <Field label="Saldo inicial (CLP)" error={errors.initialBalance}>{(id, attrs) => <Input id={id} inputMode="numeric" required maxLength={12} value={amount} onChange={event => setAmount(event.target.value)} {...attrs} />}</Field>}
            <Field label="Descripción (opcional)">{id => <Input id={id} value={draft.description} onChange={event => patch({ description: event.target.value })} maxLength={140} placeholder="Ej. Gastos cotidianos" />}</Field>
            <div>
              <p className="mb-1.5 text-sm font-medium">Icono</p>
              <div role="group" aria-label="Icono de la cuenta" className="flex flex-wrap gap-1.5">
                {accountTypes.map(({ id, label }) => {
                  const Icon = accountIcons[id]
                  return <Button key={id} title={label} variant={draft.icon === id ? 'muted' : 'outline'} size="icon" aria-label={`Icono ${label}`} aria-pressed={draft.icon === id} onClick={() => patch({ icon: id })}><Icon aria-hidden="true" /></Button>
                })}
              </div>
              {errors.icon && <p className="text-xs text-red-300" role="alert">{errors.icon}</p>}
            </div>
          </fieldset>
          <div><p className="mb-1.5 text-xs font-semibold text-muted-foreground">Vista previa</p><AccountPreview {...draft} value={account?.balance ?? (Number.isFinite(initialBalance) ? initialBalance : 0)} hidden={hidden} /></div>
          {submission.error && <p className="text-sm text-red-300" role="alert">{submission.error}</p>}
          <FormActions busy={submission.busy} label={account ? 'Guardar cambios' : 'Crear cuenta'} onCancel={submission.close} />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AccountAdjustmentDialog({ account, records, hidden, onSave, onClose, onCloseAutoFocus }: CloseProps & {
  account: Account; records: FinancialRecords; hidden: boolean; onSave: (draft: AdjustmentDraft) => Promise<void>;
}) {
  const submission = useDialogSubmission(onClose)
  const [date, setDate] = useState(today)
  const [amount, setAmount] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof validateAdjustment>>({})
  const previousBalance = date ? balanceOn(account, records, date) : 0
  const actualBalance = /^-?\d+$/.test(amount) ? Number(amount) : NaN
  const difference = actualBalance - previousBalance

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '')
    const draft = { accountId: account.id, date, actualBalance, previousBalance, reason, confirmed }
    const validation = validateAdjustment(draft, account, previousBalance)
    setErrors(validation)
    if (!Object.keys(validation).length) void submission.run(() => onSave(draft))
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
        <DialogTitle className="pr-8 text-xl font-bold">Ajustar saldo</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">Registra una corrección independiente para {account.name}.</DialogDescription>
        <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
          <fieldset disabled={submission.busy} className="min-w-0 space-y-3">
            <dl className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary p-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Saldo registrado a la fecha</dt><dd className="mt-1 font-bold tabular-nums">{date ? formatMoney(previousBalance, hidden) : '—'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Diferencia detectada</dt><dd className="mt-1 font-bold tabular-nums">{date && Number.isFinite(difference) ? formatMoney(difference, hidden) : '—'}</dd></div>
            </dl>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nuevo saldo real (CLP)" error={errors.actualBalance}>{(id, attrs) => <Input id={id} inputMode="text" value={amount} onChange={event => { setAmount(event.target.value); setConfirmed(false) }} maxLength={13} required {...attrs} />}</Field>
              <Field label="Fecha del ajuste" error={errors.date}>{(id, attrs) => <Input id={id} type="date" value={date} min={account.openedOn} max={today} onChange={event => { setDate(event.target.value); setConfirmed(false) }} required {...attrs} />}</Field>
            </div>
            <Field label="Motivo del ajuste" error={errors.reason}>{(id, attrs) => <Input id={id} name="reason" maxLength={160} required placeholder="Ej. Recuento de efectivo" {...attrs} />}</Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Confirmo que quiero registrar este ajuste.</label>
            {errors.confirmed && <p className="text-xs text-red-300" role="alert">{errors.confirmed}</p>}
          </fieldset>
          {submission.error && <p className="text-sm text-red-300" role="alert">{submission.error}</p>}
          <FormActions busy={submission.busy} label="Registrar ajuste" onCancel={submission.close} />
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AccountStatusDialog({ action, account, records, hidden, onConfirm, onClose, onCloseAutoFocus }: CloseProps & {
  action: 'archive' | 'reactivate' | 'delete'; account: Account; records: FinancialRecords; hidden: boolean; onConfirm: () => Promise<void>;
}) {
  const submission = useDialogSubmission(onClose)
  const refs = accountReferences(account.id)
  const blocked = action === 'delete' ? deletionReasons(account, records) : []
  const config = {
    archive: { title: 'Archivar cuenta', description: `«${account.name}» conservará su saldo e historial. Reactívala para registrar nuevas operaciones.` },
    reactivate: { title: 'Reactivar cuenta', description: `«${account.name}» volverá a estar disponible en los selectores de movimientos.` },
    delete: { title: 'Eliminar cuenta', description: blocked.length ? `Actualmente no se puede eliminar «${account.name}».` : `Confirma la eliminación definitiva de «${account.name}».` },
  }[action]
  return (
    <Dialog open onOpenChange={open => { if (!open) submission.close() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={submission.busy} aria-busy={submission.busy}>
        {action !== 'reactivate' && <span className="mb-3 grid size-10 place-items-center rounded-lg bg-warning/12 text-amber-300"><TriangleAlert className="size-5" aria-hidden="true" /></span>}
        <DialogTitle className="pr-8 text-xl font-bold">{config.title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-muted-foreground">{config.description}</DialogDescription>
        {action === 'archive' && Boolean(refs.commitments || refs.reserved) && (
          <ul className="mt-3 space-y-1 rounded-lg bg-warning/10 p-3 text-sm text-amber-200">
            {refs.reserved > 0 && <li>Fondos reservados para metas: {formatMoney(refs.reserved, hidden)}.</li>}
            {refs.commitments > 0 && <li>Compromisos asociados: {refs.commitments}.</li>}
          </ul>
        )}
        {blocked.length ? <><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{blocked.map(reason => <li key={reason}>{reason}</li>)}</ul><Button className="mt-4" variant="outline" onClick={submission.close}>Entendido</Button></>
          : <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void submission.run(onConfirm) }}>
            {submission.error && <p className="text-sm text-red-300" role="alert">{submission.error}</p>}
            <FormActions busy={submission.busy} label={config.title} onCancel={submission.close} destructive={action === 'delete'} />
          </form>}
      </DialogContent>
    </Dialog>
  )
}

export function AccountDetail({ account, records, detected, hidden, onHistory, onClose, onCloseAutoFocus }: CloseProps & {
  account: AccountWithBalance; records: FinancialRecords; detected: ReadonlySet<string>; hidden: boolean; onHistory: () => void;
}) {
  const [period, setPeriod] = useState<Period>('month')
  const { from, to } = getPeriodRange(period)
  const activity = accountActivity(account.id, records.movements, from, to)
  const recent = records.movements.filter(item => involvesAccount(item, account.id) && item.date >= from && item.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const adjustments = records.adjustments.filter(item => item.accountId === account.id && item.date >= from && item.date <= to)
  const columns = [
    { label: 'Ingresos', value: activity.income, color: 'text-emerald-300' }, { label: 'Gastos', value: activity.expense, color: 'text-red-300' },
    { label: 'Transferencias recibidas', value: activity.received, color: 'text-blue-300' }, { label: 'Transferencias enviadas', value: activity.sent, color: 'text-blue-300' },
  ]
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} className="h-dvh max-h-none w-full max-w-4xl rounded-none border-y-0 border-r-0" style={{ top: 0, left: 'auto', right: 0, translate: 'none' }}>
        <div className="flex items-center gap-3 pr-8">
          <AccountIcon account={account} />
          <div className="min-w-0"><DialogTitle className="text-xl font-bold wrap-anywhere">{account.name}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">{accountTypeLabel(account.type)} · {account.currency}</DialogDescription></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2"><AccountStatusBadge status={account.status} /><p className="text-xs text-muted-foreground">Creada el {formatDate(account.openedOn, { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
        {account.description && <p className="mt-2 text-sm text-muted-foreground wrap-anywhere">{account.description}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary p-4">
          <div><dt className="text-xs text-muted-foreground">Saldo actual</dt><dd className="mt-1 text-xl font-bold tabular-nums wrap-anywhere">{formatMoney(account.balance, hidden)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Saldo inicial</dt><dd className="mt-1 text-xl font-bold tabular-nums wrap-anywhere">{formatMoney(account.initialBalance, hidden)}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Actividad del período</h2><PeriodSelect period={period} onChange={setPeriod} label="Período del detalle" /></div>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {columns.map(item => <div key={item.label} className="rounded-lg border border-border p-2.5"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className={cn('mt-1 text-sm font-bold tabular-nums wrap-anywhere', item.color)}>{formatMoney(item.value, hidden)}</dd></div>)}
        </dl>
        <div className="mt-5 rounded-xl border border-border p-3"><BalanceChartTitle /><AccountBalanceChart records={records} accountId={account.id} period={period} hidden={hidden} /></div>
        <section className="mt-5 rounded-xl border border-border" aria-label="Movimientos recientes">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2"><h2 className="font-bold">Movimientos recientes</h2><Button variant="outline" size="sm" onClick={onHistory}>Ver historial de la cuenta</Button></div>
          {recent.length ? <TransactionHistory items={recent} accounts={records.accounts} detected={detected} hidden={hidden} /> : <p className="p-4 text-sm text-muted-foreground">La cuenta aún no registra movimientos en este período.</p>}
        </section>
        {adjustments.length > 0 && (
          <section className="mt-5 rounded-xl border border-border px-4 py-3" aria-label="Ajustes de saldo">
            <h2 className="font-bold">Ajustes de saldo</h2>
            <ul className="mt-2 divide-y divide-border">{adjustments.map(item => <li className="flex items-start justify-between gap-3 py-2 text-sm" key={item.id}><div className="min-w-0"><p className="font-medium wrap-anywhere">{item.reason}</p><time className="text-xs text-muted-foreground" dateTime={item.date}>{formatDate(item.date, { day: 'numeric', month: 'short', year: 'numeric' })}</time></div><span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.difference, hidden)}</span></li>)}</ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}
