import assert from 'node:assert/strict'
import { test } from 'node:test'
import { book, heldAt, type Hold } from './bookings.ts'
import { PALLETS_PER_TOWER } from './types.ts'

const h = (tower: 0 | 1, pallet: number, from: number, to: number): Hold => ({ tower, pallet, from, to, carId: `${tower}-${pallet}-${from}` })
const everyPallet = (from: number, to: number) =>
  ([0, 1] as const).flatMap((tower) => Array.from({ length: PALLETS_PER_TOWER }, (_, p) => h(tower, p, from, to)))

test("books Jev's pick when it is free for the whole stay", () => {
  const r = book([h(0, 3, 0, 100)], { carId: 'c', from: 100, to: 200, prefer: { tower: 0, pallet: 3 } })
  assert.ok(r.ok)
  assert.deepEqual([r.hold.tower, r.hold.pallet, r.moved], [0, 3, false])
})

test('never double-books a pallet: a taken pick moves to the next free pallet', () => {
  const r = book([h(1, 6, 50, 150)], { carId: 'c', from: 100, to: 200, prefer: { tower: 1, pallet: 6 } })
  assert.ok(r.ok)
  assert.equal(r.moved, true)
  assert.notDeepEqual([r.hold.tower, r.hold.pallet], [1, 6])
  assert.equal(r.hold.tower, 1, 'prefers the same tower')
})

test('a full site is not overbooked: it offers the earliest time a pallet frees up', () => {
  const holds = everyPallet(0, 300)
  holds[7] = { ...holds[7], to: 130 }
  const r = book(holds, { carId: 'c', from: 100, to: 200, prefer: { tower: 0, pallet: 0 } })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.nextFrom, 130)
  assert.equal(heldAt(holds, 120), 2 * PALLETS_PER_TOWER)
  assert.equal(heldAt(holds, 140), 2 * PALLETS_PER_TOWER - 1)
})
