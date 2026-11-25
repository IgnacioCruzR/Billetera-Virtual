import type { Movement } from '../dashboard/model.ts'
import type { ExpenseMovement, MicroExpenseDetectionConfig, MicroExpenseDetectionResult, MicroExpenseHistory, MicroExpenseStatus } from './micro-expense-model.ts'

export const defaultDetection: MicroExpenseDetectionConfig = {
  enabled: true, maximumAmount: 5_000, minimumCount: 3, excludedCategoryIds: [], frequencyView: 'weekday',
}

export function normalizeDescription(description: string) {
  return description.normalize('NFD').replace(/\p{Mark}/gu, '').toLocaleLowerCase('es-CL').replace(/[^\p{Letter}\p{Number}]+/gu, ' ').trim()
}

export function patternId(item: ExpenseMovement) {
  return JSON.stringify([item.categoryId, normalizeDescription(item.description)])
}

export function detectMicroExpenses(movements: Movement[], config: MicroExpenseDetectionConfig, through?: string): MicroExpenseDetectionResult {
  const candidates = new Set<string>()
  if (!config.enabled) return { candidateIds: candidates }
  const exclusions = new Set(config.excludedCategoryIds)
  const groups = new Map<string, { count: number; unreviewed: string[] }>()
  for (const item of movements) {
    if (item.type !== 'gasto' || (through && item.date > through) || item.amount > config.maximumAmount || exclusions.has(item.categoryId)) continue
    if (item.classification === 'necesario' || item.classification === 'excluido' || !normalizeDescription(item.description)) continue
    const key = `${item.date.slice(0, 7)}:${patternId(item)}`
    const group = groups.get(key) ?? { count: 0, unreviewed: [] }
    group.count++
    if (item.classification !== 'prescindible') group.unreviewed.push(item.id)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    if (group.count >= config.minimumCount) group.unreviewed.forEach(id => candidates.add(id))
  }
  return { candidateIds: candidates }
}

export function classificationOf(movement: Movement, detected: ReadonlySet<string>): MicroExpenseStatus {
  if (movement.type !== 'gasto') return 'sin-clasificacion'
  const { classification } = movement
  if (classification === 'necesario' || classification === 'prescindible' || classification === 'excluido') return classification
  return detected.has(movement.id) ? 'posible' : 'sin-clasificacion'
}

export function microExpenseHistory(movement: ExpenseMovement, detected: ReadonlySet<string>): MicroExpenseHistory {
  const status = classificationOf(movement, detected)
  return {
    movement, status, patternId: patternId(movement),
    source: status === 'posible' ? 'automática' : status === 'sin-clasificacion' ? 'sin asignar' : 'manual',
  }
}

export const isAnalyzed = (entry: Pick<MicroExpenseHistory, 'status'>) =>
  entry.status === 'posible' || entry.status === 'necesario' || entry.status === 'prescindible'
