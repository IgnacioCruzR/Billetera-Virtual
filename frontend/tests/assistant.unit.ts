import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Account, FinancialRecords } from '../src/features/dashboard/model.ts'
import type { FinancialCommitment } from '../src/features/commitments/commitment-model.ts'
import type { SavingsGoal } from '../src/features/savings/savings-model.ts'
import { defaultDetection } from '../src/features/micro-expenses/micro-expense-detection.ts'
import { buildDemoAnalysis } from '../src/features/assistant/assistant-analysis.ts'
import { parseAction, resolveAction } from '../src/features/assistant/assistant-actions.ts'
import { analysisTypes, isAnalysisType, type AnalysisContext, type FinancialAnalysisRequest } from '../src/features/assistant/assistant-model.ts'
import { AnalysisFailure, createDemoAnalysisProvider, createRequestGate, requestAnalysis } from '../src/features/assistant/assistant-provider.ts'
import { initialDraft, matchesRequestResources, validateAnalysis } from '../src/features/assistant/assistant-request.ts'
import { normalizeAnalysis } from '../src/features/assistant/assistant-response.ts'
import { purchaseImpact } from '../src/features/assistant/purchase-impact.ts'

const date = '2028-02-24'
const stamp = date + 'T12:00:00Z'
const account = (id: string, initialBalance: number): Account => ({
  id, initialBalance, name: id, openedOn: '2027-12-01', createdAt: '2027-12-01T12:00:00Z', type: 'vista', color: '#818CF8', icon: 'vista', status: 'activa', description: '', currency: 'CLP',
})
const goal: SavingsGoal = {
  id: 'goal', name: 'Meta', description: '', userId: 'u', currency: 'CLP', status: 'en-progreso', createdAt: stamp, createdOn: date,
  target: 1200, targetDate: '2028-05-24', monthlyPlan: 150, template: 'personal', icon: 'personal', color: '#818CF8',
}
const pending = (id: string, dueDate: string, amount: number, type: FinancialCommitment['type']): FinancialCommitment => ({
  id, type, dueDate, amount, name: id, status: 'pendiente', accountId: 'a', categoryId: 'food', userId: 'u', currency: 'CLP', createdAt: stamp, notes: '',
})
const empty: FinancialRecords = {
  accounts: [], movements: [], adjustments: [], savingsGoals: [], reservations: [], commitments: [], budgets: [], usedAccountIds: new Set(),
}
const records: FinancialRecords = {
  ...empty,
  accounts: [account('a', 1200), account('b', 3000)],
  movements: [
    { id: 'expense', type: 'gasto', date, amount: 100, categoryId: 'food', accountId: 'a', classification: 'prescindible', description: 'Almuerzo' },
    { id: 'income', type: 'ingreso', date, amount: 500, categoryId: 'salary', accountId: 'b', description: 'Ingreso' },
  ],
  savingsGoals: [goal],
  reservations: [{ id: 'reserve', goalId: goal.id, accountId: 'a', type: 'aporte', amount: 200, date, recordedAt: stamp, description: '' }],
  budgets: [{ id: 'budget', period: '2028-02', categoryId: 'food', limit: 750, description: '', warningThreshold: 80 }],
  commitments: [pending('first', '2028-02-25', 400, 'pago'), pending('receipt', '2028-02-27', 900, 'cobro'), pending('last', '2028-02-28', 200, 'pago')],
}
const context: AnalysisContext = { records, today: date, timeZone: 'America/Santiago', criteria: defaultDetection,
  categories: [{ id: 'food', name: 'Alimentación' }], scenarios: [{ id: 's', name: 'Escenario', from: '2028-01-01', to: '2028-01-31', monthlyPotential: 250 }] }
const purchase: Extract<FinancialAnalysisRequest, { type: 'purchase' }> = {
  requestId: 'p', type: 'purchase', parameters: { name: 'Compra', amount: 550, categoryId: 'food', date: '2028-02-26', horizon: 7, minimumFree: 120, accountId: 'a' },
}

test('valida tipos, períodos, recursos, montos enteros y fechas según el análisis seleccionado', () => {
  assert.deepEqual(analysisTypes, ['situation', 'opportunities', 'purchase', 'budgets', 'health', 'savings'])
  assert.equal(isAnalysisType('__proto__'), false)
  assert.deepEqual(initialDraft('purchase', date), { date, minimumFree: '0', horizon: '30' })
  assert.equal(validateAnalysis('chat', {}, context, 'unknown').request, undefined)
  assert.equal(matchesRequestResources(purchase, context), true)
  const errors = validateAnalysis('purchase', { amount: '10.5', minimumFree: '-7', horizon: '7', date: '2028-03-05', accountId: 'foreign', categoryId: 'salary' }, context, 'p').errors
  assert.deepEqual(Object.keys(errors!).sort(), ['accountId', 'amount', 'categoryId', 'date', 'minimumFree'])
  assert.ok(validateAnalysis('budgets', { period: 'quarter' }, context, 'b').errors?.period)
  assert.ok(validateAnalysis('opportunities', { period: 'month', reduction: '101' }, context, 'o').errors?.reduction)
  assert.ok(validateAnalysis('savings', { goalId: 'goal', monthly: '1e3', scenarioId: 'unknown' }, context, 's').errors?.scenarioId)
  assert.equal(validateAnalysis('health', { period: 'half-year' }, context, 'h').request?.type, 'health')
})

