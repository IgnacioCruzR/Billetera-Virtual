import assert from 'node:assert/strict'
import { test } from 'node:test'
import { budgetAlert, budgetBounds, budgetHistory, budgetProjection, budgetStatus, conflictingBudgets, consumptionPoints, daysInBudgetPeriod, parseBudgetPeriod, shiftBudgetPeriod, summarizeBudgets, validateBudget } from '../src/features/budgets/budget-calculations.ts'
import type { Budget } from '../src/features/budgets/budget-model.ts'
import type { Movement } from '../src/features/dashboard/model.ts'

const budget: Budget = { id: 'food', categoryId: 'food', period: '2028-02', limit: 10_000, warningThreshold: 65, description: 'Plan de prueba' }
const expense = (id: string, date: string, amount: number, categoryId = 'food'): Extract<Movement, { type: 'gasto' }> => ({
  id, date, amount, categoryId, description: '', accountId: 'account', type: 'gasto', classification: 'automatica',
})

test('usa el calendario gregoriano y navega entre años sin períodos inválidos', () => {
  assert.equal(daysInBudgetPeriod('2028-02'), 29)
  assert.equal(daysInBudgetPeriod('2027-02'), 28)
  assert.equal(daysInBudgetPeriod('1900-02'), 28)
  assert.equal(daysInBudgetPeriod('2000-02'), 29)
  assert.equal(daysInBudgetPeriod('2026-04'), 30)
  assert.deepEqual(budgetBounds('2028-02'), { from: '2028-02-01', to: '2028-02-29' })
  assert.equal(shiftBudgetPeriod('2026-12', 1), '2027-01')
  assert.equal(shiftBudgetPeriod('2026-01', -1), '2025-12')
  assert.equal(shiftBudgetPeriod('0001-01', -1), null)
  assert.equal(parseBudgetPeriod('2028-13'), null)
})

test('distingue 80 %, 100 % exacto y sobrepresupuesto de la alerta configurable', () => {
  assert.equal(budgetStatus(7_999, 10_000), 'within')
  assert.equal(budgetStatus(8_000, 10_000), 'near')
  assert.equal(budgetStatus(9_999, 10_000), 'near')
  assert.equal(budgetStatus(10_000, 10_000), 'limit')
  assert.equal(budgetStatus(10_001, 10_000), 'exceeded')
  assert.equal(budgetAlert(6_499, budget), null)
  assert.equal(budgetAlert(6_500, budget), 'threshold')
  assert.equal(budgetAlert(10_000, budget), 'limit')
  assert.equal(budgetAlert(10_001, budget), 'exceeded')
})

test('calcula el riesgo y el margen diario con febrero bisiesto', () => {
  const projection = budgetProjection(budget, [expense('one', '2028-02-01', 2_000), expense('two', '2028-02-08', 2_000)], '2028-02-10')
  assert.equal(projection.elapsedDays, 10)
  assert.equal(projection.remainingDays, 19)
  assert.equal(projection.timePercentage, 10 / 29 * 100)
  assert.equal(projection.dailyAverage, 400)
  assert.equal(projection.projected, 11_600)
  assert.equal(projection.dailyMargin, 315)
  assert.equal(projection.risk, 'projected-excess')
  assert.equal(budgetStatus(4_000, budget.limit), 'within')
})

test('evita extrapolar sin observaciones, con un solo día, al cierre o en el futuro', () => {
  const lone = [expense('one', '2028-02-01', 9_000)]
  const sparse = budgetProjection(budget, lone, '2028-02-10')
  assert.equal(sparse.risk, 'ahead')
  assert.equal(sparse.projected, null)
  assert.equal(sparse.concentrated, true)
  assert.equal(budgetProjection(budget, [], '2028-02-10').risk, 'insufficient')
  const initial = [expense('one', '2028-02-01', 150), expense('two', '2028-02-02', 100)]
  assert.equal(budgetProjection(budget, initial, '2028-02-02').projected, null)
  const future = budgetProjection(budget, [], '2028-01-31')
  assert.deepEqual([future.elapsedDays, future.remainingDays, future.dailyAverage, future.projected], [0, 29, null, null])
  for (const date of ['2028-02-29', '2028-03-01']) {
    const end = budgetProjection(budget, lone, date)
    assert.equal(end.elapsedDays, 29)
    assert.equal(end.dailyMargin, null)
    assert.equal(end.projected, null)
  }
  assert.equal(budgetProjection(budget, [expense('over', '2028-02-01', 10_001)], '2028-02-10').dailyMargin, 0)
})

test('incluye solo gastos efectivos del mes y separa las categorías sin presupuesto', () => {
  const movements: Movement[] = [expense('one', '2028-02-03', 2_000), expense('two', '2028-02-10', 500, 'travel'),
    expense('later', '2028-02-19', 9_000), expense('old', '2028-01-31', 9_000),
    { id: 'income', date: '2028-02-10', amount: 700, description: '', accountId: 'account', type: 'ingreso', categoryId: 'income' },
    { id: 'transfer', date: '2028-02-10', amount: 700, description: '', accountId: 'account', type: 'transferencia', destinationId: 'other' },
  ]
  const { summary, items, expenses } = summarizeBudgets([budget], movements, budget.period, '2028-02-10')
  assert.deepEqual(summary, { limit: 10_000, spent: 2_000, remaining: 8_000, exceededCount: 0, unbudgetedSpent: 500,
    totalExpense: 2_500, unbudgeted: [{ categoryId: 'travel', spent: 500, share: 20 }] })
  const points = consumptionPoints(items[0], expenses.filter(item => item.categoryId === 'food'))
  assert.equal(points[3].actual, 2_000)
  assert.equal(points[11].actual, null)
  assert.equal(points[29].plan, 10_000)
  assert.equal(budgetHistory([budget], movements, '2028-02', '2028-01-31').at(-1)?.spent, null)
})

test('valida existencia de la categoría, enteros, período, duplicados y edición', () => {
  assert.deepEqual(validateBudget(budget, [budget], ['food'], '2028-02-10', budget), {})
  assert.ok(validateBudget(budget, [budget], ['food'], '2028-02-10').categoryId)
  const invalid = validateBudget({ ...budget, limit: 0.5, warningThreshold: 101, period: '2028-01' }, [], ['other'], '2028-02-10')
  assert.deepEqual(Object.keys(invalid).sort(), ['categoryId', 'limit', 'period', 'warningThreshold'])
  assert.ok(validateBudget({ ...budget, period: '2028-03' }, [budget], ['food'], '2028-02-10', budget).period)
  const destination: Budget = { ...budget, id: 'new', period: '2028-03' }
  assert.deepEqual(conflictingBudgets([budget, destination], [budget], '2028-03'), [budget])
})
