import assert from 'node:assert/strict'
import { test } from 'node:test'
import { captionAt, chapterAt, clockAt, cruiseThenBrake, phoneAt, T } from './timeline.ts'

test('the phone follows the app order: book, arrive, dock, charge, pay', () => {
  const order = ['connect', 'plan', 'booked', 'gate', 'dock', 'charge', 'pay', 'upi', 'paid']
  const seen: string[] = []
  for (let t = 0; t < T.total; t += 0.1) { const s = phoneAt(t).step; if (seen.at(-1) !== s) seen.push(s) }
  assert.deepEqual(seen, order)
  assert.equal(phoneAt(T.pallet + 2).elapsedMs, 2000)
})

test('the drive covers its length and ends at rest', () => {
  assert.equal(cruiseThenBrake(15, 15, 29, 70), 0)
  assert.ok(Math.abs(cruiseThenBrake(29, 15, 29, 70) - 70) < 1e-9)
  const near = cruiseThenBrake(28.99, 15, 29, 70)
  assert.ok(70 - near < 0.001, 'speed is near zero at the stop')
  let last = -1
  for (let t = 15; t <= 29; t += 0.25) { const d = cruiseThenBrake(t, 15, 29, 70); assert.ok(d >= last); last = d }
})

test('chapters, captions and the clock line up', () => {
  assert.equal(chapterAt(0), -1)
  assert.equal(chapterAt(T.book), 0)
  assert.equal(chapterAt(T.pay + 1), 4)
  assert.equal(captionAt(1), null)
  assert.match(captionAt(T.gate + 1) ?? '', /vision model/)
  assert.ok(Math.abs(clockAt(T.gate) - (8 * 60 + 40)) < 1e-9)
  assert.equal(clockAt(T.pay + 1), 16 * 60 + 40)
})
