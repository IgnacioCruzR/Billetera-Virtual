import { parseBudgetPeriod, summarizeBudgets } from '../budgets/budget-calculations.ts'
import { pendingItems } from '../commitments/cash-flow.ts'
import { createMockHealthRepository, loadHealth } from '../health/health-data.ts'
import { healthWindows } from '../health/health-assessment.ts'
import { analyzeMicroExpenses, emptySavingsScenario, simulateSavings } from '../micro-expenses/micro-expense-analysis.ts'
import { detectMicroExpenses } from '../micro-expenses/micro-expense-detection.ts'
import { goalHistory, summarizeSavings } from '../savings/savings-ledger.ts'
import { accountsWithUpcomingShortfall, habitualContribution, projectSavings } from '../savings/savings-planning.ts'
import { shiftDays } from '../../lib/calendar.ts'
import type { AnalysisContext, FinancialAnalysisAction, FinancialAnalysisEvidence, FinancialAnalysisMetric, FinancialAnalysisRecommendation, FinancialAnalysisRequest, FinancialAnalysisResult } from './assistant-model.ts'
import { purchaseImpact } from './purchase-impact.ts'

const money = (id: string, label: string, value: number | null, source: FinancialAnalysisMetric['source'] = 'verified'): FinancialAnalysisMetric => ({ id, label, unit: 'clp', value, source })
const count = (id: string, label: string, value: number | null): FinancialAnalysisMetric => ({ id, label, unit: 'count', value, source: 'verified' })
const percent = (id: string, label: string, value: number | null): FinancialAnalysisMetric => ({ id, label, unit: 'percent', value, source: 'verified' })
const dateMetric = (id: string, label: string, value: string | null): FinancialAnalysisMetric => ({ id, label, unit: 'date', value, source: 'hypothesis' })
const score = (id: string, label: string, value: number | null): FinancialAnalysisMetric => ({ id, label, unit: 'score', value, source: 'verified' })
const evidence = (text: string, ...metricIds: string[]): FinancialAnalysisEvidence => ({ text, metricIds })
const advice = (title: string, description: string, proof: FinancialAnalysisEvidence, action: FinancialAnalysisAction, priority: FinancialAnalysisRecommendation['priority'] = 'Normal', benefit?: string): FinancialAnalysisRecommendation =>
  ({ title, description, evidence: proof, action, priority, benefit })

const healthNames = { savings: 'Capacidad de ahorro', budget: 'Cumplimiento presupuestario', balance: 'Equilibrio financiero', micro: 'Control de gastos hormiga', payments: 'Cumplimiento de pagos' }

