import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SettingsSaveStatus } from './preferences-model'

const statusText: Record<SettingsSaveStatus, string> = {
  idle: 'Sin modificaciones', dirty: 'Cambios pendientes', saving: 'Guardando…', saved: 'Guardado correctamente',
  error: 'Cambios sin guardar', cancelled: 'Cambios cancelados',
}

export function SectionForm<T>({ title, description, initial, defaults, onSave, onDirty, children, label = 'Guardar cambios' }: {
  title: string; description?: string; initial: T; defaults?: T; onSave: (value: T) => Promise<void | T>; onDirty: (dirty: boolean) => void;
  children: (value: T, update: (value: T) => void, saving: boolean) => ReactNode; label?: string;
}) {
  const [baseline, setBaseline] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [status, setStatus] = useState<SettingsSaveStatus>('idle')
  const [error, setError] = useState('')
  const locked = useRef(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)
  useEffect(() => { onDirty(dirty) }, [dirty, onDirty])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!dirty || locked.current) return
    locked.current = true
    setStatus('saving')
    setError('')
    try {
      const saved = await onSave(draft)
      const next = saved === undefined ? draft : saved
      setBaseline(next)
      setDraft(next)
      setStatus('saved')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudieron guardar los cambios. Vuelve a intentarlo.')
      setStatus('error')
    } finally { locked.current = false }
  }
  function update(value: T) {
    setDraft(value)
    setStatus(JSON.stringify(value) === JSON.stringify(baseline) ? 'idle' : 'dirty')
    setError('')
  }
  return <form className="panel min-w-0 space-y-4 p-4 sm:p-5" onSubmit={submit} noValidate>
    <div><h3 className="text-base font-bold">{title}</h3>{description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}</div>
    <fieldset disabled={status === 'saving'} className="min-w-0 space-y-3">{children(draft, update, status === 'saving')}</fieldset>
    {error && <p role="alert" className="rounded-lg border border-danger/25 bg-danger/8 px-3 py-2 text-sm text-red-200">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
      <p role="status" className="text-xs text-muted-foreground">{statusText[dirty && status === 'idle' ? 'dirty' : status]}</p>
      <div className="flex flex-wrap gap-2">
        {defaults !== undefined && <Button variant="ghost" size="sm" disabled={status === 'saving'} onClick={() => update(defaults)}><RotateCcw aria-hidden="true" />Restaurar valores</Button>}
        <Button variant="outline" size="sm" disabled={!dirty || status === 'saving'} onClick={() => { setDraft(baseline); setError(''); setStatus('cancelled') }}>Cancelar cambios</Button>
        <Button type="submit" size="sm" disabled={!dirty || status === 'saving'}><Save aria-hidden="true" />{status === 'saving' ? 'Guardando…' : label}</Button>
      </div>
    </div>
  </form>
}
