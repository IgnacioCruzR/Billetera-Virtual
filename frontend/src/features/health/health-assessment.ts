import { budgetBounds, daysInBudgetPeriod, parseBudgetPeriod, shiftBudgetPeriod, summarizeBudgets } from '../budgets/budget-calculations.ts'
import type { BudgetPeriod } from '../budgets/budget-model.ts'
import { projectCashFlow } from '../commitments/cash-flow.ts'
import type { CashFlowItem, FinancialCommitment } from '../commitments/commitment-model.ts'
import { registeredBalance } from '../accounts/account-balances.ts'
import type { FinancialRecords } from '../dashboard/model.ts'
import { detectMicroExpenses, defaultDetection } from '../micro-expenses/micro-expense-detection.ts'
import type { MicroExpenseDetectionConfig } from '../micro-expenses/micro-expense-model.ts'
import { reservedAt, summarizeSavings } from '../savings/savings-ledger.ts'
import { accountsWithUpcomingShortfall } from '../savings/savings-planning.ts'
import { dateInZone, shiftDays } from '../../lib/calendar.ts'
import type { FinancialHealthAssessment, FinancialHealthHistory, FinancialHealthMethodology, FinancialHealthPeriod, FinancialHealthPillar, FinancialHealthScenario, FinancialHealthSimulationResult, FinancialHealthStatus, HealthBudget, HealthCashFlow, HealthPayments, HealthRange, PillarId } from './health-model.ts'

export const healthMethodology: FinancialHealthMethodology = {
  version: 'v2-demo',
  weights: { savings: 30, budget: 25, balance: 20, micro: 15, payments: 10 },
  savingsReference: 0.20, discretionaryReference: 0.15, budgetCoverageMinimum: 0.50, horizon: 30,
}
const pillarIds: PillarId[] = ['savings', 'budget', 'balance', 'micro', 'payments']
const clamp = (score: number) => Math.min(100, Math.max(0, score))
const ratio = (value: number, total: number) => total > 0 ? value / total : null
const inRange = (date: string, range: HealthRange) => date >= range.from && date <= range.to
const periodCounts: Record<FinancialHealthPeriod, number> = { month: 1, previous: 1, quarter: 3, 'half-year': 6, year: 12 }

export function interpretHealth(score: number): FinancialHealthStatus {
  if (score >= 80) return 'Muy favorable'
  if (score >= 60) return 'Favorable'
  if (score >= 40) return 'En desarrollo'
  if (score >= 20) return 'Requiere atención'
  return 'Atención prioritaria'
}

export function healthWindows(selection: FinancialHealthPeriod, today: string) {
  const current = parseBudgetPeriod(today.slice(0, 7))!
  const size = periodCounts[selection]
  const offset = selection === 'previous' ? -1 : 0
  function months(first: number) {
    return Array.from({ length: size }, (_, index) => shiftBudgetPeriod(current, first + index))
      .filter((month): month is BudgetPeriod => month !== null)
  }
  const selected = months(offset - size + 1)
  const prior = months(offset - size * 2 + 1)
  const first = selected[0]
  const last = selected.at(-1)!
  const previousLast = prior.at(-1)
  const partial = last === current
  const day = Number(today.slice(8))
  const cap = previousLast ? Math.min(day, daysInBudgetPeriod(previousLast)) : 0
  const previous = previousLast && prior.length === size ? {
    from: budgetBounds(prior[0]).from,
    to: partial ? `${previousLast}-${String(cap).padStart(2, '0')}` : budgetBounds(previousLast).to,
  } : null
  return { months: selected, range: { from: budgetBounds(first).from, to: partial ? today : budgetBounds(last).to }, previous, comparable: Boolean(previous && (!partial || cap === day)) }
}

