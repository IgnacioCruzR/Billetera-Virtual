import type { FinancialHealthAssessment, FinancialHealthRecommendation } from './health-model.ts'

export function recommendHealth(report: FinancialHealthAssessment): FinancialHealthRecommendation[] {
  const { indicators: data, range } = report
  const advice: FinancialHealthRecommendation[] = []
  const history = `#movimientos?${new URLSearchParams({ desde: range.from, hasta: range.to, tipo: 'gasto' })}`
  const risk = data.accountsAtRisk.length > 0 || (data.free ?? 0) < 0 || Boolean(data.cashFlow?.firstDeficit || data.conservative?.firstDeficit)
  if ((data.free ?? 0) < 0) advice.push({
    id: 'funds', title: 'Revisa el dinero libre actual', description: 'Consulta el saldo y las reservas de cada cuenta antes de asumir otro pago.',
    pillar: 'balance', priority: 'Alta', evidence: 'Dinero libre registrado', amount: data.free!, benefit: 'Distinguir el efectivo disponible de los fondos ya asignados.',
    href: '#cuentas', action: 'Revisar mis cuentas',
  })
  if (data.accountsAtRisk.length > 0) advice.push({
    id: 'accounts', title: 'Verifica los fondos de los próximos pagos', description: 'Algunas cuentas tienen compromisos próximos que superan el dinero libre registrado.',
    pillar: 'balance', priority: 'Alta', evidence: 'Cuentas con posible faltante en los próximos 7 días', count: data.accountsAtRisk.length,
    benefit: 'Identificar qué cuentas requieren una revisión de fechas o disponibilidad.', href: '#compromisos', action: 'Ver compromisos próximos',
  })
  if (data.overdue > 0) advice.push({
    id: 'overdue', title: 'Revisa los pagos vencidos', description: 'Abre los compromisos para revisar cuáles siguen pendientes.',
    pillar: 'payments', priority: 'Alta', evidence: 'Pagos vencidos sin confirmar', count: data.overdue, benefit: 'Mantener los vencimientos y el flujo proyectado al día.',
    href: '#compromisos', action: 'Ver cobros y pagos',
  })
  const forecast = data.cashFlow?.firstDeficit ? data.cashFlow : data.conservative?.firstDeficit ? data.conservative : null
  if (forecast) advice.push({
    id: 'forecast', title: 'Anticipa un posible déficit', description: forecast === data.conservative ? 'El escenario que prescinde de cobros previstos muestra un faltante. Revisa las fechas de pago y recepción.' : 'La proyección de dinero libre muestra un faltante. Revisa qué vencimientos coinciden.',
    pillar: 'balance', priority: 'Alta', evidence: 'Mínimo libre proyectado', amount: forecast.minimum, date: forecast.firstDeficit ?? undefined, benefit: 'Tener margen para revisar vencimientos y fondos disponibles.',
    href: '#compromisos', action: 'Revisar el flujo de caja',
  })
  const exceeded = report.budgets.filter(item => item.used > item.limit).sort((a, b) => b.used - b.limit - (a.used - a.limit))[0]
  if (exceeded) advice.push({
    id: 'budget', title: 'Revisa el presupuesto excedido', description: 'Consulta el límite y los movimientos asociados al presupuesto de mayor exceso.',
    pillar: 'budget', priority: 'Media', evidence: 'Exceso sobre el límite', amount: exceeded.used - exceeded.limit, benefit: 'Reconocer qué consumos explican la diferencia.',
    href: `#presupuestos?${new URLSearchParams({ mes: exceeded.period, presupuesto: exceeded.id })}`, action: 'Abrir detalle del presupuesto',
  })
  if (!report.quality.reconstructed && !risk && !data.overdue && data.net > 0 && (data.free ?? 0) > 0) advice.push({
    id: 'savings', title: 'Explora un objetivo de ahorro', description: 'Compara aportes hipotéticos con tu dinero libre y los compromisos vigentes.',
    pillar: 'savings', priority: 'Oportunidad', evidence: 'Balance neto del período', amount: data.net, benefit: 'Elegir un ritmo compatible con tus obligaciones.',
    href: '#metas?plan=1', action: 'Abrir planificador de ahorro',
  })
  if (data.discretionary > 0) advice.push({
    id: 'habits', title: 'Simula una reducción de gastos prescindibles', description: 'Prueba reducciones únicamente en los consumos que marcaste como prescindibles.',
    pillar: 'micro', priority: 'Oportunidad', evidence: 'Gasto marcado como prescindible', amount: data.discretionary, benefit: 'Comparar un escenario de ahorro a tu ritmo.',
    href: `#hormiga?${new URLSearchParams({ simulador: 'prescindibles', mes: range.to.slice(0, 7) })}`, action: 'Abrir simulador de Gastos hormiga',
  })
  if (data.net < 0) advice.push({
    id: 'expenses', title: 'Consulta los gastos del período', description: 'Revisa los movimientos registrados para identificar los que más influyen en el balance.',
    pillar: 'savings', priority: 'Media', evidence: 'Balance neto del período', amount: data.net, benefit: 'Entender las categorías que explican la diferencia entre ingresos y gastos.',
    href: history, action: 'Ver movimientos del período',
  })
  if (data.reviewCount > 0 && !data.discretionary) advice.push({
    id: 'review', title: 'Revisa los candidatos pendientes', description: 'Registra una clasificación manual cuando conozcas el propósito de un gasto pequeño.',
    pillar: 'micro', priority: 'Oportunidad', evidence: 'Candidatos pendientes', count: data.reviewCount, benefit: 'Contar con una evaluación más precisa de los hábitos.',
    href: `#hormiga?mes=${range.to.slice(0, 7)}`, action: 'Revisar gastos hormiga',
  })
  return advice
}
