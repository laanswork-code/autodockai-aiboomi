import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { createEventBus, describeEvent, type JevEvent } from './eventBus.ts'

type Ping = { type: 'ping'; n: number } | { type: 'pong'; n: number }

describe('event bus', () => {
  test('delivers an event to the handlers for its type, in subscription order', () => {
    const bus = createEventBus<Ping>()
    const seen: string[] = []
    bus.on('ping', (e) => seen.push(`a${e.n}`))
    bus.on('ping', (e) => seen.push(`b${e.n}`))
    bus.on('pong', (e) => seen.push(`pong${e.n}`))
    bus.publish({ type: 'ping', n: 1 })
    assert.deepEqual(seen, ['a1', 'b1'])
  })

  test('onAny sees every event; unsubscribing stops delivery', () => {
    const bus = createEventBus<Ping>()
    const seen: string[] = []
    const off = bus.onAny((e) => seen.push(e.type))
    bus.publish({ type: 'ping', n: 1 })
    bus.publish({ type: 'pong', n: 2 })
    off()
    bus.publish({ type: 'ping', n: 3 })
    assert.deepEqual(seen, ['ping', 'pong'])
  })

  test('an event published from a handler runs after the current event has reached every handler', () => {
    const bus = createEventBus<Ping>()
    const seen: string[] = []
    bus.on('ping', (e) => { seen.push(`first ping${e.n}`); bus.publish({ type: 'pong', n: e.n }) })
    bus.on('ping', (e) => seen.push(`second ping${e.n}`))
    bus.on('pong', (e) => seen.push(`pong${e.n}`))
    bus.publish({ type: 'ping', n: 1 })
    assert.deepEqual(seen, ['first ping1', 'second ping1', 'pong1'])
    assert.deepEqual(bus.history().map((r) => [r.seq, r.event.type]), [[1, 'ping'], [2, 'pong']])
  })

  test('history numbers events in order and keeps only the newest', () => {
    const bus = createEventBus<Ping>({ keep: 3 })
    for (let n = 1; n <= 5; n++) bus.publish({ type: 'ping', n })
    assert.deepEqual(bus.history().map((r) => r.seq), [3, 4, 5])
    assert.deepEqual(bus.history().map((r) => (r.event as { n: number }).n), [3, 4, 5])
  })

  test('history is a new array after each publish and the same one between publishes', () => {
    const bus = createEventBus<Ping>()
    const before = bus.history()
    assert.equal(bus.history(), before)
    bus.publish({ type: 'ping', n: 1 })
    assert.notEqual(bus.history(), before)
    assert.equal(before.length, 0)
  })

  test('watch is told after each publish, so a UI can re-read history', () => {
    const bus = createEventBus<Ping>()
    let calls = 0
    const off = bus.watch(() => calls++)
    bus.publish({ type: 'ping', n: 1 })
    off()
    bus.publish({ type: 'ping', n: 2 })
    assert.equal(calls, 1)
  })

  test('a throwing handler does not stop the others or later events', () => {
    const bus = createEventBus<Ping>()
    const seen: number[] = []
    const errors: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => { errors.push(args) }
    try {
      bus.on('ping', () => { throw new Error('boom') })
      bus.on('ping', (e) => seen.push(e.n))
      bus.publish({ type: 'ping', n: 1 })
      bus.publish({ type: 'ping', n: 2 })
    } finally {
      console.error = original
    }
    assert.deepEqual(seen, [1, 2])
    assert.equal(errors.length, 2)
  })
})

describe('describeEvent', () => {
  test('gives one readable line per pipeline event', () => {
    const events: JevEvent[] = [
      { type: 'scenario_changed', scenario: 'rush_hour' },
      { type: 'scenario_changed', scenario: null },
      { type: 'pallet_to_door', arrivalId: 'r1', plate: 'KL 07 DA 3318', tower: 1, pallet: 4 },
      { type: 'charging_started', arrivalId: 'r1', plate: 'KL 07 DA 3318', tower: 1, pallet: 4 },
      { type: 'review_requested', arrivalId: 'r3', plate: 'KL 07 DE 5501', kind: 'anomaly' },
      { type: 'review_resolved', arrivalId: 'r3', plate: 'KL 07 DE 5501', kind: 'anomaly', action: 'override' },
    ]
    assert.deepEqual(events.map(describeEvent), [
      'Scenario: rush_hour',
      'Scenario reset',
      'KL 07 DA 3318: tower 2 brings pallet 5 to the door',
      'KL 07 DA 3318: charging on tower 2, pallet 5',
      'KL 07 DE 5501: anomaly held for an operator',
      'KL 07 DE 5501: operator override on anomaly',
    ])
  })
})
