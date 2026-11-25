import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FinancialRecords } from '../src/features/dashboard/model.ts'
import { changeCategory, filterCategories, normalizeCategoryName, readCategories, saveCategory, validateCategory, type CategoryFormData } from '../src/features/categories/category-model.ts'
import { mayGenerateAnalysis } from '../src/features/assistant/assistant-model.ts'
import { initialDraft } from '../src/features/assistant/assistant-request.ts'
import { defaultNotifications, defaultPreferences, notificationsFor, passwordIssue, validateDetection, validateExport, validateFinancial, validateRegional } from '../src/features/settings/preferences-model.ts'
import { createSettingsRepository, readVisualPreferences } from '../src/features/settings/settings-data.ts'
import { prepareExport } from '../src/features/settings/settings-export.ts'

const today = '2026-11-25'
const stamp = today + 'T16:00:00.000Z'
const empty: FinancialRecords = { accounts: [], movements: [], budgets: [], commitments: [], adjustments: [], savingsGoals: [], reservations: [], usedAccountIds: new Set() }
const blank: CategoryFormData = { name: '  CuÍdado   personal ', type: 'gasto', icon: 'health', color: '#1A2332', description: '' }

test('normaliza categorías por tipo y conserva nombres e identificadores en el historial', () => {
  assert.equal(normalizeCategoryName(blank.name), 'cuidado personal')
  const created = saveCategory(empty, blank, 'custom', stamp, false)
  const catalog = readCategories(created)
  assert.equal(catalog.find(item => item.id === 'custom')?.name, 'CuÍdado personal')
  assert.match(validateCategory({ ...blank, name: 'CUIDADO PERSONAL' }, catalog).name!, /activa/)
  assert.equal(validateCategory({ ...blank, type: 'ingreso' }, catalog).name, undefined)
  assert.ok(validateCategory({ ...blank, type: 'ingreso' }, catalog, catalog.at(-1)).type)
  const archived = changeCategory(created, 'custom', 'archive')
  assert.equal(filterCategories(readCategories(archived), 'gasto', true).some(item => item.id === 'custom'), false)
  assert.equal(filterCategories(readCategories(archived), 'gasto', false).some(item => item.id === 'custom'), true)
  const conflict = saveCategory(archived, { ...blank, name: 'Cuidado personal' }, 'new', stamp, false)
  assert.throws(() => changeCategory(conflict, 'custom', 'restore'), /activa/)
  assert.ok(filterCategories(readCategories(changeCategory(archived, 'custom', 'restore')), 'gasto', true).some(item => item.id === 'custom'))
  assert.equal(readCategories(changeCategory(archived, 'custom', 'delete')).some(item => item.id === 'custom'), false)
})

test('bloquea el borrado con referencias financieras y el archivo con compromisos pendientes', () => {
  const source = saveCategory(empty, blank, 'custom', stamp, false)
  const budget = { id: 'p', categoryId: 'custom', period: '2026-11' as const, limit: 10, warningThreshold: 80, description: '' }
  assert.throws(() => changeCategory({ ...source, budgets: [budget] }, 'custom', 'delete'), /referencias/)
  assert.throws(() => changeCategory({ ...source, usedCategoryIds: new Set(['custom']) }, 'custom', 'delete'), /referencias/)
  const saved = { ...source, commitments: [{ id: 'obligation', type: 'pago' as const, status: 'pendiente' as const, name: 'Pago',
    dueDate: today, amount: 10, accountId: 'a', categoryId: 'custom', currency: 'CLP' as const, createdAt: stamp, userId: 'demo', notes: '' }] }
  assert.throws(() => changeCategory(saved, 'custom', 'archive'), /pendientes/)
  assert.throws(() => changeCategory(saved, 'custom', 'delete'), /referencias/)
})

