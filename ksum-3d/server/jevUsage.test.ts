import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { createJevDecider } from './jevDecider.ts'
import { createUsageCounter, JEV_USD_PER_DECISION } from './jevUsage.ts'
import { fakeClient, liveSample } from './fixtures/fake.ts'
import { quickStop, sampleState } from './fixtures/sample.ts'

const state = sampleState()

describe('jev usage counter', () => {
  test('starts at zero with no average', () => {
    assert.deepEqual(createUsageCounter().snapshot(), {
      calls: 0, failures: 0, decisions: 0, inputTokens: null, outputTokens: null,
      usdPerDecision: JEV_USD_PER_DECISION, costUsd: 0, avgLatencyMs: null,
    })
  })

  test('adds up calls, decisions, tokens, cost and mean latency', () => {
    const u = createUsageCounter()
    u.record({ decisions: 5, latencyMs: 100, usage: { input_tokens: 300, output_tokens: 20 } })
    u.record({ decisions: 3, latencyMs: 201, usage: { input_tokens: 200, output_tokens: null } })
    u.fail()
    const s = u.snapshot()
    assert.equal(s.calls, 2)
    assert.equal(s.failures, 1)
    assert.equal(s.decisions, 8)
    assert.equal(s.inputTokens, 500)
    assert.equal(s.outputTokens, 20)
    assert.equal(s.costUsd, 0.00064)
    assert.equal(s.avgLatencyMs, 151)
  })

  test('cost carries no floating point noise', () => {
    const u = createUsageCounter()
    for (let i = 0; i < 6; i++) u.record({ decisions: 4, latencyMs: 100, usage: { input_tokens: 1, output_tokens: 1 } })
    assert.equal(u.snapshot().costUsd, 0.00192)
  })

  test('a snapshot is a copy', () => {
    const u = createUsageCounter()
    const before = u.snapshot()
    u.record({ decisions: 4, latencyMs: 90, usage: { input_tokens: null, output_tokens: null } })
    assert.equal(before.calls, 0)
    assert.equal(u.snapshot().inputTokens, null, 'tokens stay unknown while no response reports them')
  })

  test('the decider records one call per real Jev answer, and failures apart', async () => {
    const usage = createUsageCounter()
    let fail = false
    const client = fakeClient(() => (fail ? new Error('down') : liveSample('a-quick').answers))
    const decider = createJevDecider({ client, usage })
    await decider.decide(quickStop, state)
    const asked = Object.keys(client.calls[0].request.questions).length
    fail = true
    await decider.decide(quickStop, state)
    const s = usage.snapshot()
    assert.equal(s.calls, 1)
    assert.equal(s.failures, 1)
    assert.equal(s.decisions, asked)
    assert.equal(s.inputTokens, 1, 'from the fake client usage')
    assert.ok(s.avgLatencyMs !== null && s.avgLatencyMs >= 0)
  })

  test('cache hits are not counted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'jev-usage-'))
    try {
      const usage = createUsageCounter()
      const client = fakeClient(() => liveSample('a-quick').answers)
      const decider = createJevDecider({ client, usage, cachePath: join(dir, 'c.json') })
      await decider.decide(quickStop, state)
      await decider.decide(quickStop, state)
      assert.equal(usage.snapshot().calls, 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
