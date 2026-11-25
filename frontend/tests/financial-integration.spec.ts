import { expect, test, type Page } from '@playwright/test'
import type { FinancialRepository } from '../src/features/accounts/account-data'
import type { Account, FinancialRecords } from '../src/features/dashboard/model'

const date = '2026-11-24'
const account = (id: string, name: string, type: Account['type'], initialBalance: number): Account => ({
  id, name, type, icon: type, initialBalance, currency: 'CLP', status: 'activa', color: '#10B981',
  openedOn: '2026-10-01', createdAt: '2026-10-01T12:00:00Z', description: '',
})
const seed: Omit<FinancialRecords, 'usedAccountIds'> = {
  accounts: [account('audit-bank', 'Banco de prueba', 'corriente', 400_000), account('audit-cash', 'Efectivo', 'efectivo', 100_000)],
  movements: [], adjustments: [], commitments: [], savingsGoals: [], reservations: [],
  budgets: [{ id: 'audit-food', categoryId: 'alimentacion', period: '2026-11', limit: 100_000, warningThreshold: 80, description: '' }],
}
type AuditWindow = typeof globalThis & { auditRepository: FinancialRepository; otherAuditRepository: FinancialRepository; auditSeed: typeof seed }

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name, exact: true }).click()
const dashboard = (page: Page) => page.getByRole('region', { name: 'Saldos del dashboard' })
const article = (page: Page, name: string) => page.getByRole('article', { name, exact: true })

async function register(page: Page, type: 'Ingreso' | 'Gasto' | 'Transferencia', amount: string, description: string, category?: string) {
  await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Registrar movimiento' })
  await form.getByRole('button', { name: type, exact: true }).click()
  await form.getByLabel('Monto (CLP)').fill(amount)
  if (type === 'Ingreso') await form.getByLabel('Cuenta de destino').selectOption('audit-bank')
  else await form.getByLabel('Cuenta de origen').selectOption('audit-bank')
  if (type === 'Transferencia') await form.getByLabel('Cuenta de destino').selectOption('audit-cash')
  if (category) await form.getByLabel('Categoría').selectOption(category)
  await form.getByLabel(/Descripción/).fill(description)
  await form.getByRole('button', { name: 'Guardar movimiento' }).click()
  await expect(form).toBeHidden()
}

