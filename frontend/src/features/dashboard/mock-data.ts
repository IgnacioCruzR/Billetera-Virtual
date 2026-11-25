import { seedCategories } from '@/features/categories/category-model'
import { defaultPreferences } from '@/features/settings/preferences-model'
import { demoProfile } from '@/features/settings/settings-data'
import type { Account, Movement } from './model'
import { accountEffect } from '@/features/accounts/account-balances'
import { DEFAULT_WARNING_THRESHOLD, parseBudgetPeriod } from '@/features/budgets/budget-calculations'
import { dateInZone, shiftDays } from '@/lib/calendar'
import type { FinancialCommitment } from '@/features/commitments/commitment-model'
import type { SavingsGoal, SavingsReservationOperation } from '@/features/savings/savings-model'

let financialTimeZone = defaultPreferences.regional.timeZone
export let today = dateInZone(new Date(), financialTimeZone)
export function refreshFinancialDate(timeZone = financialTimeZone) {
  financialTimeZone = timeZone
  today = dateInZone(new Date(), financialTimeZone)
  return today
}
export { shiftDays }

export function monthAt(offset: number) {
  const instant = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
  instant.setUTCMonth(instant.getUTCMonth() + offset)
  return instant.toISOString().slice(0, 7)
}

const accountSamples = [
  { id: 'corriente', name: 'Cuenta corriente', description: 'Cuenta principal', type: 'corriente', color: '#10B981', balance: 1_725_600, openedOn: `${monthAt(-24)}-01` },
  { id: 'vista', name: 'Cuenta vista', description: 'Gastos cotidianos', type: 'vista', color: '#60A5FA', balance: 460_000, openedOn: `${monthAt(-18)}-01` },
  { id: 'ahorro', name: 'Cuenta de ahorro', description: 'Ahorro personal', type: 'ahorro', color: '#818CF8', balance: 300_000, openedOn: `${monthAt(-16)}-01` },
] as const

const expenseCategories = seedCategories.filter(item => item.type === 'gasto')

const currentExpenseAmounts = [314_400, 147_000, 420_000, 118_000, 131_000, 104_000]
const pastExpenses = [1_402_727, 1_498_000, 1_589_000, 1_430_000, 1_474_000, 1_505_000]
const pastNet = [8_000, -4_200, 9_500, -6_000, 3_000, 5_000]

const months = Array.from({ length: 24 }, (_, index) => {
  const offset = index - 23
  const sample = (Math.abs(offset) + pastExpenses.length - 1) % pastExpenses.length
  const expense = offset === 0 ? 1_234_400 : pastExpenses[sample]
  const income = offset === 0 ? 1_850_000 : offset === -1 ? 1_680_000 : expense + pastNet[sample]
  const expenses = currentExpenseAmounts.map(amount => Math.round(amount * expense / 1_234_400))
  expenses[expenses.length - 1] += expense - expenses.reduce((total, amount) => total + amount, 0)
  return { month: monthAt(offset), income, expense, expenses }
})

const monthlyBudgets = [
  { categoryId: 'alimentacion', limit: 360_000 },
  { categoryId: 'transporte', limit: 200_000 },
  { categoryId: 'entretenimiento', limit: 120_000 },
  { categoryId: 'salud', limit: 160_000 },
]

export const seedBudgets = Array.from({ length: 6 }, (_, index) => {
  const offset = index - 5
  const period = parseBudgetPeriod(monthAt(offset))!
  return monthlyBudgets.map((budget, categoryIndex) => ({
    ...budget, period, id: `${period}-${budget.categoryId}`, warningThreshold: DEFAULT_WARNING_THRESHOLD, description: '',
    limit: offset === 0 ? budget.limit : budget.limit + 10_000 * ((index + categoryIndex * 2) % 4),
  }))
}).flat()

const upcoming = [
  { id: 'internet', accountId: 'vista', categoryId: 'vivienda', type: 'pago', name: 'Internet hogar', daysUntil: 5, amount: 29_990 },
  { id: 'freelance', accountId: 'corriente', categoryId: 'freelance', type: 'cobro', name: 'Proyecto freelance', daysUntil: 7, amount: 620_000 },
  { id: 'tarjeta', accountId: 'corriente', categoryId: 'otros', type: 'pago', name: 'Pago tarjeta de crédito', daysUntil: 10, amount: 215_000 },
  { id: 'cuentas', accountId: 'vista', categoryId: 'vivienda', type: 'pago', name: 'Servicios del hogar', daysUntil: 13, amount: 65_010 },
] as const

export const seedCommitments: FinancialCommitment[] = upcoming.map(({ daysUntil, ...item }) => ({
  ...item, dueDate: shiftDays(today, daysUntil), status: 'pendiente', notes: '', currency: 'CLP', userId: demoProfile.id,
  createdAt: `${today}T12:00:00Z`,
}))

