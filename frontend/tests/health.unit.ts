import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FinancialRecords, Movement } from '../src/features/dashboard/model.ts'
import type { FinancialCommitment } from '../src/features/commitments/commitment-model.ts'
import { createHealthCalculator, healthMethodology, healthWindows, interpretHealth } from '../src/features/health/health-assessment.ts'
import { createMockHealthRepository, loadHealth } from '../src/features/health/health-data.ts'
import { defaultDetection } from '../src/features/micro-expenses/micro-expense-detection.ts'
import { recommendHealth } from '../src/features/health/health-recommendations.ts'
import type { FinancialHealthAssessment } from '../src/features/health/health-model.ts'

const date = '2028-02-24'
const range = { from: '2028-02-01', to: date }
const empty: FinancialRecords = {
  accounts: [{ id: 'a', name: 'Cuenta', type: 'vista', icon: 'vista', color: '#818CF8', initialBalance: 1_000, description: '', openedOn: '2027-12-01', createdAt: '2027-12-01T12:00:00Z', currency: 'CLP', status: 'activa' }],
  movements: [], budgets: [], commitments: [], adjustments: [], savingsGoals: [], reservations: [], usedAccountIds: new Set(),
}
const expense = (id: string, categoryId: string, amount: number, classification: 'necesario' | 'prescindible' | 'automatica'): Movement => ({ id, type: 'gasto', categoryId, amount, classification, accountId: 'a', date, description: 'Compra' })
const payment = (id: string, dueDate: string, amount = 20): FinancialCommitment => ({ id, type: 'pago', name: id, status: 'pendiente', userId: 'u', currency: 'CLP', createdAt: '2028-02-02T12:00:00Z', dueDate, accountId: 'a', categoryId: 'food', amount, notes: '' })
const confirmation = (id: string, dueDate: string, effectiveDate: string, confirmedAt = `${date}T12:00:00Z`): FinancialCommitment =>
  ({ ...payment(id, dueDate), status: 'confirmado', effectiveDate, confirmedAt, movementId: id })
const records: FinancialRecords = {
  ...empty,
  movements: [{ id: 'salary', type: 'ingreso', categoryId: 'salary', accountId: 'a', date, amount: 1_000, description: 'Ingreso' },
    expense('food', 'food', 500, 'necesario'), expense('leisure', 'leisure', 300, 'prescindible')],
  budgets: [{ id: 'bf', categoryId: 'food', period: '2028-02', limit: 250, warningThreshold: 80, description: '' },
    { id: 'bl', categoryId: 'leisure', period: '2028-02', limit: 250, warningThreshold: 80, description: '' }],
  reservations: [{ id: 'reserve', goalId: 'goal', accountId: 'a', type: 'aporte', amount: 500, date, description: '', recordedAt: `${date}T12:00:00Z` }],
  commitments: [
    payment('overdue', '2028-02-20'), payment('upcoming', '2028-02-25', 750), { ...payment('receipt', '2028-02-27', 200), type: 'cobro' },
    confirmation('early', '2028-02-22', '2028-02-21'), confirmation('due-today', date, date), confirmation('late', '2028-02-23', date),
    { ...payment('cancelled', '2028-02-22'), status: 'cancelado', cancelledOn: date, cancelledAt: `${date}T12:00:00Z` },
  ],
}
const scores = (assessment: FinancialHealthAssessment) => Object.fromEntries(assessment.pillars.map(item => [item.id, item.score]))

test('calcula las cinco fórmulas, redondea solo el total y aplica la reserva una vez', () => {
  const report = createHealthCalculator(records, date).evaluate(range)
  assert.equal(Object.values(healthMethodology.weights).reduce((total, value) => total + value, 0), 100)
  assert.deepEqual(scores(report), { savings: 100, budget: 40, balance: 28 / 30 * 100, micro: 0, payments: 50 })
  assert.equal(report.score, 64)
  assert.equal(report.status, 'Favorable')
  assert.equal(report.quality.state, 'provisional')
  assert.equal(report.indicators.free, 700)
  assert.equal(report.indicators.cashFlow?.minimum, -70)
  assert.equal(report.indicators.conservative?.safe, 1)
  assert.equal(report.indicators.payments.overdue, 1)
  assert.equal(report.indicators.discretionaryShare, 0.375)
  const beforeFutureDue = createHealthCalculator({
    ...empty, commitments: [confirmation('paid-before-future-due', '2028-02-26', date), payment('still-pending', '2028-02-26')],
  }, date).evaluate(range)
  assert.deepEqual(beforeFutureDue.indicators.payments, { timely: 1, late: 0, overdue: 0, unknown: false })
})