function commitmentAt(item: FinancialCommitment, cut: string, timeZone: string) {
  if (dateInZone(new Date(item.createdAt), timeZone) > cut) return null
  if (item.status === 'cancelado' && item.cancelledOn <= cut) return { kind: 'cancelled' as const }
  if (item.status === 'confirmado' && dateInZone(new Date(item.confirmedAt), timeZone) <= cut && item.effectiveDate <= cut) {
    return { kind: 'confirmed' as const, timely: item.effectiveDate <= item.dueDate }
  }
  return { kind: 'pending' as const }
}

function cashFlow(items: CashFlowItem[], free: number, cutoff: string, method: FinancialHealthMethodology): HealthCashFlow {
  const points = projectCashFlow(items, free, cutoff, method.horizon, null).points.slice(0, method.horizon)
  return {
    total: points.length, safe: points.filter(point => point.balance >= 0).length,
    minimum: Math.min(free, ...points.map(point => point.balance)), final: points.at(-1)!.balance,
    firstDeficit: free < 0 ? cutoff : points.find(point => point.balance < 0)?.date ?? null,
  }
}

function collection(records: FinancialRecords, range: HealthRange, today: string, criteria: MicroExpenseDetectionConfig, timeZone: string, method: FinancialHealthMethodology) {
  const cutoff = range.to
  const historical = cutoff < today
  const monthEnd = budgetBounds(parseBudgetPeriod(cutoff.slice(0, 7))!).to
  const closedAtCutoff = historical && cutoff === monthEnd
  const dueInPeriod = (dueDate: string) => dueDate >= range.from && dueDate <= monthEnd
  const knownAtCutoff = (timestamp: string) => dateInZone(new Date(timestamp), timeZone) <= cutoff
  const futureConfirmations = new Set(historical ? records.commitments.flatMap(item =>
    item.status === 'confirmado' && !knownAtCutoff(item.confirmedAt) ? [item.id] : []) : [])
  const snapshot = historical ? {
    ...records,
    movements: records.movements.filter(item => !item.commitmentId || !futureConfirmations.has(item.commitmentId)),
    reservations: records.reservations.filter(item => knownAtCutoff(item.recordedAt)),
  } : records
  const observed = records.accounts.some(account => account.openedOn <= range.from)
  const source = snapshot.movements.filter(item => inRange(item.date, range))
  const expenses = source.filter(item => item.type === 'gasto')
  const income = source.reduce((sum, item) => item.type === 'ingreso' ? sum + item.amount : sum, 0)
  const candidates = detectMicroExpenses(snapshot.movements, criteria, cutoff).candidateIds
  const categoryExpenses = new Map<string, number>()
  const categoryDiscretionary = new Map<string, number>()
  let reviewCount = 0
  let reviewed = 0
  for (const item of expenses) {
    categoryExpenses.set(item.categoryId, (categoryExpenses.get(item.categoryId) ?? 0) + item.amount)
    if (item.classification === 'prescindible' || item.classification === 'necesario') reviewed++
    if (item.classification === 'prescindible') categoryDiscretionary.set(item.categoryId, (categoryDiscretionary.get(item.categoryId) ?? 0) + item.amount)
    if (candidates.has(item.id)) reviewCount++
  }
  const budgets: HealthBudget[] = []
  let month = parseBudgetPeriod(range.from.slice(0, 7))
  while (month && month <= cutoff.slice(0, 7)) {
    for (const budget of summarizeBudgets(records.budgets, source, month, cutoff).items) {
      budgets.push({ id: budget.id, categoryId: budget.categoryId, period: month, used: budget.used, limit: budget.limit, risk: budget.projection.risk === 'projected-excess' || budget.projection.risk === 'ahead' })
    }
    month = shiftBudgetPeriod(month, 1)
  }
  const uncoveredCategories = new Set<string>()
  const covered = new Set(budgets.map(item => `${item.period}:${item.categoryId}`))
  for (const item of expenses) if (!covered.has(`${item.date.slice(0, 7)}:${item.categoryId}`)) uncoveredCategories.add(item.categoryId)
  const payments: HealthPayments = { timely: 0, late: 0, overdue: 0, unknown: false }
  const pending: CashFlowItem[] = []
  let unknownForecast = false
  for (const item of records.commitments) {
    const state = commitmentAt(item, cutoff, timeZone)
    if (!state) continue
    const reprogrammed = historical && item.originalDueDate !== undefined
    if (state.kind === 'pending') {
      const projectionEnd = shiftDays(cutoff, method.horizon - 1)
      if (reprogrammed && (item.dueDate <= projectionEnd || item.originalDueDate! <= projectionEnd)) unknownForecast = true
      pending.push(item)
    }
    if (item.type !== 'pago' || state.kind === 'cancelled') continue
    if (reprogrammed && [item.dueDate, item.originalDueDate!].some(dueDate =>
      dueInPeriod(dueDate) && (dueDate <= cutoff || state.kind === 'confirmed'))) payments.unknown = true
    if (!dueInPeriod(item.dueDate)) continue
    if (state.kind === 'confirmed') payments[state.timely ? 'timely' : 'late']++
    else if (item.dueDate < cutoff || (item.dueDate === cutoff && closedAtCutoff)) payments.overdue++
  }
  const hasAccounts = records.accounts.some(account => account.openedOn <= cutoff)
  const registered = hasAccounts ? registeredBalance(snapshot, cutoff) : null
  const reserved = hasAccounts ? reservedAt(snapshot, cutoff) : null
  const goalProgress = historical ? null : summarizeSavings(records, cutoff).progress
  return {
    income, categoryExpenses, categoryDiscretionary, budgets, uncoveredCategories: [...uncoveredCategories], observed, payments,
    pending, unknownForecast, historical, registered, reserved, goalProgress, expenseCount: expenses.length, reviewed, reviewCount, timeZone,
    accountsAtRisk: historical ? [] : accountsWithUpcomingShortfall(records, cutoff).map(item => item.id),
  }
}

