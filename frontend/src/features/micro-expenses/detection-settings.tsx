import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Select } from '@/components/ui/field'
import { useCategories } from '@/features/categories/category-context'
import { maximumMovementAmount } from '@/features/movements/movement-data'
import { formatMoney } from '@/lib/utils'
import { defaultDetection } from './micro-expense-detection'
import type { MicroExpenseDetectionConfig } from './micro-expense-model'

export const mobileDrawer = 'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:max-w-none max-sm:translate-0 max-sm:rounded-b-none'

export function DetectionSettingsForm({ config, hidden, onSave, onDirty }: {
  config: MicroExpenseDetectionConfig; hidden: boolean; onSave: (config: MicroExpenseDetectionConfig) => void | Promise<void>;
  onDirty?: (dirty: boolean) => void;
}) {
  const expenseCategories = useCategories('gasto')
  const [draft, setDraft] = useState(config)
  const [amount, setAmount] = useState(String(config.maximumAmount))
  const [count, setCount] = useState(String(config.minimumCount))
  const [errors, setErrors] = useState({ amount: '', count: '' })
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'cancelled'>('idle')
  const [failure, setFailure] = useState('')
  const opening = useRef(false)
  const dirty = amount !== String(config.maximumAmount) || count !== String(config.minimumCount) ||
    JSON.stringify({ ...draft, maximumAmount: config.maximumAmount, minimumCount: config.minimumCount }) !== JSON.stringify(config)
  useEffect(() => { onDirty?.(dirty) }, [dirty, onDirty])
  function reset(value: MicroExpenseDetectionConfig) {
    setDraft(value); setAmount(String(value.maximumAmount)); setCount(String(value.minimumCount)); setErrors({ amount: '', count: '' }); setFailure('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (opening.current) return
    const maximumAmount = Number(amount)
    const minimumCount = Number(count)
    const error = {
      amount: !/^\d+$/.test(amount) || maximumAmount < 1 || maximumAmount > maximumMovementAmount ? 'Ingresa un monto entero entre 1 y 999.999.999.999 CLP.' : '',
      count: !/^\d+$/.test(count) || !Number.isSafeInteger(minimumCount) || minimumCount < 1 ? 'Ingresa una frecuencia entera mayor que cero.' : '',
    }
    setErrors(error)
    if (error.amount || error.count) return
    opening.current = true
    setSave('saving'); setFailure('')
    try {
      const value = { ...draft, maximumAmount, minimumCount }
      await onSave(value)
      reset(value); setSave('saved')
    } catch (reason) { setFailure(reason instanceof Error ? reason.message : 'No se pudo guardar el criterio.'); setSave('idle') }
    finally { opening.current = false }
  }

  return <form onSubmit={submit} noValidate className="space-y-3">
    <fieldset disabled={save === 'saving'} className="min-w-0 space-y-3">
    <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm font-medium"><input type="checkbox" className="size-4 accent-primary" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} />Detección automática</label>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Monto máximo (CLP)" error={errors.amount}>{(id, attrs) => <MoneyInput hidden={hidden} id={id} inputMode="numeric" maxLength={12} value={amount} onChange={event => setAmount(event.target.value)} required {...attrs} />}</Field>
      <Field label="Frecuencia mínima mensual" error={errors.count}>{(id, attrs) => <Input id={id} inputMode="numeric" maxLength={16} value={count} onChange={event => setCount(event.target.value)} required {...attrs} />}</Field>
    </div>
    <fieldset className="rounded-lg border border-border p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Categorías excluidas de la detección</legend>
      <div className="grid gap-2 min-[420px]:grid-cols-2">{expenseCategories.map(category => <label key={category.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-primary" checked={draft.excludedCategoryIds.includes(category.id)} onChange={event => setDraft({
        ...draft, excludedCategoryIds: event.target.checked ? [...draft.excludedCategoryIds, category.id] : draft.excludedCategoryIds.filter(id => id !== category.id),
      })} />{category.name}</label>)}</div>
    </fieldset>
    <Field label="Vista de frecuencia">{id => <Select id={id} value={draft.frequencyView} onChange={event => setDraft({ ...draft, frequencyView: event.target.value === 'pattern' ? 'pattern' : 'weekday' })}><option value="weekday">Por día de la semana</option><option value="pattern">Por patrón de consumo</option></Select>}</Field>
    <p className="rounded-lg bg-secondary px-3 py-2 text-xs leading-relaxed text-muted-foreground">{draft.enabled
      ? <>Busca gastos de hasta {/^[1-9]\d*$/.test(amount) ? formatMoney(Number(amount), hidden) : 'un monto válido'}, con {count || '—'} o más registros de la misma categoría y descripción durante un mes. {draft.excludedCategoryIds.length ? `Categorías excluidas (${draft.excludedCategoryIds.length}). ` : ''}Las marcas manuales se conservan.</>
      : 'La detección automática está desactivada. Las marcas manuales se conservan.'}</p>
    </fieldset>
    {failure && <p role="alert" className="text-sm text-red-200">{failure}</p>}
    {onDirty && <p role="status" className="text-xs text-muted-foreground">{save === 'saving' ? 'Guardando…' : dirty ? 'Cambios pendientes' : save === 'saved' ? 'Guardado correctamente' : save === 'cancelled' ? 'Cambios cancelados' : 'Sin modificaciones'}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="outline" size="sm" disabled={save === 'saving'} onClick={() => reset(defaultDetection)}>Restablecer valores</Button>
      {onDirty && <Button variant="ghost" size="sm" disabled={!dirty || save === 'saving'} onClick={() => { reset(config); setSave('cancelled') }}>Cancelar cambios</Button>}
      <Button size="sm" type="submit" disabled={save === 'saving'}>{save === 'saving' ? 'Guardando…' : 'Guardar criterio'}</Button>
    </div>
  </form>
}

export function DetectionSettings({ config, hidden, onSave, onClose, onCloseAutoFocus }: {
  config: MicroExpenseDetectionConfig; hidden: boolean; onSave: (config: MicroExpenseDetectionConfig) => void | Promise<void>;
  onClose: () => void; onCloseAutoFocus: (event: Event) => void;
}) {
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className={mobileDrawer} onCloseAutoFocus={onCloseAutoFocus}>
      <DialogTitle className="pr-7 text-xl font-bold">Configurar detección</DialogTitle>
      <DialogDescription className="mt-0.5 mb-4 text-sm text-muted-foreground">Define qué pequeños gastos aparecen como candidatos para revisar.</DialogDescription>
      <DetectionSettingsForm config={config} hidden={hidden} onSave={onSave} />
    </DialogContent>
  </Dialog>
}
