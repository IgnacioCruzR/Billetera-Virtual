import { useState } from 'react'
import { Archive, BriefcaseBusiness, Bus, Ellipsis, HeartPulse, Home, Pencil, PiggyBank, Plus, RotateCcw, Tag, Ticket, Trash2, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { useFinancialRecords } from '@/features/accounts/account-data'
import { categoryIcons, categoryReferences, readCategories, validateCategory, type Category, type CategoryFormData, type CategoryType } from '@/features/categories/category-model'
import { mobileDrawer } from '@/features/micro-expenses/detection-settings'
import { SectionForm } from './settings-form'

const visuals = { tag: Tag, food: Utensils, transit: Bus, home: Home, health: HeartPulse, leisure: Ticket, work: BriefcaseBusiness, savings: PiggyBank }
const blank: CategoryFormData = { name: '', type: 'gasto', icon: 'tag', color: '#818CF8', description: '' }
const actions = { archive: 'Archivar categoría', restore: 'Reactivar categoría', delete: 'Eliminar categoría' }
const typeLabel = (type: CategoryType) => type === 'gasto' ? 'Gasto' : 'Ingreso'

function CategoryVisual({ item }: { item: Pick<Category, 'icon' | 'color'> }) {
  const Icon = visuals[item.icon] ?? Tag
  const safe = /^#[0-9A-Fa-f]{6}$/.test(item.color) ? item.color : blank.color
  return <span className="grid size-9 shrink-0 place-items-center rounded-lg border" style={{ color: safe, borderColor: safe + '50', backgroundColor: safe + '20' }}><Icon className="size-4.5" aria-hidden="true" /></span>
}

type DialogMode = { type: 'create' } | { type: 'edit'; item: Category } | { type: 'archive' | 'restore' | 'delete'; item: Category }

export function CategoryManagement({ finance, onToast }: { finance: ReturnType<typeof useFinancialRecords>; onToast: (text: string) => void }) {
  const [filter, setFilter] = useState<'todas' | CategoryType>('todas')
  const [mode, setMode] = useState<DialogMode | null>(null)
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const categories = readCategories(finance.records)
  const visible = categories.filter(value => filter === 'todas' || value.type === filter)
  function open(value: DialogMode) {
    setError(''); setDirty(false); setDiscard(false); setMode(value)
  }
  function close() {
    if (busy) return
    if (dirty) setDiscard(true)
    else setMode(null)
  }
  async function applyAction() {
    if (!mode || mode.type === 'edit' || mode.type === 'create' || busy) return
    setBusy(true); setError('')
    try {
      await finance.changeCategory(mode.item.id, mode.type)
      onToast({ archive: 'Categoría archivada.', restore: 'Categoría reactivada.', delete: 'Categoría eliminada.' }[mode.type])
      setMode(null)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo completar la operación.') }
    finally { setBusy(false) }
  }
  const editing = mode?.type === 'edit' ? mode.item : undefined
  const operation = mode?.type === 'archive' || mode?.type === 'restore' || mode?.type === 'delete' ? mode : null
  return <>
    <section className="panel min-w-0 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">Categorías financieras</h3><p className="mt-1 text-sm text-muted-foreground">Administra las categorías disponibles en tus operaciones.</p></div>
        <Button onClick={() => open({ type: 'create' })} disabled={finance.status !== 'ready'}><Plus aria-hidden="true" />Nueva categoría</Button></div>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar categorías">
        {(['todas', 'gasto', 'ingreso'] as const).map(value => <Button key={value} variant={filter === value ? 'muted' : 'outline'} size="sm" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'todas' ? 'Todas' : value === 'gasto' ? 'Gastos' : 'Ingresos'}</Button>)}
      </div>
      {!categories.some(item => !item.builtIn) && <p className="mt-3 text-xs text-muted-foreground">Aún no has creado categorías personalizadas.</p>}
      {finance.status === 'loading' && <div role="status" aria-label="Cargando categorías" className="mt-3 h-16 rounded-lg bg-accent motion-safe:animate-pulse" />}
      {finance.status === 'error' && <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-sm">No se pudo cargar el catálogo. <Button variant="outline" size="sm" onClick={finance.reload}>Reintentar</Button></div>}
      {finance.status === 'ready' && <ul className="mt-3 divide-y divide-border" aria-label="Catálogo de categorías">
        {visible.map(item => {
          const refs = categoryReferences(finance.records, item.id)
          const referenced = refs.movements || refs.budgets || refs.commitments || refs.historical
          return <li key={item.id} className="flex min-w-0 items-center gap-2.5 py-2.5">
            <CategoryVisual item={item} />
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold wrap-anywhere">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{typeLabel(item.type)} · {item.status === 'activa' ? 'Activa' : 'Archivada'} · {refs.movements} movimientos</p>
              {item.description && <p className="mt-0.5 text-xs text-muted-foreground wrap-anywhere">{item.description}</p>}</div>
            <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={'Acciones de ' + item.name}><Ellipsis aria-hidden="true" /></Button></PopoverTrigger>
              <PopoverContent className="grid w-49 gap-1 p-1.5" align="end">
                <Button variant="ghost" className="justify-start" onClick={() => open({ type: 'edit', item })}><Pencil aria-hidden="true" />Editar</Button>
                <Button variant="ghost" className="justify-start" onClick={() => open({ type: item.status === 'activa' ? 'archive' : 'restore', item })}>{item.status === 'activa' ? <Archive aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}{item.status === 'activa' ? 'Archivar' : 'Reactivar'}</Button>
                <Button variant="ghost" className="justify-start text-red-200" onClick={() => open({ type: 'delete', item })}><Trash2 aria-hidden="true" />{referenced ? 'Consultar eliminación' : 'Eliminar'}</Button>
              </PopoverContent>
            </Popover>
          </li>
        })}
      </ul>}
    </section>
    {mode && <Dialog open onOpenChange={open => { if (!open) close() }}><DialogContent className={mobileDrawer} closeDisabled={busy}>
      <DialogTitle className="pr-8 text-xl font-bold">{discard ? 'Descartar cambios de categoría' : operation ? actions[operation.type] : editing ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
      <DialogDescription className="mt-1 text-sm text-muted-foreground">{discard ? 'Se perderán los cambios ingresados en este formulario.' : operation ? operation.item.name : 'El nombre, icono y color se reflejan en el catálogo compartido.'}</DialogDescription>
      {discard && <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDiscard(false)}>Seguir editando</Button><Button className="bg-danger text-background hover:bg-red-400" onClick={() => { setDirty(false); setMode(null) }}>Descartar cambios</Button></div>}
      {!discard && operation && <div className="mt-4 space-y-3">
        <p className="text-sm text-muted-foreground">{operation.type === 'archive' ? 'Se conservarán sus movimientos y presupuestos. La categoría dejará de aparecer en nuevos registros.' : operation.type === 'restore' ? 'La categoría volverá a estar disponible en los selectores.' : 'La eliminación es definitiva y requiere una categoría sin referencias financieras.'}</p>
        {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
        {operation.type === 'delete' && (() => {
          const refs = categoryReferences(finance.records, operation.item.id)
          return !!(refs.movements || refs.budgets || refs.commitments || refs.historical)
        })() ? <p role="status" className="rounded-lg bg-warning/10 p-2 text-sm text-amber-200">La categoría tiene referencias financieras. Puedes conservarlas archivando la categoría.</p> :
          <Button className={operation.type === 'delete' ? 'bg-danger text-background hover:bg-red-400' : undefined} disabled={busy} onClick={() => void applyAction()}>{busy ? 'Guardando…' : actions[operation.type]}</Button>}
      </div>}
      {!operation && <div className={discard ? 'hidden' : 'mt-4'}>
        <SectionForm title="Datos de la categoría" initial={editing ?? blank} onDirty={setDirty} label="Guardar categoría" onSave={async value => {
          const errors = validateCategory(value, categories, editing, editing?.status !== 'archivada')
          const message = Object.values(errors)[0]
          if (message) throw new Error(message)
          await finance.saveCategory(value, editing?.id)
          onToast(editing ? 'Categoría actualizada.' : 'Categoría creada.')
          setDirty(false); setMode(null)
        }}>
          {(value, update) => <>
            <div className="flex items-center gap-2 rounded-lg border border-border p-2.5"><CategoryVisual item={value} /><div className="min-w-0"><p className="text-sm font-semibold wrap-anywhere">{value.name.trim() || 'Vista previa'}</p><p className="text-xs text-muted-foreground">{typeLabel(value.type)}</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre de la categoría">{id => <Input id={id} maxLength={60} value={value.name} onChange={event => update({ ...value, name: event.target.value })} />}</Field>
              <Field label="Tipo de categoría">{id => <Select id={id} disabled={Boolean(editing)} value={value.type} onChange={event => update({ ...value, type: event.target.value as CategoryType })}><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></Select>}</Field>
              <Field label="Icono de categoría">{id => <Select id={id} value={value.icon} onChange={event => update({ ...value, icon: event.target.value as CategoryFormData['icon'] })}>{categoryIcons.map(icon => <option key={icon.id} value={icon.id}>{icon.label}</option>)}</Select>}</Field>
              <Field label="Color de categoría">{id => <Input id={id} type="color" value={value.color} onChange={event => update({ ...value, color: event.target.value })} />}</Field>
            </div>
            <Field label="Descripción (opcional)">{id => <Input id={id} maxLength={160} value={value.description} onChange={event => update({ ...value, description: event.target.value })} />}</Field>
          </>}
        </SectionForm>
      </div>}
    </DialogContent></Dialog>}
  </>
}