type Inputs = ReturnType<typeof collection>
const sumAmounts = (values: Iterable<number>) => [...values].reduce((total, value) => total + value, 0)

function assess(input: Inputs, range: HealthRange, today: string, method: FinancialHealthMethodology, override?: { free: number; omitted: string[] }): FinancialHealthAssessment {
  const expense = sumAmounts(input.categoryExpenses.values())
  const discretionary = sumAmounts(input.categoryDiscretionary.values())
  const budgetLimit = sumAmounts(input.budgets.map(item => item.limit))
  const budgetedSpend = sumAmounts(input.budgets.map(item => item.used))
  const budgetCoverage = ratio(budgetedSpend, expense)
  const { income, reviewed, payments, observed, historical, registered, reserved, reviewCount, expenseCount } = input
  const free = override?.free ?? (registered !== null && reserved !== null ? registered - reserved : null)
  const pending = override ? input.pending.filter(item => item.type !== 'pago' || !override.omitted.includes(item.id)) : input.pending
  const projection = free !== null && !input.unknownForecast ? cashFlow(pending, free, range.to, method) : null
  const conservative = free !== null && !input.unknownForecast ? cashFlow(pending.filter(item => item.type === 'pago'), free, range.to, method) : null
  const savingsRate = ratio(income - expense, income)
  const discretionaryShare = ratio(discretionary, expense)
  const paid = payments.timely + payments.late + payments.overdue
  function pillar(id: PillarId, value: number | null, reason?: string, provisional = false): FinancialHealthPillar {
    const score = observed && value !== null ? clamp(value) : null
    return {
      id, weight: method.weights[id], score, points: score === null ? null : score * method.weights[id] / 100,
      state: score === null ? 'unavailable' : provisional ? 'provisional' : 'available',
      reason: observed ? reason : 'El período comienza antes del historial de cuentas disponible.',
    }
  }
  const budgetScore = budgetLimit && budgetCoverage ? input.budgets.reduce((sum, item) =>
    sum + item.limit * clamp(100 * (1 - Math.max(0, item.used - item.limit) / item.limit)), 0) / budgetLimit : null
  const lowCoverage = budgetCoverage !== null && budgetCoverage > 0 && budgetCoverage < method.budgetCoverageMinimum
  const pillars = [
    pillar('savings', savingsRate === null ? null : savingsRate / method.savingsReference * 100, savingsRate === null ? 'Faltan ingresos efectivos en el período.' : undefined),
    pillar('budget', budgetScore, !budgetLimit ? 'Faltan presupuestos para el período.' : !budgetCoverage ? 'Falta gasto efectivo cubierto por un presupuesto.' : lowCoverage ? 'La cobertura presupuestaria está por debajo de la referencia.' : undefined, lowCoverage),
    pillar('balance', projection ? projection.safe / projection.total * 100 : null, input.unknownForecast ? 'Falta la fecha de reprogramación de un compromiso histórico.' : !projection ? 'Faltan cuentas para proyectar el dinero libre.' : undefined),
    pillar('micro', discretionaryShare !== null && reviewed > 0 ? (1 - discretionaryShare / method.discretionaryReference) * 100 : null, discretionaryShare === null ? 'Faltan gastos efectivos.' : !reviewed ? 'Falta al menos un gasto revisado como necesario o prescindible.' : reviewCount ? 'Hay candidatos pendientes de revisión.' : undefined, reviewCount > 0),
    pillar('payments', paid && !payments.unknown ? payments.timely / paid * 100 : null, payments.unknown ? 'No es posible determinar el vencimiento vigente al corte.' : !paid ? 'Faltan pagos evaluables con vencimiento en el período.' : undefined),
  ]
  const available = pillars.filter(item => item.score !== null)
  const score = available.length === pillars.length ? Math.round(sumAmounts(available.map(item => item.points!))) : null
  const closed = range.to < today && range.to === budgetBounds(parseBudgetPeriod(range.to.slice(0, 7))!).to
  const notes = historical ? ['Reconstrucción con registros y preferencias vigentes. El repositorio carece de instantáneas históricas de movimientos, presupuestos y clasificaciones.'] : []
  if (!closed) notes.push('El último mes de la selección usa un corte parcial.')
  if (override) notes.push('Escenario hipotético de esta evaluación.')
  return {
    range, evaluatedOn: today, timeZone: input.timeZone, version: method.version, score, status: score === null ? null : interpretHealth(score), pillars,
    quality: {
      coverage: sumAmounts(available.map(item => item.weight)), available: available.length, observed, closed, reconstructed: historical, notes,
      state: !available.length ? 'insufficient' : score === null ? 'partial' : override || !closed || pillars.some(item => item.state === 'provisional') ? 'provisional' : historical ? 'reconstructed' : 'complete',
    },
    indicators: {
      income, expense, net: income - expense, savingsRate, registered, free, reserved, goalProgress: input.goalProgress,
      emergencyMonths: null, budgetLimit, budgetedSpend, unbudgetedSpend: Math.max(0, expense - budgetedSpend),
      unbudgetedCategories: input.uncoveredCategories, budgetCoverage,
      exceeded: input.budgets.filter(row => row.used > row.limit).length, budgetRisk: input.budgets.filter(row => row.risk).length,
      discretionary, discretionaryShare, reviewCount, reviewShare: ratio(reviewCount, expenseCount), classifiedCount: reviewed, expenseCount, payments,
      overdue: pending.filter(item => item.type === 'pago' && (item.dueDate < range.to || (closed && item.dueDate === range.to))).length,
      accountsAtRisk: input.accountsAtRisk,
      upcoming: pending.filter(item => closed ? item.dueDate > range.to : item.dueDate >= range.to).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3),
      cashFlow: projection, conservative,
    },
    budgets: input.budgets,
  }
}

