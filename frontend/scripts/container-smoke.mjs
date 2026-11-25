import assert from 'node:assert/strict'
import console from 'node:console'
import process from 'node:process'
import { URL } from 'node:url'
import { chromium } from '@playwright/test'

const port = process.argv[2] ?? '8080'
assert.match(port, /^[1-9]\d{0,4}$/)
assert.ok(Number(port) <= 65_535)
const address = new URL(`http://127.0.0.1:${port}`)
const routes = {
  '/': 'dashboard-title',
  '/movimientos': 'movements-title',
  '/cuentas': 'accounts-title',
  '/presupuestos': 'budgets-title',
  '/compromisos': 'commitments-title',
  '/hormiga': 'micro-expenses-title',
  '/metas': 'savings-title',
  '/salud': 'financial-health-title',
  '/asistente': 'assistant-title',
  '/configuracion': 'settings-title',
}

const health = await globalThis.fetch(new URL('/healthz', address))
assert.equal(health.status, 200)
assert.equal((await health.text()).trim(), 'ok')
const html = await globalThis.fetch(address)
assert.equal(html.status, 200)
const entry = (await html.text()).match(/src="(\/assets\/[^"\s]+\.js)"/)?.[1]
assert.ok(entry, 'La SPA debe referenciar un recurso JavaScript compilado')
const asset = await globalThis.fetch(new URL(entry, address))
assert.equal(asset.status, 200)
assert.match(asset.headers.get('cache-control') ?? '', /immutable/)
await asset.arrayBuffer()
for (const path of ['/graphql', '/graphql/invalid', '/assets/missing.js']) {
  const response = await globalThis.fetch(new URL(path, address))
  assert.equal(response.status, 404, path)
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })
try {
  const page = await browser.newPage({ reducedMotion: 'reduce' })
  const errors = []
  const network = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (new URL(request.url()).origin !== address.origin || ['xhr', 'fetch'].includes(request.resourceType())) network.push(request.url())
  })
  for (const [route, heading] of Object.entries(routes)) {
    const response = await page.goto(new URL(route, address).href)
    assert.equal(response.status(), 200, route)
    await page.locator(`#${heading}`).waitFor({ timeout: 10_000 })
  }
  await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('button', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('region', { name: 'Saldos del dashboard' }).getByText('$2.485.600', { exact: true }).waitFor({ timeout: 10_000 })
  assert.deepEqual(errors, [])
  assert.deepEqual(network, [])
  console.log('Nginx verificado. Salud, caché de recursos, rutas reservadas, diez pantallas y demo sin solicitudes de datos.')
} finally {
  await browser.close()
}
