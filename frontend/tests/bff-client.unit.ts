import assert from 'node:assert/strict'
import { test } from 'node:test'
import { gql } from '@apollo/client'
import { bffPath, closeBffSession, createBffClient } from '../src/app/bff-client.ts'
import { resolveDataMode } from '../src/app/data-mode.ts'

test('elige un modo explícito y rechaza los valores de configuración desconocidos', () => {
  assert.equal(resolveDataMode(undefined), 'demo')
  assert.equal(resolveDataMode('demo'), 'demo')
  assert.equal(resolveDataMode('integration'), 'integration')
  assert.equal(resolveDataMode('https://other.test/graphql'), 'invalid')
})

test('resuelve GraphQL por la ruta pública y elimina la caché entre sesiones sin volver a consultarla', async context => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async (input: string, options?: RequestInit) => {
    assert.equal(input, '/graphql')
    assert.equal(options?.credentials, 'same-origin')
    assert.equal(options?.redirect, 'error')
    return new Response(JSON.stringify({ data: { auditOnly: 'tenant-anterior' } }), { headers: { 'Content-Type': 'application/json' } })
  })
  const document = gql`query AuditOnly { auditOnly }`
  const first = createBffClient()
  assert.equal(bffPath, '/graphql')
  assert.equal(fetchMock.mock.callCount(), 0)
  assert.deepEqual((await first.query({ query: document })).data, { auditOnly: 'tenant-anterior' })
  assert.equal(fetchMock.mock.callCount(), 1)
  assert.deepEqual(first.readQuery({ query: document }), { auditOnly: 'tenant-anterior' })
  await closeBffSession(first)
  const next = createBffClient()
  assert.equal(first.readQuery({ query: document }), null)
  assert.equal(next.readQuery({ query: document }), null)
  assert.equal(fetchMock.mock.callCount(), 1)
  await closeBffSession(next)
})