test('omite cocientes sin denominador, marcas ausentes, períodos sin historial y ponderaciones incompletas', () => {
  const absent = createHealthCalculator({ ...empty, accounts: [] }, date).evaluate(range)
  assert.equal(absent.quality.state, 'insufficient')
  assert.equal(absent.quality.coverage, 0)
  const onlyExpense = createHealthCalculator({ ...empty, movements: [expense('some', 'food', 100, 'automatica')] }, date).evaluate(range)
  assert.deepEqual(scores(onlyExpense), { savings: null, budget: null, balance: 100, micro: null, payments: null })
  assert.equal(onlyExpense.score, null)
  assert.equal(onlyExpense.quality.coverage, 20)
  const reviewed = createHealthCalculator({ ...empty, movements: [expense('needed', 'food', 100, 'necesario')] }, date).evaluate(range)
  assert.equal(scores(reviewed).micro, 100)
  const never = createHealthCalculator(empty, date).evaluate({ from: '2027-11-01', to: '2027-11-30' })
  assert.equal(never.quality.observed, false)
  assert.equal(never.score, null)
})

test('pondera límites, distingue baja cobertura y acota un ahorro negativo', () => {
  const source = { ...records, movements: [records.movements[0], expense('relevant', 'food', 100, 'necesario'), expense('other', 'other', 2_000, 'automatica')] }
  const report = createHealthCalculator(source, date).evaluate(range)
  assert.equal(scores(report).savings, 0)
  assert.equal(scores(report).budget, 100)
  assert.equal(report.pillars.find(item => item.id === 'budget')?.state, 'provisional')
  assert.equal(report.indicators.unbudgetedSpend, 2_000)
  assert.deepEqual(report.indicators.unbudgetedCategories, ['other'])
})

test('usa cortes locales, excluye futuros y no compara fechas truncadas ni vencimientos indeterminados', () => {
  const today = '2028-03-31'
  const windows = healthWindows('month', today)
  assert.equal(windows.comparable, false)
  assert.equal(windows.previous?.to, '2028-02-29')
  assert.deepEqual(healthWindows('quarter', '2028-03-15').previous, { from: '2027-10-01', to: '2027-12-15' })
  const source: FinancialRecords = { ...empty, commitments: [
    confirmation('registered-after', '2028-02-14', '2028-02-14', '2028-03-01T12:00:00Z'),
    { ...confirmation('future-created', '2028-02-15', '2028-02-15'), createdAt: '2028-03-01T12:00:00Z' },
    payment('due-at-close', '2028-02-29'),
  ], movements: [{ ...expense('late-movement', 'food', 20, 'necesario'), commitmentId: 'registered-after' }],
  reservations: [{ ...records.reservations[0], recordedAt: '2028-03-01T12:00:00Z' }] }
  const closedRange = { from: '2028-02-01', to: '2028-02-29' }
  const assessed = createHealthCalculator(source, today).evaluate(closedRange)
  assert.equal(assessed.indicators.payments.overdue, 2)
  assert.equal(assessed.indicators.payments.timely, 0)
  assert.equal(assessed.indicators.overdue, 2)
  assert.equal(assessed.indicators.expense, 0)
  assert.equal(assessed.indicators.reserved, 0)
  assert.equal(assessed.indicators.free, 1_000)
  assert.equal(assessed.quality.reconstructed, true)
  source.commitments.push({ ...payment('edited', '2028-03-25'), originalDueDate: '2028-02-12' })
  const calculator = createHealthCalculator(source, today)
  assert.equal(scores(calculator.evaluate(closedRange)).payments, null)
  assert.equal(calculator.history('month', calculator.evaluate(windows.range)).difference, null)
})

test('simula con la misma evaluación, mantiene los vencimientos reales y prioriza compromisos', () => {
  const calculator = createHealthCalculator(records, date)
  const base = calculator.evaluate(range)
  const params = { income: 1_000, expense: 800, free: 700, categoryId: '', categoryAmount: null, reduction: 0, omittedPayments: [] }
  const same = calculator.simulate(base, params)
  assert.equal(same.difference, 0)
  assert.deepEqual(same.affected, [])
  const adjusted = calculator.simulate(base, { ...params, reduction: 100, omittedPayments: ['upcoming'] })
  assert.equal(adjusted.potentialSaving, 300)
  assert.equal(adjusted.scenario.indicators.expense, 500)
  assert.equal(scores(adjusted.scenario).micro, 100)
  assert.equal(scores(adjusted.scenario).balance, 100)
  assert.equal(scores(adjusted.scenario).payments, 50)
  assert.equal(calculator.evaluate(range).score, 64)
  assert.equal(recommendHealth(base)[0].id, 'accounts')
  assert.ok(!recommendHealth(base).some(item => item.id === 'savings'))
})

test('clasifica límites interpretativos y entrega estados explícitos del repositorio', () => {
  assert.deepEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(interpretHealth), [
    'Atención prioritaria', 'Atención prioritaria', 'Requiere atención', 'Requiere atención', 'En desarrollo', 'En desarrollo',
    'Favorable', 'Favorable', 'Muy favorable', 'Muy favorable',
  ])
  const repository = createMockHealthRepository(records, date, defaultDetection, 'America/Santiago')
  assert.equal(loadHealth(repository, 'month', 'loading').status, 'loading')
  assert.equal(loadHealth(repository, 'month', 'ready').status, 'ready')
  assert.deepEqual(loadHealth({ ...repository, assessment() { throw new Error('provider failure') } }, 'month', 'ready'), { status: 'error' })
})
