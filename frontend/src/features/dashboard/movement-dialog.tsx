import { useRef, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { validateMovement } from '@/features/movements/movement-data'
import { cn } from '@/lib/utils'
import { expenseCategories, incomeCategories, today } from './mock-data'
import { microExpenseOptions, movementTypes, type FinancialRecords, type Movement, type MovementDraft, type MovementPreset, type MovementType } from './model'

const movementIcons = { gasto: ArrowUpRight, ingreso: ArrowDownLeft, transferencia: ArrowLeftRight }

function MovementForm({ records, record, preset, busy, onSave, onCancel }: {
  records: FinancialRecords; record: Movement | null; preset?: MovementPreset; busy: boolean;
  onSave: (draft: MovementDraft) => Promise<void>; onCancel: () => void
}) {
  const activeAccounts = records.accounts.filter(account => account.status === 'activa')
  const [type, setType] = useState<MovementType>(record?.type ?? preset?.type ?? 'gasto')
  const [accountId, setAccountId] = useState(record?.accountId ?? preset?.accountId ?? activeAccounts[0]?.id ?? '')
  const [destinationId, setDestinationId] = useState(record?.type === 'transferencia' ? record.destinationId : '')
  const [errors, setErrors] = useState<ReturnType<typeof validateMovement>>({})
  const [saveError, setSaveError] = useState('')
  const isTransfer = type === 'transferencia'
  const linked = Boolean(record?.commitmentId)
  const categoryOptions = type === 'ingreso' ? incomeCategories : expenseCategories
  const defaultCategory = record && record.type !== 'transferencia' && record.type === type ? record.categoryId : ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setSaveError('')
    const data = new FormData(event.currentTarget)
    const read = (key: string) => String(data.get(key) ?? '')
    const amount = record?.commitmentId ? record.amount : /^\d+$/.test(read('amount')) ? Number(read('amount')) : NaN
    const common = { accountId, amount, date: record?.commitmentId ? record.date : read('date'), description: read('description').trim() }
    const categoryId = read('category')
    const classification = microExpenseOptions.find(item => item.id === read('classification'))?.id ?? 'automatica'
    const draft: MovementDraft = type === 'transferencia' ? { ...common, type, destinationId }
      : type === 'gasto' ? { ...common, type, categoryId, classification } : { ...common, type, categoryId }
    const nextErrors = validateMovement(draft, records, record?.id)
    setErrors(nextErrors)
    const first = Object.keys(nextErrors)[0]
    if (first) {
      const field = event.currentTarget.elements.namedItem(first)
      if (field instanceof HTMLElement) field.focus()
      return
    }
    try {
      await onSave(draft)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el movimiento. Intenta nuevamente.')
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-5 space-y-4">
      <fieldset className="min-w-0 space-y-4" disabled={busy}>
        <legend className="mb-2 text-sm font-semibold">Tipo de movimiento</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-secondary p-1">
          {movementTypes.map(item => {
            const Icon = movementIcons[item.id]
            return (
              <Button key={item.id} variant="ghost" disabled={linked && item.id !== type} onClick={() => { setType(item.id); setErrors({}) }} aria-pressed={item.id === type}
                className={cn('h-9 gap-1.5 px-1 text-xs sm:text-sm', item.id === type && 'bg-primary/15 text-emerald-300 hover:bg-primary/20 hover:text-emerald-200')}>
                <Icon className="hidden size-3.5 min-[430px]:block" aria-hidden="true" />{item.label}
              </Button>
            )
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto (CLP)" error={errors.amount}>{(id, attributes) => <Input id={id} name="amount" inputMode="numeric" maxLength={12} readOnly={linked} required placeholder="15000" defaultValue={record?.amount ?? preset?.amount} {...attributes} />}</Field>
          <Field label="Fecha" error={errors.date}>{(id, attributes) => <Input id={id} name="date" type="date" defaultValue={record?.date ?? today} max={today} readOnly={linked} required {...attributes} />}</Field>
          <Field label={type === 'ingreso' ? 'Cuenta de destino' : 'Cuenta de origen'} error={errors.account}>{(id, attributes) => (
            <Select id={id} name="account" value={accountId} disabled={linked} onChange={event => {
              setAccountId(event.target.value)
              if (destinationId === event.target.value) setDestinationId('')
            }} required {...attributes}>
              <option value="" disabled>Selecciona una cuenta</option>
              {(linked ? records.accounts : activeAccounts).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          )}</Field>
          {isTransfer ? (
            <Field label="Cuenta de destino" error={errors.destination}>{(id, attributes) => (
              <Select id={id} name="destination" value={destinationId} onChange={event => setDestinationId(event.target.value)} required {...attributes}>
                <option value="" disabled>Selecciona una cuenta</option>
                {activeAccounts.filter(item => item.id !== accountId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}</Field>
          ) : (
            <Field key={type} label="Categoría" error={errors.category}>{(id, attributes) => (
              <Select id={id} name="category" defaultValue={defaultCategory} required {...attributes}>
                <option value="" disabled>Selecciona una categoría</option>
                {categoryOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}</Field>
          )}
        </div>
        <Field label="Descripción (opcional)">{id => <Input id={id} name="description" placeholder="Ej. Compras del supermercado" maxLength={120} defaultValue={record?.description ?? preset?.description} />}</Field>
        {type === 'gasto' && (
          <Field label="Clasificación de gasto pequeño">{id => (
            <Select id={id} name="classification" defaultValue={record?.type === 'gasto' ? record.classification : 'automatica'}>
              {microExpenseOptions.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
            </Select>
          )}</Field>
        )}
      </fieldset>
      {linked && <p className="text-xs text-muted-foreground">Movimiento de un compromiso confirmado. Puedes revisar su categoría, descripción y clasificación.</p>}
      {saveError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-red-300">{saveError}</p>}
      {[errors.amount, saveError].some(message => message?.toLowerCase().includes('reservad')) && <a className="inline-block text-sm font-semibold text-indigo-200 hover:underline" href={record ? '#metas' : `#metas?cuenta=${encodeURIComponent(accountId)}`} onClick={onCancel}>{record ? 'Revisar reservas' : 'Revisar reservas de la cuenta'}</a>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={onCancel} disabled={busy}>Cancelar</Button>
        <Button type="submit" disabled={busy}>{busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}{busy ? 'Guardando…' : 'Guardar movimiento'}</Button>
      </div>
    </form>
  )
}

export function MovementDialog({ open, record, preset, onOpenChange, records, onSave, onCloseAutoFocus }: {
  open: boolean; record: Movement | null; preset?: MovementPreset; onOpenChange: (value: boolean) => void; records: FinancialRecords;
  onSave: (draft: MovementDraft, id?: string) => Promise<void>; onCloseAutoFocus: (event: Event) => void
}) {
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)

  async function save(draft: MovementDraft) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      await onSave(draft, record?.id)
      onOpenChange(false)
    } finally {
      setBusy(false)
      locked.current = false
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!locked.current) onOpenChange(value) }}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus} closeDisabled={busy} aria-busy={busy}>
        <DialogTitle className="panel-heading pr-7 font-sans text-xl">{record ? 'Editar movimiento' : 'Registrar movimiento'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">{record ? 'Actualiza los datos de esta operación.' : 'Agrega un gasto, un ingreso o una transferencia entre tus cuentas.'}</DialogDescription>
        <MovementForm key={record?.id ?? 'new'} record={record} preset={preset} records={records} busy={busy} onSave={save} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