const smallExpenseSamples: Record<string, number[]> = {
  alimentacion: [2900, 2500, 2400, 1800, 2750, 2200, 2600, 2350],
  transporte: [1800, 1850, 2250, 2550, 2600, 2250],
  entretenimiento: [2500, 2150, 2850, 2200],
}

const expenseNames = ['Compras del supermercado', 'Transporte del mes', 'Arriendo del departamento', 'Farmacia y consultas', 'Salidas y suscripciones', 'Compras para el hogar']
const smallExpenseNames: Record<string, string[]> = {
  alimentacion: ['Café de la mañana', 'Colación'],
  transporte: ['Viaje en metro', 'Recarga de transporte'],
  entretenimiento: ['Juego para el móvil'],
}

function seedDate(month: string, day: number) {
  const cap = month === monthAt(0) ? Number(today.slice(8)) : 28
  return `${month}-${String(Math.min(day, cap)).padStart(2, '0')}`
}

export const seedMovements: Movement[] = months.flatMap(({ month, income, expenses }) => {
  const current = month === monthAt(0)
  const accountId = current ? 'vista' : 'corriente'
  const salary = Math.round(income * 0.78)
  const records: Movement[] = [
    { id: `${month}-sueldo`, type: 'ingreso', accountId: 'corriente', categoryId: 'sueldo', amount: salary, date: seedDate(month, 1), description: 'Sueldo mensual' },
    { id: `${month}-proyecto`, type: 'ingreso', accountId: 'corriente', categoryId: 'freelance', amount: income - salary, date: seedDate(month, 17), description: 'Honorarios de proyecto' },
  ]
  expenseCategories.forEach((category, index) => {
    const factor = current ? 1 : 0.7 + (Number(month.slice(5, 7)) % 5) * 0.08
    const samples = (smallExpenseSamples[category.id] ?? []).map(amount => Math.round(amount * factor))
    const remainder = expenses[index] - samples.reduce((sum, amount) => sum + amount, 0)
    const necessary = current && category.id === 'salud' ? 2_700 : 0
    records.push({ id: `${month}-${category.id}`, type: 'gasto', accountId: index === 2 || index === 5 ? 'corriente' : accountId, categoryId: category.id, amount: remainder - necessary, date: seedDate(month, [8, 12, 3, 15, 19, 21][index]), description: expenseNames[index], classification: 'automatica' })
    if (necessary) records.push({ id: `${month}-medicamento`, type: 'gasto', accountId, categoryId: category.id, amount: necessary, date: today, description: 'Medicamento de uso diario', classification: 'necesario' })
    samples.forEach((amount, item) => {
      const names = smallExpenseNames[category.id]
      const discretionary = item === 1 && category.id === 'entretenimiento'
      records.push({ id: `${month}-${category.id}-${item}`, type: 'gasto', accountId, categoryId: category.id, amount, date: seedDate(month, 5 + item * 2 + index), description: discretionary ? 'Película en línea' : names[item % names.length], classification: discretionary ? 'prescindible' : 'automatica' })
    })
  })
  if (current) records.push({ id: `${month}-traspaso`, type: 'transferencia', accountId: 'corriente', destinationId: 'ahorro', amount: 120_000, date: today, description: 'Traspaso a ahorros' })
  return records
}).reverse()

export const accounts: Account[] = accountSamples.map(({ balance, ...sample }) => ({
  ...sample, currency: 'CLP', status: 'activa', icon: sample.type, createdAt: `${sample.openedOn}T12:00:00Z`,
  initialBalance: balance - seedMovements.reduce((sum, item) => sum + accountEffect(item, sample.id), 0),
}))

const goalsCreatedOn = `${monthAt(-3)}-01`
const seedGoal = { userId: demoProfile.id, currency: 'CLP', status: 'en-progreso', createdOn: goalsCreatedOn, createdAt: `${goalsCreatedOn}T12:00:00Z` } as const
export const seedSavingsGoals: SavingsGoal[] = [
  { ...seedGoal, id: 'emergency', name: 'Fondo de emergencia', target: 900_000, monthlyPlan: 80_000, targetDate: '', template: 'emergencia', icon: 'emergencia', color: '#818CF8', description: 'Reserva para gastos imprevistos.' },
  { ...seedGoal, id: 'trip', name: 'Vacaciones', target: 500_000, monthlyPlan: 60_000, targetDate: shiftDays(today, 210), template: 'viajes', icon: 'viajes', color: '#2DD4BF', description: 'Ahorro para el próximo viaje.' },
]
export const seedReservations: SavingsReservationOperation[] = [
  { goalId: 'emergency', date: `${monthAt(-2)}-05`, amount: 120_000 }, { goalId: 'trip', date: `${monthAt(-1)}-10`, amount: 60_000 },
  { goalId: 'emergency', date: today, amount: 100_000 }, { goalId: 'trip', date: today, amount: 20_000 },
].map((item, index) => ({
  ...item, id: `seed-reservation-${index}`, type: 'aporte', accountId: 'ahorro', description: 'Aporte de demostración', recordedAt: `${item.date}T12:00:00Z`,
}))