test('valida valores financieros, zonas, detección y reglas independientes', async () => {
  assert.deepEqual(validateFinancial(defaultPreferences.financial), {})
  assert.deepEqual(Object.keys(validateFinancial({ ...defaultPreferences.financial, budgetWarning: -5, minimumFree: 1.25 })).sort(), ['budgetWarning', 'minimumFree'])
  assert.match(validateRegional({ ...defaultPreferences.regional, timeZone: 'Invalid/Zone' }), /zona horaria/)
  assert.ok(validateDetection({ ...defaultPreferences.detection, minimumCount: 0 }))
  const storage = new Map<string, string>()
  const repo = createSettingsRepository({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) } })
  await assert.rejects(repo.updateProfile(' '), /nombre/)
  assert.equal((await repo.updateProfile('  Luz   Lara ')).name, 'Luz Lara')
  const financial = { ...defaultPreferences.financial, budgetWarning: 69, minimumFree: 500, horizon: 60 as const }
  await repo.updatePreference('financial', financial)
  assert.equal((await repo.preferences()).financial, financial)
  assert.deepEqual(initialDraft('purchase', today, (await repo.preferences()).financial), { date: today, minimumFree: '500', horizon: '60' })
  assert.equal(storage.size, 0)
  await repo.updatePreference('privacy', { hideOnStart: true })
  assert.ok(readVisualPreferences({ getItem: key => storage.get(key) ?? null }).privacy.hideOnStart)
  assert.equal(readVisualPreferences({ getItem() { throw new Error('disabled') } }).privacy.hideOnStart, false)
  const choices = [{ kind: 'due' as const, id: 1 }, { kind: 'budgetExceeded' as const, id: 2 }]
  const rules = { ...defaultNotifications, daysAhead: 7 as const, rules: { ...defaultNotifications.rules, due: false } }
  await repo.updateNotifications(rules)
  assert.deepEqual(notificationsFor(choices, await repo.notifications()), [choices[1]])
  assert.deepEqual(notificationsFor(choices, { ...rules, enabled: false }), [])
  await assert.rejects(repo.updateNotifications({ ...rules, rules: { ...rules.rules, summary: true } }), /tipos/)
})

test('exporta el catálogo y los movimientos de la misma fuente y neutraliza celdas con fórmulas', () => {
  const source = saveCategory(empty, { ...blank, name: ' =FORMULA()' }, 'c', stamp, false)
  const mine: FinancialRecords = { ...source, movements: [
    { id: 'visible', type: 'gasto', accountId: 'caja', categoryId: 'c', date: today, amount: 200, description: ' =1+2', classification: 'necesario' },
    { id: 'old', type: 'gasto', accountId: 'caja', categoryId: 'c', date: '2026-10-01', amount: 200, description: 'Fuera', classification: 'automatica' },
  ] }
  const result = prepareExport({ type: 'movements', from: today, to: today }, mine, new Set(), today)
  assert.equal(result.rows, 1)
  assert.match(result.filename, /^billetera-demo/)
  assert.match(result.csv, /"\t=1\+2"/)
  assert.match(result.csv, /"\t=FORMULA\(\)"/)
  assert.match(result.csv, /"200";"CLP";"Gasto pequeño necesario"/)
  assert.doesNotMatch(result.csv, /Fuera/)
  const range = { from: today, to: today }
  for (const type of ['accounts','categories','budgets','commitments','savings'] as const) {
    assert.ok(prepareExport({ ...range, type }, mine, new Set(), today).csv.startsWith('\uFEFF'))
  }
  assert.ok(validateExport({ type: 'budgets', from: '2026-11-30', to: today }, today))
})

test('bloquea nuevas solicitudes tras revocar IA y valida secretos de demostración sin conservarlos', async () => {
  assert.equal(mayGenerateAnalysis(true, 'declined', 'demo'), true)
  assert.equal(mayGenerateAnalysis(true, 'declined', 'ai'), false)
  assert.equal(mayGenerateAnalysis(true, 'revoked', 'demo'), false)
  assert.equal(mayGenerateAnalysis(false, 'allowed', 'demo'), false)
  assert.equal(mayGenerateAnalysis(true, 'allowed', 'ai'), true)
  assert.match(passwordIssue('actual-ficticia', 'diferente-123!', 'otra'), /coincidir/)
  assert.equal(passwordIssue('actual-ficticia', 'diferente-123!', 'diferente-123!'), '')
  await assert.rejects(createSettingsRepository().preparePasswordChange(), /cuenta real/)
})
