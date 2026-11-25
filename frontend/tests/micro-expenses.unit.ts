import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Movement } from '../src/features/dashboard/model.ts'
import { analyzeMicroExpenses, emptySavingsScenario, simulateSavings } from '../src/features/micro-expenses/micro-expense-analysis.ts'
import { classificationOf, defaultDetection, detectMicroExpenses, normalizeDescription, patternId } from '../src/features/micro-expenses/micro-expense-detection.ts'
import type { ExpenseMovement } from '../src/features/micro-expenses/micro-expense-model.ts'

const expense = (id: string, changes: Partial<ExpenseMovement> = {}): ExpenseMovement => ({
  id, type: 'gasto', accountId: 'cash', categoryId: 'food', amount: 5_000, date: '2028-02-10', description: 'Café de la mañana', classification: 'automatica', ...changes,
})

test('detecta por monto inclusivo, descripción normalizada, categoría y mes', () => {
  assert.equal(normalizeDescription('  ¡CAFÉ!   de la  mañana.'), 'cafe de la manana')
  const movements: Movement[] = [
    expense('first'), expense('second', { description: 'CAFE de la mañana!' }),
    expense('manual', { classification: 'prescindible' }), expense('supra', { amount: 5_001 }),
    expense('other-month', { date: '2028-03-01' }), expense('other-category', { categoryId: 'transport' }),
    expense('other-label', { description: 'Almuerzo' }), expense('required', { classification: 'necesario' }),
    expense('excluded', { classification: 'excluido' }), expense('future', { date: '2028-02-27' }),
    { id: 'i', type: 'ingreso', accountId: 'cash', categoryId: 'salary', date: '2028-02-10', amount: 5_000, description: 'Café de la mañana' },
    { id: 't', type: 'transferencia', accountId: 'cash', destinationId: 'other', date: '2028-02-10', amount: 5_000, description: 'Café de la mañana' },
  ]
  const detected = detectMicroExpenses(movements, defaultDetection, '2028-02-20').candidateIds
  assert.deepEqual([...detected], ['first', 'second'])
  assert.equal(detectMicroExpenses(movements, { ...defaultDetection, excludedCategoryIds: ['food'] }).candidateIds.size, 0)
  assert.equal(detectMicroExpenses(movements, { ...defaultDetection, enabled: false }).candidateIds.size, 0)
  assert.equal(detectMicroExpenses(movements, { ...defaultDetection, minimumCount: 4 }, '2028-02-20').candidateIds.size, 0)
  assert.equal(classificationOf(movements[2], new Set()), 'prescindible')
  assert.equal(classificationOf(movements[7], new Set(['required'])), 'necesario')
  assert.equal(classificationOf(movements[8], new Set(['excluded'])), 'excluido')
})

test('calcula participación, frecuencia y variación con corte equivalente de febrero bisiesto', () => {
  const movements: Movement[] = [
    expense('today', { amount: 1_500, classification: 'necesario' }), expense('other-day', { amount: 2_500, date: '2028-02-11', classification: 'prescindible' }),
    expense('excluded', { amount: 2_000, classification: 'excluido' }), expense('past', { date: '2028-01-09', amount: 2_000, classification: 'prescindible' }),
    expense('after-cutoff', { date: '2028-01-21', amount: 10_000, classification: 'prescindible' }),
    { id: 'i', type: 'ingreso', accountId: 'cash', categoryId: 'salary', date: '2028-02-12', amount: 10_000, description: '' },
    { id: 't', type: 'transferencia', accountId: 'cash', destinationId: 'other', date: '2028-02-10', amount: 5_000, description: '' },
  ]
  const analysis = analyzeMicroExpenses(movements, new Set(), { month: '2028-02', range: 'month' }, '2028-02-20')
  assert.deepEqual(analysis.previous, { from: '2028-01-01', to: '2028-01-20' })
  const { summary } = analysis
  assert.deepEqual([summary.amount, summary.count, summary.average, summary.discretionary], [4_000, 2, 2_000, 2_500])
  assert.equal(summary.expenseShare, 4_000 / 6_000 * 100)
  assert.equal(summary.incomeShare, 40)
  assert.equal(summary.perWeek, 0.7)
  assert.equal(summary.variation, 100)
  assert.equal(summary.monthlyEstimate, 5_800)
  assert.equal(summary.annualEstimate, 69_600)
})

test('trata la falta de datos y proyecta sobre meses completos sin extrapolar', () => {
  const sparse = analyzeMicroExpenses([expense('single', { classification: 'necesario' })], new Set(), { month: '2028-02', range: 'month' }, '2028-02-20').summary
  assert.equal(sparse.incomeShare, null)
  assert.equal(sparse.annualEstimate, null)
  assert.equal(sparse.variation, null)
  const complete = analyzeMicroExpenses([expense('jan', { date: '2028-01-05', classification: 'necesario' }), expense('feb', { classification: 'prescindible', amount: 7_000 })], new Set(), { month: '2028-02', range: 'year' }, '2028-03-01').summary
  assert.equal(complete.monthlyEstimate, 6_000)
  assert.equal(complete.annualEstimate, 72_000)
  const empty = analyzeMicroExpenses([], new Set(), { month: '2028-02', range: 'month' }, '2028-02-29').summary
  assert.equal(empty.expenseShare, null)
  assert.equal(empty.average, null)
})

test('simula gastos por patrón y movimiento, con prioridad del porcentaje individual y sin duplicados', () => {
  const manual = expense('manual', { amount: 4_000, classification: 'prescindible' })
  const other = expense('other', { classification: 'excluido', amount: 1_000 })
  const analysis = analyzeMicroExpenses([manual, other], new Set(), { month: '2028-02', range: 'month' }, '2028-03-01')
  const id = patternId(manual)
  const scenario = simulateSavings(analysis, {
    ...emptySavingsScenario, patternIds: [id], includeDiscretionary: true, movementIds: ['manual', 'other', 'other'], patternReductions: { [id]: 50 },
  })
  assert.deepEqual(scenario, { selectedCount: 2, baseMonthly: 5_000, monthly: 2_250, quarterly: 6_750, halfYear: 13_500, annual: 27_000, reducedMonthly: 2_750 })
  assert.equal(analysis.summary.amount, 4_000)
  assert.equal(other.classification, 'excluido')
})