export function buildDemoAnalysis(request: FinancialAnalysisRequest, context: AnalysisContext, generatedAt: string): FinancialAnalysisResult {
  const { today, records, criteria, timeZone, categories } = context
  const period = 'period' in request.parameters ? request.parameters.period : 'month'
  const window = healthWindows(period, today)
  const report: FinancialAnalysisResult = {
    requestId: request.requestId, type: request.type, status: 'available', origin: 'demo', generatedAt,
    range: request.type === 'purchase' ? { from: today, to: shiftDays(today, request.parameters.horizon) } : window.range,
    templateVersion: 'demo-v1', summary: { text: '' }, metrics: [], risks: [], strengths: [], opportunities: [],
    recommendations: [], quality: { available: [], missing: [] }, assumptions: [],
    limitations: ['Proyecciones orientativas según los registros disponibles al momento de solicitar el análisis.'],
  }
  const ready = (summary: string, ...available: string[]) => {
    report.summary.text = summary
    report.quality.available.push(...available)
  }
  const missing = (...items: string[]) => report.quality.missing.push(...items)
  const insufficient = (summary: string, ...items: string[]) => {
    report.status = 'insufficient'
    report.summary.text = summary
    missing(...items)
  }
  const categoryName = (id: string) => categories.find(item => item.id === id)?.name ?? 'Categoría de gasto'
  const pending = pendingItems(records.commitments)

  if (request.type === 'situation' || request.type === 'health') {
    const health = loadHealth(createMockHealthRepository(records, today, criteria, timeZone), period, 'ready')
    if (health.status !== 'ready') {
      insufficient('La evaluación financiera está temporalmente indisponible.', 'Resultado del módulo Salud financiera')
      return report
    }
    const { indicators: data, pillars, quality } = health.report
    const paid = data.payments.timely + data.payments.late + data.payments.overdue
    const activePillars = pillars.filter(item => item.score !== null)
    const healthAction = { kind: 'OPEN_FINANCIAL_HEALTH', period } as const
    if (request.type === 'situation') {
      report.metrics.push(money('income', 'Ingresos efectivos', data.income), money('expense', 'Gastos efectivos', data.expense),
        money('net', 'Balance neto', data.net), money('balance', 'Saldo registrado', data.registered),
        money('free', 'Dinero libre', data.free), money('reserved', 'Dinero reservado', data.reserved),
        count('budgetRisk', 'Presupuestos excedidos', data.exceeded), count('pending', 'Pagos vencidos al corte', data.overdue),
        count('currentPending', 'Compromisos pendientes vigentes', window.range.to === today ? pending.length : null),
        money('floor', 'Mínimo libre proyectado', data.cashFlow?.minimum ?? null, 'hypothesis'))
      ready('Consulta el balance del período, la disponibilidad al corte y las obligaciones que requieren atención.', 'Ingresos, gastos y planificación del período')
      if (!data.income && !data.expense) insufficient('No hay ingresos ni gastos efectivos en el período.', 'Movimientos efectivos')
      if (data.net > 0) report.strengths.push(evidence('Los ingresos registrados superan los gastos del período.', 'net'))
      if (data.cashFlow?.firstDeficit || data.overdue) report.risks.push({ title: 'Compromisos por revisar', priority: 'Alta', evidence: evidence('El período muestra vencidos o un posible faltante de dinero libre.', 'pending', 'floor') })
      if (data.net < 0) report.opportunities.push(evidence('Revisa las categorías que explican el balance negativo.', 'net', 'expense'))
      if (data.free === null) missing('Saldo y dinero libre al corte')
      report.recommendations.push(advice('Revisar movimientos', 'Consulta los registros efectivos del período.', evidence('El balance se construye con ingresos y gastos efectivos.', 'income', 'expense'),
        { kind: 'OPEN_TRANSACTIONS', from: window.range.from, to: window.range.to }))
    } else {
      ready(health.report.score === null ? 'La evaluación muestra los pilares observables y conserva los resultados pendientes.' : 'La puntuación se toma de la evaluación compartida. Consulta los pilares para interpretar qué influyó en el resultado.',
        'Metodología ' + health.report.version, 'Ponderaciones oficiales de la evaluación mostrada')
      if (!activePillars.length) insufficient('Faltan datos para interpretar los pilares de este período.', 'Puntuaciones de los pilares')
      report.metrics.push(percent('coverage', 'Cobertura de ponderaciones', quality.coverage),
        { id: 'comparison', label: 'Variación comparable', source: 'verified', unit: 'points', value: health.history.difference })
      for (const pillar of pillars) {
        report.metrics.push(score(pillar.id, healthNames[pillar.id] + ' · peso ' + pillar.weight + ' %', pillar.score))
        if (pillar.score === null) missing(healthNames[pillar.id] + ': ' + (pillar.reason ?? 'Sin puntuación'))
        else if (pillar.score >= 80) report.strengths.push(evidence(healthNames[pillar.id] + ' tiene un resultado favorable en este período.', pillar.id))
        else if (pillar.score < 60) report.risks.push({ title: healthNames[pillar.id], priority: 'Media', evidence: evidence('Este pilar queda por debajo de 60 puntos y admite revisar sus componentes.', pillar.id) })
      }
      if (health.history.difference === null) missing('Variación global con un período anterior equivalente')
      report.limitations.push(...quality.notes)
    }
    report.metrics.push(score('score', 'Puntuación de salud financiera', health.report.score))
    if (health.report.score === null) missing('Puntuación global con los cinco pilares disponibles')
    if (paid && !data.payments.unknown) {
      report.metrics.push(count('evaluatedPayments', 'Pagos evaluables del período', paid))
      report.opportunities.push(evidence('Los pagos evaluables se pueden revisar por vencimiento y puntualidad.', 'evaluatedPayments'))
    }
    for (const item of health.recommendations.slice(0, 3)) {
      const mapping = {
        balance: { kind: item.id === 'funds' ? 'OPEN_ACCOUNTS' : 'OPEN_COMMITMENTS' },
        budget: { kind: 'OPEN_BUDGET_DETAIL', budgetId: health.report.budgets.filter(row => row.used > row.limit).sort((a, b) => (b.used - b.limit) - (a.used - a.limit))[0]?.id },
        payments: { kind: 'OPEN_COMMITMENTS' }, savings: { kind: 'OPEN_SAVINGS_GOAL' },
        micro: { kind: 'OPEN_MICRO_EXPENSE_SIMULATOR', month: window.range.to.slice(0, 7) },
      } satisfies Record<typeof item.pillar, FinancialAnalysisAction>
      const action = item.id === 'expenses' ? { kind: 'OPEN_TRANSACTIONS', from: window.range.from, to: window.range.to } as const : mapping[item.pillar]
      report.recommendations.push(advice(item.title, item.description, evidence(item.evidence, request.type === 'health' ? item.pillar : 'score'), action,
        item.priority === 'Oportunidad' ? 'Normal' : item.priority, item.benefit))
    }
    report.recommendations.push(advice('Abrir Salud financiera', 'Consulta la calidad de evaluación y el detalle de cada indicador.', evidence('El mismo módulo calcula las puntuaciones mostradas.', 'score'), healthAction))
  }

  if (request.type === 'purchase') {
    const purchase = purchaseImpact(request.parameters, context)
    if (!purchase) {
      insufficient('La cuenta o el horizonte ya no está disponible.', 'Cuenta activa y fecha de simulación')
      return report
    }
    report.purchase = purchase
    ready('Compara el dinero libre de la cuenta antes y después de la compra, y revisa si los cobros previstos cambian el resultado.',
      'Cuenta, reservas y compromisos registrados', 'Escenarios esperado y conservador')
    report.assumptions.push('La compra se agrega como pago hipotético. Se usan cierres diarios y el escenario conservador excluye todos los cobros pendientes.',
      'La reserva mínima deseada se usa como referencia durante el horizonte. Los fondos ya reservados se descuentan del saldo al inicio.')
    report.metrics.push(money('balance', 'Saldo registrado de la cuenta', purchase.accountBalance), money('reserved', 'Dinero reservado', purchase.reserved),
      money('free', 'Dinero libre inicial', purchase.free), money('purchase', 'Monto de la compra', purchase.amount, 'hypothesis'),
      money('expectedFloor', 'Mínimo libre con cobros previstos', purchase.expected.minimum, 'hypothesis'),
      money('conservativeFloor', 'Mínimo libre sin cobros previstos', purchase.conservative.minimum, 'hypothesis'),
      money('globalFloor', 'Mínimo libre de cuentas activas', purchase.total.minimum, 'hypothesis'))
    if (purchase.expected.firstDeficit || purchase.conservative.firstDeficit) {
      const text = (purchase.expected.minimum < 0 && purchase.total.minimum >= 0) ||
        (purchase.conservative.minimum < 0 && purchase.totalConservative.minimum >= 0)
        ? 'La cuenta seleccionada puede quedar en déficit aunque el dinero libre agregado siga siendo positivo.'
        : 'Al menos un escenario presenta un déficit durante el horizonte.'
      report.risks.push({ title: 'Riesgo de déficit', priority: 'Alta', evidence: evidence(text, 'expectedFloor', 'conservativeFloor', 'globalFloor') })
    } else if (purchase.conservative.minimumMargin < 0) report.risks.push({ title: 'Margen bajo la reserva deseada', priority: 'Media', evidence: evidence('El mínimo libre conservador cae bajo tu reserva mínima.', 'conservativeFloor') })
    else report.strengths.push(evidence('El mínimo libre de la cuenta cubre la reserva indicada en ambos escenarios.', 'conservativeFloor'))
    if (purchase.budget) {
      report.metrics.push(money('budgetLimit', 'Límite del mes de compra', purchase.budget.limit), money('budgetUsed', 'Gasto efectivo de la categoría', purchase.budget.used), money('budgetAfter', 'Margen presupuestario tras la compra', purchase.budget.remainingAfter, 'hypothesis'))
      if (purchase.budget.remainingAfter < 0) report.risks.push({ title: 'Límite de la categoría excedido', priority: 'Media', evidence: evidence('El margen del presupuesto del mes quedaría negativo.', 'budgetAfter') })
      report.recommendations.push(advice('Consultar el presupuesto del mes', 'Revisa el gasto efectivo y el límite antes de decidir.', evidence('La compra se contrastó con el límite de la categoría.', 'budgetLimit', 'budgetAfter'), { kind: 'OPEN_BUDGET_DETAIL', budgetId: purchase.budget.id }))
    } else missing('Presupuesto de la categoría para el mes de la compra')
    report.recommendations.push(advice('Revisar próximos compromisos', 'Comprueba las fechas de pago y recepción antes de decidir.', evidence('Los vencimientos afectan el mínimo disponible durante el horizonte.', 'conservativeFloor'), { kind: 'OPEN_COMMITMENTS' }, 'Alta'))
    report.recommendations.push(advice('Consultar la cuenta de origen', 'Revisa cuánto dinero sigue libre en la cuenta seleccionada.', evidence('La disponibilidad deja fuera los fondos reservados.', 'free', 'reserved'), { kind: 'OPEN_ACCOUNTS', accountId: request.parameters.accountId }))
  }

  if (request.type === 'opportunities') {
    const { categoryId, reduction, period: selection } = request.parameters
    const month = window.range.to.slice(0, 7)
    const selectionEnd = window.range.to
    const transactions = categoryId ? records.movements.filter(item => item.type !== 'transferencia' && item.categoryId === categoryId) : records.movements
    const detected = detectMicroExpenses(records.movements, criteria, selectionEnd).candidateIds
    const micro = analyzeMicroExpenses(transactions, detected, { month, range: selection === 'quarter' ? 'quarter' : 'month' }, selectionEnd)
    const scenario = simulateSavings(micro, { ...emptySavingsScenario, includeDiscretionary: true, reduction })
    const comparable = window.previous && window.comparable && records.accounts.some(item => item.openedOn <= window.previous!.from)
    const stats = micro.summary
    ready('Revisa las repeticiones de consumo y compara una reducción de gastos que ya marcaste como prescindibles.', 'Candidatos, patrones y clasificaciones del período')
    if (!micro.history.length) insufficient('No hay gastos efectivos en el período y filtro seleccionados.', 'Gastos observables para identificar patrones')
    report.metrics.push(count('candidates', 'Movimientos incluidos en Gastos hormiga', stats.count), count('review', 'Candidatos por revisar', stats.pendingCount),
      money('discretionary', 'Gasto marcado prescindible', stats.discretionary), money('potential', 'Ahorro mensual estimado', scenario.selectedCount ? scenario.monthly : null, 'hypothesis'),
      percent('trend', 'Variación comparable de Gastos hormiga', comparable ? stats.variation : null))
    if (!comparable || stats.variation === null) missing('Variación con suficiente historial y corte equivalente')
    if (!scenario.selectedCount || scenario.monthly === null) missing('Escenario mensual con gastos prescindibles y observaciones suficientes')
    for (const [index, pattern] of micro.patterns.slice(0, 3).entries()) {
      const id = 'pattern-' + (index + 1)
      report.metrics.push(count(id + '-count', categoryName(pattern.categoryId) + ' · frecuencia', pattern.count), money(id, categoryName(pattern.categoryId) + ' · gasto del patrón', pattern.amount))
      report.opportunities.push({ ...evidence('Patrón observado en ' + pattern.name, id, id + '-count'), sensitive: true })
    }
    const monthBudget = summarizeBudgets(records.budgets, records.movements, parseBudgetPeriod(month)!, selectionEnd)
    const selectedBudgets = monthBudget.items.filter(item => !categoryId || item.categoryId === categoryId)
    report.metrics.push(count('budgetExcess', 'Presupuestos excedidos en el último mes del corte', selectedBudgets.filter(item => item.used > item.limit).length))
    if (stats.necessaryCount) report.strengths.push(evidence('Las marcas de gasto necesario se respetan en la simulación.', 'discretionary'))
    report.recommendations.push(advice('Probar una reducción', 'Ajusta la reducción en Gastos hormiga tras revisar tus clasificaciones.', evidence('El ahorro estimado usa únicamente las marcas de prescindible.', 'discretionary', 'potential'),
      { kind: 'OPEN_MICRO_EXPENSE_SIMULATOR', month }, 'Normal', 'Contrastar cuánto cambiaría el gasto mensual.'))
    report.limitations.push('La frecuencia observada orienta la revisión. La reducción depende de mantener el escenario durante los meses siguientes.')
  }

  if (request.type === 'budgets') {
    const { categoryId } = request.parameters
    const month = parseBudgetPeriod(window.range.to.slice(0, 7))!
    const select = (items: ReturnType<typeof summarizeBudgets>['items']) => items.filter(item => !categoryId || item.categoryId === categoryId)
    const source = summarizeBudgets(records.budgets, records.movements, month, window.range.to)
    const current = select(source.items)
    const before = window.previous ? select(summarizeBudgets(records.budgets, records.movements, parseBudgetPeriod(window.previous.to.slice(0, 7))!, window.previous.to).items) : []
    const comparable = window.previous && window.comparable && records.accounts.some(item => item.openedOn <= window.previous!.from)
    const unbudgeted = source.summary.unbudgeted.filter(item => !categoryId || item.categoryId === categoryId)
    ready('Compara los límites del mes con el consumo efectivo, el ritmo observado y las categorías sin planificación.', 'Presupuestos y gastos efectivos del mes')
    if (!current.length && !unbudgeted.length) insufficient('El mes y filtro seleccionados no tienen actividad presupuestaria observable.', 'Límites o gasto efectivo')
    report.metrics.push(money('limit', 'Límites del período', current.length ? current.reduce((sum, item) => sum + item.limit, 0) : null),
      money('spent', 'Consumo presupuestado', current.length ? current.reduce((sum, item) => sum + item.used, 0) : null),
      money('outside', 'Gasto sin presupuesto', unbudgeted.reduce((sum, item) => sum + item.spent, 0)))
    if (unbudgeted.length) report.opportunities.push(evidence('Categorías sin planificación: ' + unbudgeted.map(item => categoryName(item.categoryId)).join(', ') + '.', 'outside'))
    if (!current.length) missing('Presupuesto configurado para el filtro')
    if (!comparable || !before.length) missing('Mes anterior comparable con límites disponibles')
    if (comparable && before.length) report.metrics.push(money('prior', 'Consumo presupuestado en corte anterior', before.reduce((sum, item) => sum + item.used, 0)))
    const attention = current.filter(item => ['exceeded', 'at-limit', 'projected-excess', 'ahead'].includes(item.projection.risk))
    for (const [index, item] of attention.entries()) {
      const id = 'budget-' + (index + 1)
      const label = categoryName(item.categoryId)
      report.metrics.push(money(id, label + ' · margen actual', item.remaining), money(id + '-closing', label + ' · cierre proyectado', item.projection.projected === null ? null : Math.round(item.projection.projected), 'hypothesis'))
      report.risks.push({ title: label, priority: item.used > item.limit ? 'Alta' : 'Media',
        evidence: evidence(item.used > item.limit ? 'El gasto efectivo superó el límite configurado.' : 'El consumo alcanzó su límite o va por delante del ritmo previsto.', id, id + '-closing') })
      report.recommendations.push(advice('Revisar planificación de ' + label, 'Contrasta consumos y calendario antes de ajustar el límite o cambiar hábitos.', evidence('Margen y cierre según el ritmo observado.', id, id + '-closing'), { kind: 'OPEN_BUDGET_DETAIL', budgetId: item.id }, item.used > item.limit ? 'Alta' : 'Media'))
    }
    if (current.length && !attention.length) report.strengths.push(evidence('Los presupuestos observados no muestran un exceso ni un ritmo adelantado.', 'spent', 'limit'))
    report.recommendations.push(advice('Consultar gastos y planificación', 'Abre el historial filtrado al período para evaluar próximos límites.',
      evidence('Los gastos sin presupuesto conservan sus categorías.', 'outside'), { kind: 'OPEN_TRANSACTIONS', categoryId, from: window.range.from, to: window.range.to }))
    report.limitations.push('La proyección lineal requiere observaciones suficientes y puede variar con gastos puntuales.')
  }

  if (request.type === 'savings') {
    const goal = records.savingsGoals.find(item => item.id === request.parameters.goalId)
    if (!goal) {
      insufficient('La meta dejó de estar disponible.', 'Meta seleccionada')
      return report
    }
    const history = goalHistory(goal, records, today)
    const { monthly, targetDate, scenarioId } = request.parameters
    const habit = habitualContribution(history, today)
    const baseMonthly = monthly ?? habit.amount
    const scenario = context.scenarios.find(item => item.id === scenarioId)
    const target = targetDate ?? (goal.targetDate || undefined)
    const plan = projectSavings(goal.target, history.reserved, baseMonthly, today, target)
    const adjusted = projectSavings(goal.target, history.reserved, baseMonthly + (scenario?.monthlyPotential ?? 0), today, target)
    const totals = summarizeSavings(records, today)
    const shortfall = accountsWithUpcomingShortfall(records, today)
    const contributions = history.operations.filter(item => item.type === 'aporte' && item.date >= window.range.from).reduce((sum, item) => sum + item.amount, 0)
    ready('Compara el plan de la meta con el aporte requerido, el dinero libre y el escenario adicional que elegiste.', 'Meta, operaciones y disponibilidad de hoy')
    report.metrics.push(money('target', 'Objetivo registrado', goal.target), money('reserved', 'Dinero reservado para la meta', history.reserved),
      money('contributions', 'Aportes efectivos del mes', contributions), money('free', 'Dinero libre de cuentas activas', totals.availableForNew),
      money('planned', 'Aporte mensual del plan registrado', goal.monthlyPlan), money('base', 'Aporte mensual en el escenario base', baseMonthly || null, 'hypothesis'),
      money('required', 'Aporte mensual requerido para la fecha objetivo', plan.requiredMonthly, 'hypothesis'),
      dateMetric('estimate', 'Fecha estimada con el aporte base', plan.estimatedDate),
      count('payments', 'Pagos pendientes próximos y vencidos', pending.filter(item => item.type === 'pago' && item.dueDate <= shiftDays(today, 7)).length))
    if (scenario) {
      report.metrics.push(money('additional', 'Ahorro mensual adicional simulado', scenario.monthlyPotential, 'hypothesis'),
        dateMetric('adjusted', 'Fecha estimada con el escenario adicional', adjusted.estimatedDate))
      report.opportunities.push(evidence('El escenario de la sesión permite comparar el plazo estimado con un aporte adicional.', 'estimate', 'adjusted', 'additional'))
    }
    if (!target) missing('Fecha objetivo para calcular el aporte requerido')
    if (plan.remaining && !plan.estimatedDate) missing('Aporte mensual registrado, habitual o hipotético')
    if (target && plan.requiredMonthly === null) missing('Meses disponibles para programar aportes antes de la fecha')
    if (plan.estimatedDate && target && plan.estimatedDate > target) report.risks.push({ title: 'Plazo objetivo exigente', priority: 'Media', evidence: evidence('El aporte base estima una fecha posterior al objetivo.', 'estimate', 'required') })
    if (shortfall.length || (baseMonthly > 0 && baseMonthly > totals.availableForNew)) report.risks.push({ title: 'Prioriza la liquidez', priority: 'Alta', evidence: evidence('Revisa los próximos pagos y el dinero libre antes de comprometer un aporte.', 'free', 'payments', 'base') })
    if (history.reserved) report.strengths.push(evidence('La meta ya cuenta con fondos asignados en el libro de reservas.', 'reserved'))
    report.recommendations.push(advice('Abrir el planificador de la meta', 'Compara aportes y fechas sin afectar las reservas actuales.', evidence('La estimación usa el objetivo registrado y los aportes elegidos.', 'target', 'required'),
      { kind: 'OPEN_SAVINGS_GOAL', goalId: goal.id }))
    report.assumptions.push('La fecha estimada supone aportes mensuales regulares y disponibilidad futura. El escenario adicional se agrega al aporte base.')
  }

  const priority = { Alta: 0, Media: 1, Normal: 2 }
  report.risks.sort((a, b) => priority[a.priority] - priority[b.priority])
  report.recommendations.sort((a, b) => priority[a.priority] - priority[b.priority])
  return report
}
