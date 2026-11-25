import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Account, FinancialRecords, Movement } from '../src/features/dashboard/model.ts'
import { confirmCommitment } from '../src/features/commitments/commitment-records.ts'
import { accountReservation, goalHistory, summarizeSavings, worsensReservation } from '../src/features/savings/savings-ledger.ts'
import type { SavingsGoalFormData } from '../src/features/savings/savings-model.ts'
import { habitualContribution, historicalProgress, monthlyActivity, projectSavings, scheduledContribution } from '../src/features/savings/savings-planning.ts'
import { changeGoalStatus, recordReservation, saveSavingsGoal } from '../src/features/savings/savings-records.ts'

function account(id: string, balance: number): Account {
  return { id, name: id, type: 'vista', icon: 'vista', openedOn: '2028-01-01', createdAt: '2028-01-01T12:00:00Z', currency: 'CLP', status: 'activa', description: '', color: '#818CF8', initialBalance: balance }
}
const blank: FinancialRecords = {
  accounts: [account('primary', 200), account('secondary', 100)], budgets: [], movements: [], commitments: [], reservations: [], adjustments: [], savingsGoals: [], usedAccountIds: new Set(),
}
const form: SavingsGoalFormData = { name: 'Meta', target: 250, targetDate: '', monthlyPlan: null, description: '', icon: 'personal', template: 'personal', color: '#818CF8' }
const start = '2028-01-31'
const today = '2028-03-15'
let sequence = 0
const context = (date: string) => ({ today: date, now: `${date}T12:00:00Z`, id: () => `id-${sequence++}` })
function reserve(records: FinancialRecords, goalId: string, accountId: string, amount: number, type: 'aporte' | 'liberacion', date = today, asOf = today) {
  return recordReservation(records, type, { goalId, accountId, amount, date, description: '' }, context(asOf))
}
const expense = (amount: number, date = today): Movement => ({ id: 'expense', type: 'gasto', classification: 'automatica', amount, accountId: 'primary', categoryId: 'food', date, description: '' })

test('crea con aporte atómico, evita doble reserva y protege el dinero reservado ante gastos y pagos efectivos', () => {
  assert.throws(() => saveSavingsGoal(blank, form, context(start), 'user', undefined, { accountId: 'primary', amount: 201 }), /dinero libre/)
  assert.equal(blank.savingsGoals.length, 0)
  let state = saveSavingsGoal(blank, form, context(start), 'user', undefined, { accountId: 'primary', amount: 170 })
  const goal = state.savingsGoals[0]
  state = saveSavingsGoal(state, { ...form, name: 'Otra meta' }, context(start), 'user')
  assert.throws(() => reserve(state, state.savingsGoals[0].id, 'primary', 31, 'aporte'), /dinero libre/)
  assert.deepEqual(accountReservation(state.accounts[0], state, today), { balance: 200, reserved: 170, free: 30 })
  assert.equal(worsensReservation(state, { ...state, movements: [expense(30)] }, today, today), false)
  assert.equal(worsensReservation(state, { ...state, movements: [expense(31)] }, today, today), true)
  assert.throws(() => saveSavingsGoal(state, { ...form, target: 169 }, context(today), 'user', goal.id), /Libera primero/)
  const withCommitment: FinancialRecords = { ...state, commitments: [{
    id: 'payment', userId: 'user', currency: 'CLP', type: 'pago', status: 'pendiente', amount: 31, accountId: 'primary', dueDate: today, createdAt: `${start}T12:00:00Z`, name: 'Pago', notes: '', categoryId: 'food',
  }] }
  assert.throws(() => confirmCommitment(withCommitment, 'payment', { effectiveDate: today }, today, '', () => 'movement'), /dinero reservado/)
  assert.equal(summarizeSavings(state, today).registered, 300)
  assert.equal(summarizeSavings(state, today).financialSurplus, 0)
})

