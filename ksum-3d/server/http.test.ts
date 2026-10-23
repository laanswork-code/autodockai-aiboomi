import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'
import { baselineDecider } from '../src/control/baseline.ts'
import type { AuditEntry } from '../src/control/types.ts'
import { createHandler, parseDecideRequest } from './http.ts'
import { quickStop, sampleState } from './fixtures/sample.ts'

const audit: AuditEntry[] = []
const server = createServer(createHandler({
  decider: baselineDecider,
  appendAudit: async (e) => { audit.push(e) },
  readAudit: async (n) => audit.slice(-n),
}))
let base = ''
before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => server.close())

const post = (body: string) => fetch(`${base}/api/decide`, { method: 'POST', body, headers: { 'content-type': 'application/json' } })
const valid = () => ({ arrival: structuredClone(quickStop), state: sampleState() })

describe('POST /api/decide', () => {
  test('400 on bad JSON', async () => {
    const res = await post('{not json')
    assert.equal(res.status, 400)
    assert.match((await res.json() as { error: string }).error, /JSON/)
  })

  test('400 names the first bad field', async () => {
    const b = valid() as unknown as { arrival: Record<string, unknown> }
    b.arrival.payment = { method: 'cash', status: 'ok' }
    const res = await post(JSON.stringify(b))
    assert.equal(res.status, 400)
    assert.equal((await res.json() as { error: string }).error, 'invalid field: arrival.payment.method')
  })

  test('200 returns all four decisions and audits them', async () => {
    const before = audit.length
    const res = await post(JSON.stringify(valid()))
    assert.equal(res.status, 200)
    const { decisions } = await res.json() as { decisions: Record<string, { kind: string }> }
    assert.deepEqual(Object.keys(decisions).sort(), ['anomaly', 'bay', 'charge', 'price'])
    assert.equal(audit.length, before + 1)
    assert.equal(audit.at(-1)?.arrival.id, quickStop.id)
  })

  test('405 for GET', async () => {
    assert.equal((await fetch(`${base}/api/decide`)).status, 405)
  })
})

describe('GET routes', () => {
  test('health reports whether the key is set but never the key', async () => {
    const prev = process.env.TYPESAFE_API_KEY
    process.env.TYPESAFE_API_KEY = 'ts-secret-test-value'
    try {
      const res = await fetch(`${base}/api/health`)
      const text = await res.text()
      assert.equal(res.status, 200)
      assert.ok(!text.includes('ts-secret-test-value'))
      const body = JSON.parse(text) as { keySet: boolean; model: string; ok: boolean }
      assert.equal(body.keySet, true)
      assert.equal(body.ok, true)
      assert.ok(body.model.length > 0)
    } finally {
      if (prev === undefined) delete process.env.TYPESAFE_API_KEY
      else process.env.TYPESAFE_API_KEY = prev
    }
  })

  test('audit returns the last N entries', async () => {
    await post(JSON.stringify(valid()))
    const res = await fetch(`${base}/api/audit?limit=1`)
    const { entries } = await res.json() as { entries: AuditEntry[] }
    assert.equal(entries.length, 1)
  })

  test('unknown path is 404', async () => {
    assert.equal((await fetch(`${base}/api/nope`)).status, 404)
  })
})

describe('parseDecideRequest', () => {
  test('accepts a valid body and rejects wrong shapes', () => {
    assert.equal(typeof parseDecideRequest(valid()), 'object')
    assert.match(parseDecideRequest(null) as string, /JSON object/)
    const noTower = valid()
    ;(noTower.state as { towers: unknown[] }).towers = [noTower.state.towers[0]]
    assert.match(parseDecideRequest(noTower) as string, /state.towers/)
    const badPallet = valid()
    ;(badPallet.state.towers[1].pallets[3] as { charging: unknown }).charging = 'yes'
    assert.equal(parseDecideRequest(badPallet), 'invalid field: state.towers[1].pallets[3].charging')
    const badSoc = valid()
    badSoc.arrival.vehicle.socPct = 140
    assert.equal(parseDecideRequest(badSoc), 'invalid field: arrival.vehicle.socPct')
  })
})