export function createHealthCalculator(records: FinancialRecords, today: string, criteria = defaultDetection, timeZone = 'America/Santiago', method = healthMethodology) {
  const inputs = (range: HealthRange) => collection(records, range, today, criteria, timeZone, method)
  const evaluate = (range: HealthRange) => assess(inputs(range), range, today, method)
  return {
    method, evaluate,
    history(selection: FinancialHealthPeriod, current: FinancialHealthAssessment): FinancialHealthHistory {
      const window = healthWindows(selection, today)
      const previous = window.previous && window.comparable ? evaluate(window.previous) : null
      const comparable = Boolean(previous?.quality.observed && current.quality.observed)
      return {
        points: window.months.map(month => {
          const range = budgetBounds(month)
          if (range.to > today) range.to = today
          return range.from === current.range.from && range.to === current.range.to ? current : evaluate(range)
        }),
        previous, comparable,
        difference: comparable && current.score !== null && previous?.score !== null && previous ? current.score - previous.score : null,
        pillarChanges: Object.fromEntries(pillarIds.map((id, index) => {
          const value = current.pillars[index].score
          const prior = previous?.pillars[index].score
          return [id, comparable && value !== null && prior != null ? value - prior : null]
        })) as FinancialHealthHistory['pillarChanges'],
      }
    },
    pendingPayments(range: HealthRange) {
      const end = shiftDays(range.to, method.horizon - 1)
      return inputs(range).pending.filter(item => item.type === 'pago' && item.dueDate <= end).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    },
    simulate(base: FinancialHealthAssessment, scenario: FinancialHealthScenario): FinancialHealthSimulationResult {
      return evaluateScenario(inputs(base.range), base, scenario, today, method)
    },
  }
}