test('escenario obligatorio con caja, presupuesto, reservas y confirmación idempotente', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date(date + 'T12:00:00Z'))
  await page.addInitScript(value => { (globalThis as AuditWindow).auditSeed = value }, seed)
  await page.route('**/src/app/demo-sources.ts*', async route => {
    const response = await route.fetch()
    const original = await response.text()
    const body = original.replace('financial: createMockFinancialRepository(),', [
      'financial: (() => {',
      '  const initialRecords = { ...globalThis.auditSeed, usedAccountIds: new Set() };',
      '  globalThis.otherAuditRepository ??= createMockFinancialRepository({ initialRecords, userId: "audit-other" });',
      '  return globalThis.auditRepository ??= createMockFinancialRepository({ initialRecords, userId: "audit-owner" });',
      '})(),',
    ].join('\n'))
    await route.fulfill({ response, body })
  })

  await page.goto('/')
  await expect(dashboard(page)).toContainText('$500.000')
  for (const title of ['Ingresos del período', 'Gastos del período']) {
    await expect(dashboard(page).getByRole('heading', { name: title }).locator('../..')).toContainText('$0')
  }

  await register(page, 'Ingreso', '300000', 'Ingreso de auditoría', 'sueldo')
  await register(page, 'Gasto', '50000', 'Alimentación de auditoría', 'alimentacion')
  await expect(dashboard(page)).toContainText('$750.000')
  await register(page, 'Transferencia', '100000', 'Transferencia de auditoría')
  await expect(dashboard(page)).toContainText('$750.000')

  await nav(page, 'Metas de ahorro')
  await page.getByRole('button', { name: 'Nueva meta', exact: true }).click()
  const goalForm = page.getByRole('dialog', { name: 'Nueva meta' })
  await goalForm.getByLabel('Nombre de la meta').fill('Meta de auditoría')
  await goalForm.getByLabel('Monto objetivo (CLP)').fill('150000')
  await goalForm.getByLabel('Aporte inicial (CLP)').fill('80000')
  await goalForm.getByLabel('Cuenta del aporte inicial').selectOption('audit-bank')
  await goalForm.getByRole('button', { name: 'Crear meta' }).click()
  await expect(article(page, 'Dinero reservado')).toContainText('$80.000')

  await nav(page, 'Cobros y pagos')
  await page.getByRole('button', { name: 'Nuevo compromiso', exact: true }).click()
  const commitmentForm = page.getByRole('dialog', { name: 'Nuevo compromiso' })
  await commitmentForm.getByLabel('Nombre del pago').fill('Pago de auditoría')
  await commitmentForm.getByLabel('Monto (CLP)').fill('40000')
  await commitmentForm.getByLabel('Cuenta de origen').selectOption('audit-bank')
  await commitmentForm.getByLabel('Categoría').selectOption('otros')
  await commitmentForm.getByLabel('Fecha de vencimiento').fill(date)
  await commitmentForm.getByRole('button', { name: 'Crear compromiso' }).click()
  await expect(commitmentForm).toBeHidden()
  await expect(article(page, 'Saldo actual')).toContainText('$750.000')
  await expect(article(page, 'Pagos pendientes')).toContainText('$40.000')

  const commitment = page.getByRole('region', { name: 'Historial de compromisos' }).getByRole('button', { name: 'Pago de auditoría', exact: true })
  await commitment.click()
  await page.getByRole('dialog', { name: 'Pago de auditoría' }).getByRole('button', { name: 'Confirmar pago' }).click()
  const confirm = page.getByRole('dialog', { name: 'Confirmar pago' })
  await confirm.getByRole('button', { name: 'Confirmar pago' }).click()
  await expect(article(page, 'Saldo actual')).toContainText('$710.000')
  await expect(article(page, 'Pagos pendientes')).toContainText('$0')
  const repeated = await page.evaluate(async effectiveDate => {
    const { auditRepository, otherAuditRepository } = globalThis as AuditWindow
    const before = await auditRepository.list()
    const item = before.commitments[0]
    const retried = await auditRepository.confirmCommitment(item.id, { effectiveDate })
    const foreignRejected = await otherAuditRepository.confirmCommitment(item.id, { effectiveDate }).then(() => false, () => true)
    const other = await otherAuditRepository.list()
    return {
      count: retried.movements.filter(movement => movement.commitmentId === item.id).length,
      totalRecords: retried.movements.length, owner: item.userId, foreignRejected, otherMovements: other.movements.length,
      otherCommitments: other.commitments.length, otherInitialBalances: other.accounts.map(account => account.initialBalance),
    }
  }, date)
  expect(repeated).toEqual({
    count: 1, totalRecords: 4, owner: 'audit-owner', foreignRejected: true, otherMovements: 0,
    otherCommitments: 0, otherInitialBalances: [400_000, 100_000],
  })

  await nav(page, 'Metas de ahorro')
  const goal = article(page, 'Meta de auditoría')
  await goal.getByRole('button', { name: 'Acciones de Meta de auditoría' }).click()
  await page.getByRole('dialog', { name: 'Acciones de la meta' }).getByRole('button', { name: 'Liberar dinero' }).click()
  const release = page.getByRole('dialog', { name: 'Liberar dinero' })
  await release.getByLabel('Monto a liberar (CLP)').fill('20000')
  await release.getByRole('button', { name: 'Confirmar liberación' }).click()
  await expect(article(page, 'Dinero reservado')).toContainText('$60.000')
  await expect(page.getByRole('region', { name: 'Resumen de ahorro' })).toContainText('$650.000')

  await nav(page, 'Mis cuentas')
  await expect(article(page, 'Banco de prueba')).toContainText('$510.000')
  await expect(article(page, 'Efectivo')).toContainText('$200.000')
  await nav(page, 'Movimientos')
  const totals = page.getByRole('region', { name: 'Resumen del período' })
  for (const amount of ['$300.000', '$90.000', '$210.000']) await expect(totals).toContainText(amount)
  await nav(page, 'Presupuestos')
  await expect(article(page, 'Alimentación')).toContainText('$50.000')
  await expect(article(page, 'Alimentación')).toContainText('50 %')
  await nav(page, 'Gastos hormiga')
  await expect(page.getByText('Aún no hay gastos incluidos en el análisis de este período.')).toBeVisible()
  await nav(page, 'Salud financiera')
  const health = page.getByRole('region', { name: 'Indicadores complementarios' })
  for (const amount of ['$210.000', '$710.000', '$60.000', '$650.000', '$50.000']) await expect(health).toContainText(amount)
  await nav(page, 'Asistente IA')
  await page.getByRole('button', { name: 'Configurar Situación financiera' }).click()
  await page.getByRole('button', { name: 'Revisar solicitud' }).click()
  await page.getByRole('button', { name: 'Generar análisis' }).click()
  await page.getByRole('button', { name: 'Continuar solo con demo' }).click()
  const report = page.getByRole('region', { name: 'Situación financiera', exact: true })
  for (const amount of ['$300.000', '$90.000', '$210.000', '$710.000', '$60.000', '$650.000']) await expect(report).toContainText(amount)
  await page.goto('/#configuracion?seccion=datos')
  await page.getByRole('button', { name: 'Preparar exportación' }).click()
  await expect(page.getByRole('region', { name: 'Vista previa de exportación' })).toContainText('4 registros')
  await nav(page, 'Dashboard')
  for (const amount of ['$710.000', '$300.000', '$90.000']) await expect(dashboard(page)).toContainText(amount)
  await expect(page.getByRole('region', { name: 'Resumen de metas de ahorro' })).toContainText('$650.000')

  const originalDemo = await browser.newPage()
  try {
    await originalDemo.clock.setFixedTime(new Date(date + 'T12:00:00Z'))
    await originalDemo.goto(new URL('/', page.url()).href)
    await expect(dashboard(originalDemo)).toContainText('$2.485.600')
  } finally { await originalDemo.close() }
})