test('proyecta por cuenta, excluye cobros conservadores, resta reservas y detecta un déficit antes de recuperarse', () => {
  const result = purchaseImpact(purchase.parameters, context)!
  assert.equal(result.accountBalance, 1100)
  assert.equal(result.reserved, 200)
  assert.equal(result.free, 900)
  assert.equal(result.expected.after, -50)
  assert.equal(result.expected.minimum, -50)
  assert.equal(result.expected.final, 650)
  assert.equal(result.expected.firstDeficit, '2028-02-26')
  assert.equal(result.conservative.minimum, -250)
  assert.equal(result.conservative.minimumMargin, -370)
  assert.ok(result.total.minimum > 0 && result.totalConservative.minimum > 0)
  assert.deepEqual(result.budget, { id: 'budget', limit: 750, used: 100, remainingBefore: 650, remainingAfter: 100 })
  assert.equal(purchaseImpact({ ...purchase.parameters, accountId: 'unknown' }, context), null)
  assert.equal(records.movements.length, 2)
  assert.equal(records.commitments.length, 3)
})

test('genera seis informes deterministas y representa fuentes e información insuficiente', () => {
  const requests: FinancialAnalysisRequest[] = [
    { requestId: 'f', type: 'situation', parameters: { period: 'month' } },
    { requestId: 'o', type: 'opportunities', parameters: { period: 'month', reduction: 60, categoryId: 'food' } },
    purchase, { requestId: 'b', type: 'budgets', parameters: { period: 'month' } },
    { requestId: 'h', type: 'health', parameters: { period: 'month' } },
    { requestId: 's', type: 'savings', parameters: { goalId: 'goal', scenarioId: 's' } },
  ]
  const reports = requests.map(request => normalizeAnalysis(buildDemoAnalysis(request, context, stamp), request, 'demo')!)
  assert.deepEqual(reports.map(item => item.status), Array(6).fill('available'))
  assert.equal(reports[0].metrics.find(item => item.id === 'income')?.value, 500)
  assert.equal(reports[1].metrics.find(item => item.id === 'discretionary')?.value, 100)
  assert.equal(reports[2].risks[0].priority, 'Alta')
  assert.ok(reports[3].metrics.some(item => item.id === 'spent'))
  assert.equal(reports[4].metrics.find(item => item.id === 'score')?.value, null)
  assert.equal(reports[5].metrics.find(item => item.id === 'additional')?.value, 250)
  assert.equal(buildDemoAnalysis(requests[0], { ...context, records: empty }, stamp).status, 'insufficient')
  assert.equal(buildDemoAnalysis(requests[4], { ...context, records: empty }, stamp).status, 'insufficient')
})

test('descarta referencias ajenas y transforma una respuesta parcial sin aceptar acciones ejecutables', () => {
  assert.equal(resolveAction({ kind: 'OPEN_ACCOUNTS', accountId: 'foreign' }, context), null)
  assert.equal(resolveAction({ kind: 'OPEN_TRANSACTIONS', from: '2028-02-12', to: '2028-03-02' }, context), null)
  assert.equal(resolveAction({ kind: 'OPEN_MICRO_EXPENSE_SIMULATOR', month: '2028-19' }, context), null)
  assert.equal(resolveAction({ kind: 'OPEN_BUDGET_DETAIL', budgetId: 'budget', href: 'https://invalid.test' }, context)?.href, '#presupuestos?presupuesto=budget&mes=2028-02')
  assert.equal(parseAction({ kind: 'REGISTER_EXPENSE', amount: 1000 }), undefined)
  assert.equal(parseAction({ kind: 'OPEN_SAVINGS_GOAL', goalId: null }), undefined)
  const base = buildDemoAnalysis(purchase, context, stamp)
  const mismatched = normalizeAnalysis({ ...base, requestId: 'unrelated' }, purchase, 'ai')
  assert.equal(mismatched, null)
  const damaged = normalizeAnalysis({ ...base, summary: null,
    metrics: [...base.metrics, { id: 'evil', label: 'Datos', source: 'verified', unit: 'clp', value: '<b>clp</b>' }],
    recommendations: [{ ...base.recommendations[0], action: { kind: 'REGISTER_EXPENSE' } }],
  }, purchase, 'ai')!
  assert.equal(damaged.status, 'incomplete')
  assert.equal(damaged.summary.text, '')
  assert.equal(damaged.recommendations[0].action, undefined)
  assert.equal(damaged.metrics.some(item => item.id === 'evil'), false)
})

test('controla duplicados, cancela la espera y conserva errores sin sustituir resultados', async () => {
  const gate = createRequestGate()
  const ticket = gate.start()!
  assert.equal(gate.start(), null)
  assert.equal(gate.cancel(), true)
  assert.equal(ticket.signal.aborted, true)
  assert.equal(gate.finish(ticket), false)
  assert.ok(gate.finish(gate.start()!))
  const signal = new AbortController().signal
  const succeeds = await requestAnalysis(createDemoAnalysisProvider(context, true, 0), purchase, signal)
  assert.equal(succeeds.origin, 'demo')
  await assert.rejects(requestAnalysis(createDemoAnalysisProvider(context, false, 0), purchase, signal), { code: 'communication' })
  await assert.rejects(requestAnalysis(createDemoAnalysisProvider(context, true, 200), purchase, signal, 2), { code: 'timeout' })
  await assert.rejects(requestAnalysis(createDemoAnalysisProvider(context, true, 0), purchase, ticket.signal), { code: 'cancelled' })
  await assert.rejects(requestAnalysis({ origin: 'ai', async generate() { throw new AnalysisFailure('mcp') } }, purchase, signal), { code: 'mcp' })
  await assert.rejects(requestAnalysis({ origin: 'ai', async generate() { return {} } }, purchase, signal), { code: 'invalid' })
})