test('pausa con reservas, libera por cuenta, reabre una alcanzada y cierra sin movimientos nuevos', () => {
  let state = saveSavingsGoal(blank, form, context(start), 'user', undefined, { accountId: 'primary', amount: 170 })
  const id = state.savingsGoals[0].id
  state = changeGoalStatus(state, id, 'pausar', context(today))
  assert.throws(() => reserve(state, id, 'secondary', 80, 'aporte'), /en progreso/)
  assert.equal(summarizeSavings(state, today).progress, null)
  assert.equal(summarizeSavings(state, today).reserved, 170)
  state = changeGoalStatus(state, id, 'reactivar', context(today))
  state = reserve(state, id, 'secondary', 80, 'aporte')
  assert.equal(state.savingsGoals[0].status, 'alcanzada')
  assert.throws(() => reserve(state, id, 'secondary', 81, 'liberacion'), /reserva liberable/)
  state = reserve(state, id, 'secondary', 5, 'liberacion')
  assert.equal(state.savingsGoals[0].status, 'en-progreso')
  assert.equal(state.savingsGoals[0].reachedOn, undefined)
  state = reserve(state, id, 'secondary', 5, 'aporte')
  const closed = changeGoalStatus(state, id, 'finalizar', context(today))
  assert.equal(closed.savingsGoals[0].status, 'finalizada')
  assert.equal(closed.reservations.length, state.reservations.length + 2)
  assert.equal(closed.movements.length, 0)
  assert.equal(summarizeSavings(closed, today).free, 300)
  assert.equal(summarizeSavings(closed, today).reachedCount, 1)
  assert.equal(changeGoalStatus(closed, id, 'finalizar', context(today)), closed)
  assert.equal(monthlyActivity(closed.reservations, today).at(-1)?.releases, 255)
  assert.equal(historicalProgress(goalHistory(closed.savingsGoals[0], closed, today), today).at(-1)?.reserved, 0)
})

test('respeta el saldo y las reservas posteriores al retrofechar y conserva el historial de cancelación', () => {
  let state = saveSavingsGoal(blank, form, context(start), 'user')
  const id = state.savingsGoals[0].id
  state = { ...state, movements: [expense(150, '2028-02-10')] }
  assert.throws(() => reserve(state, id, 'primary', 80, 'aporte', '2028-02-05'), /dinero libre/)
  state = reserve(state, id, 'primary', 50, 'aporte', '2028-02-05')
  state = reserve(state, id, 'primary', 30, 'liberacion', '2028-03-05')
  assert.throws(() => reserve(state, id, 'primary', 25, 'liberacion', '2028-02-15'), /reserva liberable/)
  const closed = changeGoalStatus(state, id, 'cancelar', context(today))
  assert.equal(closed.reservations.length, 3)
  assert.equal(closed.reservations.at(-1)?.amount, 20)
  assert.equal(summarizeSavings(closed, today).reserved, 0)
  assert.deepEqual(closed.movements, state.movements)
})

test('calendario mensual bisiesto, plazos cortos, metas cumplidas y aportes no disponibles', () => {
  assert.equal(scheduledContribution('2028-01-31', 1), '2028-02-29')
  assert.equal(scheduledContribution('2028-01-31', 2), '2028-03-31')
  assert.deepEqual(projectSavings(1_000, 300, 200, '2028-01-31', '2028-03-31'), {
    remaining: 700, months: 4, estimatedDate: '2028-05-31', requiredMonthly: 350, availableDeposits: 2,
  })
  assert.equal(projectSavings(1_000, 300, 200, '2028-01-31', '2028-02-28').availableDeposits, 0)
  assert.equal(projectSavings(1_000, 300, 0, '2028-01-31', '2028-01-15').estimatedDate, null)
  assert.equal(projectSavings(1_000, 1_000, 0, '2028-01-31').months, 0)
  const state = saveSavingsGoal(blank, form, context(start), 'user')
  const history = goalHistory(state.savingsGoals[0], state, today)
  assert.equal(habitualContribution(history, today).source, 'unknown')
})
