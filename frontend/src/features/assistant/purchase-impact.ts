import { parseBudgetPeriod, summarizeBudgets } from '../budgets/budget-calculations.ts'
import { pendingItems, projectCashFlow, scenarioItems } from '../commitments/cash-flow.ts'
import type { CashFlowItem, CashFlowProjection, CashFlowScenario } from '../commitments/commitment-model.ts'
import { accountReservation } from '../savings/savings-ledger.ts'
import type { AnalysisContext, PurchaseForecast, PurchaseImpactResult, PurchaseImpactScenario } from './assistant-model.ts'

export function purchaseImpact(scenario: PurchaseImpactScenario, context: AnalysisContext): PurchaseImpactResult | null {
  const { records, today } = context
  const account = records.accounts.find(item => item.id === scenario.accountId && item.status === 'activa' && item.openedOn <= today)
  const month = parseBudgetPeriod(scenario.date.slice(0, 7))
  if (!account || !month) return null
  const { balance, reserved, free } = accountReservation(account, records, today)
  const pending = pendingItems(records.commitments)
  const purchase: CashFlowItem = { id: 'purchase-scenario', type: 'pago', dueDate: scenario.date, name: 'Compra hipotética', amount: scenario.amount, hypothetical: true }
  const extra: CashFlowScenario = { hypothetical: [purchase], changes: {}, reserve: scenario.minimumFree }
  const accountItems = pending.filter(item => item.accountId === account.id)
  function calculate(items: CashFlowItem[], atStart: number) {
    return projectCashFlow(scenarioItems(items, extra), atStart, today, scenario.horizon, extra.reserve)
  }
  const expected = calculate(accountItems, free)
  const conservative = calculate(accountItems.filter(item => item.type === 'pago'), free)
  const global = records.accounts.filter(item => item.status === 'activa' && item.openedOn <= today)
  const globalItems = pending.filter(item => global.some(entry => entry.id === item.accountId))
  const totalFree = global.reduce((sum, entry) => sum + accountReservation(entry, records, today).free, 0)
  const total = calculate(globalItems, totalFree)
  const totalConservative = calculate(globalItems.filter(item => item.type === 'pago'), totalFree)
  function summary(projection: CashFlowProjection): PurchaseForecast {
    return {
      after: projection.points.find(point => point.date === scenario.date)?.balance ?? projection.finalBalance,
      final: projection.finalBalance, minimum: projection.minimumBalance, minimumDate: projection.minimumDate,
      firstDeficit: projection.firstDeficit, minimumMargin: projection.minimumBalance - scenario.minimumFree,
    }
  }
  const budget = summarizeBudgets(records.budgets, records.movements, month, today).items.find(item => item.categoryId === scenario.categoryId)
  return {
    accountBalance: balance, reserved, free, amount: scenario.amount, date: scenario.date, minimumFree: scenario.minimumFree,
    expected: summary(expected), conservative: summary(conservative), total: summary(total), totalConservative: summary(totalConservative),
    budget: budget ? { id: budget.id, limit: budget.limit, used: budget.used, remainingBefore: budget.remaining, remainingAfter: budget.remaining - scenario.amount } : null,
    trend: expected.points.map((point, index) => ({ date: point.date, expected: point.balance, conservative: conservative.points[index].balance })),
  }
}
