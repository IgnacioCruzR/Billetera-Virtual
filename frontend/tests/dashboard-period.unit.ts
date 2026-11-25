import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dashboardPeriod, dashboardPeriodEndDates } from '../src/features/dashboard/financial-period.ts'

test('alinea dashboard y series con el corte financiero y una ventana histórica equivalente', () => {
  const month = dashboardPeriod('month', '2028-03-29')
  assert.deepEqual(month.current, { from: '2028-03-01', to: '2028-03-29' })
  assert.deepEqual(month.comparable, { from: '2028-02-01', to: '2028-02-29' })
  assert.equal(dashboardPeriod('month', '2028-03-30').comparable, null)
  assert.deepEqual(dashboardPeriod('quarter', '2026-02-06').comparable, { from: '2025-09-01', to: '2025-11-06' })
  assert.deepEqual(dashboardPeriod('year', '2026-03-12').comparable, { from: '2025-01-01', to: '2025-03-12' })
  assert.deepEqual(dashboardPeriodEndDates('quarter', '2028-03-12'), ['2028-01-31', '2028-02-29', '2028-03-12'])
  assert.deepEqual(dashboardPeriodEndDates('month', '2026-11-02'), ['2026-11-01', '2026-11-02'])
})