function allocation(amount: number, weights: Map<string, number>) {
  const total = sumAmounts(weights.values())
  if (!total) return new Map([['', amount]])
  let placed = 0
  let observed = 0
  return new Map([...weights].map(([category, value]) => {
    observed += value
    const next = Math.round(amount * observed / total)
    const part = next - placed
    placed = next
    return [category, part]
  }))
}

function evaluateScenario(input: Inputs, base: FinancialHealthAssessment, scenario: FinancialHealthScenario, today: string, method: FinancialHealthMethodology): FinancialHealthSimulationResult {
  const categoryExpenses = allocation(scenario.expense, input.categoryExpenses)
  if (scenario.categoryId && scenario.categoryAmount !== null) categoryExpenses.set(scenario.categoryId, scenario.categoryAmount)
  const categoryDiscretionary = new Map<string, number>()
  let potentialSaving = 0
  for (const [id, discretionary] of input.categoryDiscretionary) {
    const expense = categoryExpenses.get(id) ?? 0
    const eligible = Math.min(discretionary, expense)
    const reduction = Math.round(eligible * scenario.reduction / 100)
    categoryExpenses.set(id, expense - reduction)
    categoryDiscretionary.set(id, eligible - reduction)
    potentialSaving += reduction
  }
  const budgets = input.budgets.map(item => ({ ...item, used: 0, risk: false }))
  const uncovered = new Set<string>()
  for (const [id, amount] of categoryExpenses) {
    const available = budgets.filter(item => item.categoryId === id)
    if (!available.length) { if (amount > 0) uncovered.add(id); continue }
    const weights = new Map(available.map(item => [item.id, input.budgets.find(row => row.id === item.id)!.used]))
    const unbudgeted = Math.max(0, (input.categoryExpenses.get(id) ?? 0) - sumAmounts(weights.values()))
    weights.set('', unbudgeted)
    if (!sumAmounts(weights.values())) for (const item of available) weights.set(item.id, item.limit)
    const allocated = allocation(amount, weights)
    for (const item of available) item.used = allocated.get(item.id) ?? 0
    if (allocated.get('')) uncovered.add(id)
  }
  const next = assess({
    ...input, income: scenario.income, categoryExpenses, categoryDiscretionary, budgets,
    uncoveredCategories: [...uncovered],
  }, base.range, today, method, { free: scenario.free, omitted: scenario.omittedPayments })
  return {
    base, scenario: next, difference: base.score === null || next.score === null ? null : next.score - base.score,
    affected: next.pillars.flatMap((item, index) => {
      const before = base.pillars[index].score
      if (item.score === before) return []
      return [{ id: item.id, difference: item.score === null || before === null ? null : item.score - before }]
    }),
    potentialSaving,
  }
}
