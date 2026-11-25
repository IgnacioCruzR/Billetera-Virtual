import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calendarDays, deficitPeriods, findRisks, pendingItems, projectCashFlow, scenarioItems, summarizeCommitments, visualStatus } from '../src/features/commitments/cash-flow.ts'
import { cancelCommitment, confirmCommitment, validateCommitment } from '../src/features/commitments/commitment-records.ts'
import type { FinancialCommitment, CommitmentType } from '../src/features/commitments/commitment-model.ts'
import type { FinancialRecords } from '../src/features/dashboard/model.ts'
import { dateInZone, isIsoDate, shiftDays } from '../src/lib/calendar.ts'

const today = '2028-02-25'
const pending = (id: string, type: CommitmentType, amount: number, dueDate: string): FinancialCommitment => ({
  id, type, amount, dueDate, name: id, userId: 'owner', currency: 'CLP', status: 'pendiente', createdAt: '2028-02-01T12:00:00Z', accountId: 'account',
  categoryId: type === 'cobro' ? 'income' : 'expense', notes: '',
})

const records = (commitments: FinancialCommitment[]): FinancialRecords => ({
  accounts: [{ id: 'account', name: 'Cuenta', type: 'vista', icon: 'vista', status: 'activa', currency: 'CLP', initialBalance: 100, openedOn: '2028-02-01', createdAt: '2028-02-01T12:00:00Z', description: '', color: '#10B981' }],
  commitments, usedAccountIds: new Set(), movements: [], adjustments: [], budgets: [], savingsGoals: [], reservations: [],
})

test('deriva el vencimiento al cambiar de día en la zona del usuario y conserva el calendario bisiesto', () => {
  const due = pending('pago', 'pago', 100, '2028-02-29')
  const before = dateInZone(new Date('2028-03-01T02:59:59Z'), 'America/Santiago')
  const after = dateInZone(new Date('2028-03-01T03:00:00Z'), 'America/Santiago')
  assert.equal(before, '2028-02-29')
  assert.equal(after, '2028-03-01')
  assert.equal(visualStatus(due, before), 'por-vencer')
  assert.equal(visualStatus(due, after), 'vencido')
  assert.equal(shiftDays('2028-02-28', 2), '2028-03-01')
  assert.equal(isIsoDate('2027-02-29'), false)
  assert.equal(calendarDays('2028-02', 29).filter(Boolean).length, 29)
})

test('incluye vencidos hoy y el último día del horizonte, detecta déficit temporal y conserva la fecha original', () => {
  const overdue = pending('vencido', 'pago', 100, '2028-02-22')
  const payments = [pending('pago 1', 'pago', 60, '2028-02-26'), pending('pago 2', 'pago', 25, '2028-02-26')]
  const receipt = pending('cobro', 'cobro', 500, '2028-03-03')
  const later = pending('después', 'pago', 1_000, '2028-03-04')
  const cancelled = cancelCommitment(records([overdue]), overdue.id, today, `${today}T12:00:00Z`).commitments[0]
  const confirmed = confirmCommitment(records([receipt]), receipt.id, { effectiveDate: today }, today, `${today}T12:00:00Z`, () => 'move').commitments[0]
  const open = pendingItems([{ ...cancelled, id: 'cancelado' }, { ...confirmed, id: 'confirmado' }, receipt, later, overdue, ...payments])
  const projection = projectCashFlow(open, 100, today, 7, 50)
  assert.equal(projection.points.length, 8)
  assert.equal(projection.endDate, '2028-03-03')
  assert.deepEqual(projection.points.slice(0, 2).map(point => point.balance), [0, -85])
  assert.equal(projection.points[0].items[0].dueDate, '2028-02-22')
  assert.equal(projection.finalBalance, 415)
  assert.equal(projection.minimumBalance, -85)
  assert.equal(projection.minimumDate, '2028-02-26')
  assert.equal(projection.firstDeficit, '2028-02-26')
  assert.deepEqual(deficitPeriods(projection), [{ from: '2028-02-26', to: '2028-03-02' }])
  assert.equal(projection.margin, 365)
  const summary = summarizeCommitments(open, projection, today)
  assert.deepEqual([summary.receipts, summary.payments, summary.pendingCount, summary.overdueCount], [500, 185, 5, 1])
  assert.deepEqual(findRisks(projection, today).map(risk => risk.id), ['due', 'overdue', 'before-receipts', 'deficit', 'depleted', 'concentration', 'reserve'])
})

test('mantiene la simulación aislada al reprogramar, excluir cobros y agregar pagos', () => {
  const receipt = pending('cobro', 'cobro', 400, '2028-02-27')
  const payment = pending('pago', 'pago', 200, '2028-02-29')
  const baseItems = [receipt, payment]
  const simulated = scenarioItems(baseItems, {
    changes: { cobro: { dueDate: '2028-02-27', amount: 400, excluded: true }, pago: { dueDate: today, amount: 90, excluded: true } },
    hypothetical: [{ id: 'hypothetical', type: 'pago', amount: 50, dueDate: today, name: 'Hipotético', hypothetical: true }],
    reserve: 75,
  })
  assert.deepEqual(baseItems, [receipt, payment])
  assert.equal(simulated.length, 2)
  assert.equal(projectCashFlow(baseItems, 100, today, 7, null).finalBalance, 300)
  const scenario = projectCashFlow(simulated, 100, today, 7, 75)
  assert.equal(scenario.firstDeficit, today)
  assert.equal(scenario.finalBalance, -40)
  assert.equal(scenario.margin, -115)
})

test('confirma de forma idempotente y conserva ambos vínculos con el movimiento efectivo', () => {
  const payment = pending('pago', 'pago', 200, '2028-02-29')
  const source = records([payment])
  assert.deepEqual(validateCommitment(payment, source.accounts, ['expense'], today, 999_999_999_999), {})
  assert.ok(validateCommitment({ ...payment, amount: 1.25, dueDate: '2028-01-30' }, source.accounts, ['expense'], today, 999_999_999_999).dueDate)
  assert.ok(validateCommitment({ ...payment, dueDate: '2028-02-24' }, source.accounts, ['expense'], today, 999_999_999_999, payment).dueDate)
  assert.throws(() => confirmCommitment(source, payment.id, { effectiveDate: '2028-02-26' }, today, '', () => 'move'), /hoy o anterior/)
  const confirm = (current: FinancialRecords, effectiveDate: string) => confirmCommitment(current, payment.id, { effectiveDate }, today, `${today}T12:00:00Z`, () => 'move')
  const result = confirm(source, today)
  assert.equal(source.movements.length, 0)
  assert.deepEqual(result.movements, [{ id: 'move', type: 'gasto', commitmentId: 'pago', amount: 200, date: today, accountId: 'account', categoryId: 'expense', description: 'pago', classification: 'automatica' }])
  assert.deepEqual(result.commitments[0], { ...payment, status: 'confirmado', movementId: 'move', effectiveDate: today, confirmedAt: `${today}T12:00:00Z` })
  assert.equal(confirm(result, today), result)
  assert.throws(() => confirm(result, '2028-02-24'), /otra fecha efectiva/)
  assert.throws(() => cancelCommitment(result, payment.id, today, ''), /confirmado/)
  const cancelled = cancelCommitment(source, payment.id, today, `${today}T12:00:00Z`)
  assert.equal(cancelled.movements.length, 0)
  assert.throws(() => confirm(cancelled, today), /cancelado/)
})
