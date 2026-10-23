import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, test } from 'node:test'
import { createJevDecider, JEV_MODEL } from './jevDecider.ts'
import { fakeClient, liveSample } from './fixtures/fake.ts'
import { overnight, quickStop, sampleState } from './fixtures/sample.ts'

const state = sampleState()
const tmp = mkdtempSync(join(tmpdir(), 'jev-test-'))
after(() => rmSync(tmp, { recursive: true, force: true }))

describe('jevDecider', () => {
  test('one Jev request per arrival, mapped to Jev decisions', async () => {
    const client = fakeClient(() => liveSample('a-quick').answers)
    const d = await createJevDecider({ client }).decide(quickStop, state)
    assert.equal(client.calls.length, 1)
    assert.equal(client.calls[0].request.model, JEV_MODEL)
    assert.ok(client.calls[0].options?.signal, 'every call carries a timeout signal')
    for (const x of Object.values(d)) assert.equal(x.source, 'jev')
  })

  test('falls back to the rules policy when Jev errors', async () => {
    const errors: unknown[] = []
    const client = fakeClient(() => new Error('503 from TypeSafe'))
    const d = await createJevDecider({ client, onFallback: (e) => errors.push(e) }).decide(quickStop, state)
    assert.equal(errors.length, 1)
    for (const x of Object.values(d)) {
      assert.equal(x.source, 'rules')
      assert.match(x.why, /rules fallback/)
    }
  })

  test('falls back when Jev runs past the timeout', async () => {
    const client = fakeClient(() => 'hang')
    const started = performance.now()
    const d = await createJevDecider({ client, timeoutMs: 50 }).decide(quickStop, state)
    assert.ok(performance.now() - started < 1000)
    assert.equal(d.bay.source, 'rules')
  })

  test('falls back when the response is malformed', async () => {
    const client = fakeClient(() => ({}))
    const d = await createJevDecider({ client }).decide(quickStop, state)
    assert.equal(d.price.source, 'rules')
  })

  test('the disk cache replays identical requests without calling Jev again', async () => {
    const cachePath = join(tmp, 'cache.json')
    const client = fakeClient((r) => liveSample(JSON.stringify(r.state).includes('overnight') ? 'a-overnight' : 'a-quick').answers)
    const first = createJevDecider({ client, cachePath })
    const a = await first.decide(quickStop, state)
    await first.decide(quickStop, state)
    assert.equal(client.calls.length, 1)
    assert.ok(existsSync(cachePath))

    // a fresh decider (e.g. the next simulator run) reads the same file
    const again = await createJevDecider({ client, cachePath }).decide(quickStop, state)
    assert.equal(client.calls.length, 1)
    assert.deepEqual(again, a)

    await first.decide(overnight, state)
    assert.equal(client.calls.length, 2, 'a different request is a cache miss')
  })

  test('errors are never cached', async () => {
    const cachePath = join(tmp, 'cache-errors.json')
    let fail = true
    const client = fakeClient(() => (fail ? new Error('down') : liveSample('a-quick').answers))
    const decider = createJevDecider({ client, cachePath })
    assert.equal((await decider.decide(quickStop, state)).bay.source, 'rules')
    fail = false
    assert.equal((await decider.decide(quickStop, state)).bay.source, 'jev')
    assert.equal(client.calls.length, 2)
  })
})
