import type { Account, Category, Commitment, MicroExpenseCriteria, Movement } from './model'
import { accountEffect } from '@/features/accounts/account-balances'
import { DEFAULT_WARNING_THRESHOLD, parseBudgetPeriod } from '@/features/budgets/budget-calculations'

export const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Santiago' }).format(new Date())
const todayUtc = new Date(`${today}T12:00:00Z`)

export const shiftDays = (date: string, days: number) => {
  const instant = new Date(`${date}T12:00:00Z`)
  instant.setUTCDate(instant.getUTCDate() + days)
  return instant.toISOString().slice(0, 10)
}

export const monthAt = (offset: number) => new Date(Date.UTC(
  todayUtc.getUTCFullYear(), todayUtc.getUTCMonth() + offset, 1,
)).toISOString().slice(0, 7)

export const user = { name: 'Camila Rojas', initials: 'CR' }

const accountSamples = [
  { id: 'corriente', name: 'Cuenta corriente', description: 'Cuenta principal', type: 'corriente', color: '#10B981', balance: 1_725_600, openedOn: `${monthAt(-24)}-01` },
  { id: 'vista', name: 'Cuenta vista', description: 'Gastos cotidianos', type: 'vista', color: '#60A5FA', balance: 460_000, openedOn: `${monthAt(-18)}-01` },
  { id: 'ahorro', name: 'Cuenta de ahorro', description: 'Ahorro personal', type: 'ahorro', color: '#818CF8', balance: 300_000, openedOn: `${monthAt(-16)}-01` },
] as const

export const expenseCategories: Category[] = [
  { id: 'alimentacion', name: 'Alimentación', color: '#10B981' },
  { id: 'transporte', name: 'Transporte', color: '#60A5FA' },
  { id: 'vivienda', name: 'Vivienda', color: '#818CF8' },
  { id: 'salud', name: 'Salud', color: '#2DD4BF' },
  { id: 'entretenimiento', name: 'Entretenimiento', color: '#F59E0B' },
  { id: 'otros', name: 'Otros', color: '#64748B' },
]

export const incomeCategories = [
  { id: 'sueldo', name: 'Sueldo' },
  { id: 'freelance', name: 'Trabajo independiente' },
  { id: 'otros-ingresos', name: 'Otros ingresos' },
]

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
  { id: 'internet', accountId: 'vista', type: 'pago', description: 'Internet hogar', daysUntil: 5, amount: 29_990 },
  { id: 'freelance', accountId: 'corriente', type: 'cobro', description: 'Proyecto freelance', daysUntil: 7, amount: 620_000 },
  { id: 'tarjeta', accountId: 'corriente', type: 'pago', description: 'Cuota tarjeta de crédito', daysUntil: 10, amount: 215_000 },
  { id: 'cuentas', accountId: 'vista', type: 'pago', description: 'Servicios del hogar', daysUntil: 13, amount: 65_010 },
] as const

export const commitments: Commitment[] = upcoming.map(item => ({ ...item, date: shiftDays(today, item.daysUntil) }))

export const smallExpenseCriteria: MicroExpenseCriteria = { maximumAmount: 3_000, minimumCount: 3 }

const smallExpenseSamples: Record<string, number[]> = {
  alimentacion: [2900, 2500, 2400, 1800, 2750, 2200, 2600, 2350],
  transporte: [1800, 1850, 2250, 2550, 2600, 2250],
  entretenimiento: [2500, 2150, 2850, 2200],
}

const expenseNames = ['Compras del supermercado', 'Transporte del mes', 'Arriendo del departamento', 'Farmacia y consultas', 'Salidas y suscripciones', 'Compras para el hogar']
const smallExpenseNames: Record<string, string[]> = {
  alimentacion: ['Café de la mañana', 'Panadería del barrio', 'Colación', 'Jugo en el kiosco'],
  transporte: ['Viaje en metro', 'Recarga de transporte', 'Bus al trabajo'],
  entretenimiento: ['Juego para el móvil', 'Película en línea', 'Compra en aplicación'],
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
    const samples = current ? (smallExpenseSamples[category.id] ?? []) : []
    const remainder = expenses[index] - samples.reduce((sum, amount) => sum + amount, 0)
    const necessary = current && category.id === 'salud' ? 2_700 : 0
    records.push({ id: `${month}-${category.id}`, type: 'gasto', accountId: index === 2 || index === 5 ? 'corriente' : accountId, categoryId: category.id, amount: remainder - necessary, date: seedDate(month, [8, 12, 3, 15, 19, 21][index]), description: expenseNames[index], classification: 'automatica' })
    if (necessary) records.push({ id: `${month}-medicamento`, type: 'gasto', accountId, categoryId: category.id, amount: necessary, date: today, description: 'Medicamento de uso diario', classification: 'necesario' })
    samples.forEach((amount, item) => {
      const names = smallExpenseNames[category.id]
      records.push({ id: `${month}-${category.id}-${item}`, type: 'gasto', accountId, categoryId: category.id, amount, date: seedDate(month, 5 + item * 2 + index), description: names[item % names.length], classification: item === 1 && category.id === 'entretenimiento' ? 'prescindible' : 'automatica' })
    })
  })
  if (current) records.push({ id: `${month}-traspaso`, type: 'transferencia', accountId: 'corriente', destinationId: 'ahorro', amount: 120_000, date: today, description: 'Traspaso a ahorros' })
  return records
}).reverse()

export const accounts: Account[] = accountSamples.map(({ balance, ...sample }) => ({
  ...sample, currency: 'CLP', status: 'activa', icon: sample.type, createdAt: `${sample.openedOn}T12:00:00Z`,
  initialBalance: balance - seedMovements.reduce((sum, item) => sum + accountEffect(item, sample.id), 0),
}))

export const healthPreview = {
  score: 82,
  label: 'Saludable',
  description: 'Tus ingresos cubrieron tus gastos. Reducir los gastos hormiga puede mejorar tu capacidad de ahorro.',
  month: monthAt(-1),
}

export const goals = [
  { id: 'emergency', accountId: 'ahorro', name: 'Fondo de emergencia', saved: 220_000, target: 900_000 },
  { id: 'trip', accountId: 'ahorro', name: 'Vacaciones', saved: 80_000, target: 500_000 },
]

export function reservedForAccount(id: string) {
  return goals.reduce((sum, goal) => goal.accountId === id ? sum + goal.saved : sum, 0)
}

export const alerts = [
  { id: 'payment', title: 'Pago de Internet hogar', detail: 'Vence en 5 días.', section: 'compromisos' },
] as const
