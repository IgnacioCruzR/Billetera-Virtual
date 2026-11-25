import type { FinancialRecords } from '../dashboard/model.ts'

export const categoryIcons = [
  { id: 'tag', label: 'Etiqueta' }, { id: 'food', label: 'Alimentación' }, { id: 'transit', label: 'Transporte' },
  { id: 'home', label: 'Vivienda' }, { id: 'health', label: 'Salud' }, { id: 'leisure', label: 'Entretenimiento' },
  { id: 'work', label: 'Trabajo' }, { id: 'savings', label: 'Ahorro' },
] as const
export type CategoryType = 'ingreso' | 'gasto'
export type CategoryStatus = 'activa' | 'archivada'
export type CategoryIconId = typeof categoryIcons[number]['id']
export interface CategoryFormData { name: string; type: CategoryType; icon: CategoryIconId; color: string; description: string }
export interface Category extends CategoryFormData { id: string; status: CategoryStatus; createdAt?: string; builtIn?: boolean }
export type CategoryDisplay = Pick<Category, 'id' | 'name' | 'color'>

function seed(id: string, name: string, color: string, icon: CategoryIconId, type: CategoryType = 'gasto'): Category {
  return { id, name, color, icon, type, status: 'activa', description: '', builtIn: true }
}
export const seedCategories = [
  seed('alimentacion', 'Alimentación', '#10B981', 'food'),
  seed('transporte', 'Transporte', '#60A5FA', 'transit'),
  seed('vivienda', 'Vivienda', '#818CF8', 'home'),
  seed('salud', 'Salud', '#2DD4BF', 'health'),
  seed('entretenimiento', 'Entretenimiento', '#F59E0B', 'leisure'),
  seed('otros', 'Otros', '#64748B', 'tag'),
  seed('sueldo', 'Sueldo', '#10B981', 'work', 'ingreso'),
  seed('freelance', 'Trabajo independiente', '#60A5FA', 'work', 'ingreso'),
  seed('otros-ingresos', 'Otros ingresos', '#818CF8', 'tag', 'ingreso'),
]

export const readCategories = (records: Pick<FinancialRecords, 'categories'>) => records.categories ?? seedCategories
export function filterCategories(items: Category[], type?: CategoryType, activeOnly = false, retainedId?: string) {
  return items.filter(item => (!type || item.type === type) && (!activeOnly || item.status === 'activa' || item.id === retainedId))
}

export const normalizeCategoryName = (name: string) => name.normalize('NFKD').replace(/\p{Mark}/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CL')
export const cleanCategoryName = (name: string) => name.trim().replace(/\s+/g, ' ')

export function validateCategory(draft: CategoryFormData, list: Category[], existing?: Category, activating = true) {
  const errors: Partial<Record<keyof CategoryFormData, string>> = {}
  const name = normalizeCategoryName(draft.name)
  if (!name || cleanCategoryName(draft.name).length > 60) errors.name = 'Ingresa un nombre de 1 a 60 caracteres.'
  else if (activating && list.some(item => item.id !== existing?.id && item.status === 'activa' && item.type === draft.type && normalizeCategoryName(item.name) === name)) errors.name = 'Ya existe una categoría activa del mismo tipo con este nombre.'
  if ((draft.type !== 'ingreso' && draft.type !== 'gasto') || (existing && existing.type !== draft.type)) errors.type = 'El tipo de una categoría existente se conserva.'
  if (!categoryIcons.some(item => item.id === draft.icon)) errors.icon = 'Elige un icono disponible.'
  if (!/^#[0-9a-f]{6}$/i.test(draft.color)) errors.color = 'Elige un color válido.'
  if (draft.description.trim().length > 160) errors.description = 'Usa hasta 160 caracteres.'
  return errors
}

export function categoryReferences(records: FinancialRecords, id: string) {
  const linked = records.commitments.filter(item => item.categoryId === id)
  return {
    movements: records.movements.filter(item => item.type !== 'transferencia' && item.categoryId === id).length,
    budgets: records.budgets.filter(item => item.categoryId === id).length,
    commitments: linked.length,
    pending: linked.filter(item => item.status === 'pendiente').length,
    historical: Boolean(records.usedCategoryIds?.has(id)),
  }
}

export function saveCategory(records: FinancialRecords, draft: CategoryFormData, id: string, now: string, editing: boolean) {
  const list = readCategories(records)
  const existing = list.find(item => item.id === id)
  if (editing ? !existing : existing) throw new Error('El catálogo cambió. Vuelve a abrir la categoría.')
  const error = Object.values(validateCategory(draft, list, existing, existing?.status !== 'archivada'))[0]
  if (error) throw new Error(error)
  const next: Category = {
    id, createdAt: existing?.createdAt ?? now, status: existing?.status ?? 'activa', builtIn: existing?.builtIn,
    name: cleanCategoryName(draft.name), type: draft.type, icon: draft.icon, description: draft.description.trim(), color: draft.color.toUpperCase(),
  }
  return { ...records, categories: editing ? list.map(item => item.id === id ? next : item) : [...list, next] }
}

export function changeCategory(records: FinancialRecords, id: string, action: 'archive' | 'restore' | 'delete') {
  const list = readCategories(records)
  const item = list.find(item => item.id === id)
  if (!item) throw new Error('La categoría ya no está disponible.')
  const refs = categoryReferences(records, id)
  if (action === 'delete') {
    if (refs.movements || refs.budgets || refs.commitments || refs.historical) throw new Error('La categoría tiene referencias financieras. Puedes conservarlas archivando la categoría.')
    return { ...records, categories: list.filter(entry => entry.id !== id) }
  }
  if (action === 'archive' && refs.pending) throw new Error('Resuelve o cambia los compromisos pendientes antes de archivar esta categoría.')
  if (action === 'restore') {
    const error = validateCategory(item, list, item).name
    if (error) throw new Error(error)
  }
  const status: CategoryStatus = action === 'archive' ? 'archivada' : 'activa'
  return { ...records, categories: list.map(entry => entry.id === id ? { ...entry, status } : entry) }
}
