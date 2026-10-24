import { test } from 'node:test'
import assert from 'node:assert/strict'
import { book, collected, createWorld, normalisePlate, park, PALLETS, readyToCollect, retrieve, type World } from './state.ts'

const empty = (): World => createWorld([0, 0])

test('plates are upper-cased and single-spaced, and junk is refused', () => {
  assert.equal(normalisePlate(' kl 07  ab 1234 '), 'KL 07 AB 1234')
  assert.equal(normalisePlate('x'), null)
  assert.equal(normalisePlate('KL07<script>'), null)
})

test('a booking reserves a free pallet and turns that tower to it', () => {
  const w = empty()
  const b = book(w, 'KL 07 AB 1234')
  assert.ok(!('error' in b))
  assert.equal(b.status, 'booked')
  assert.equal(w.towers[b.tower].door, b.pallet)
  assert.equal(w.towers[b.tower].pallets[b.pallet], null)
})

test('two bookings never share a pallet, and the emptier tower is picked', () => {
  const w = createWorld([6, 2])
  const a = book(w, 'KL 01 A 1')
  const b = book(w, 'KL 01 A 2')
  assert.ok(!('error' in a) && !('error' in b))
  assert.equal(a.tower, 1)
  assert.notDeepEqual([a.tower, a.pallet], [b.tower, b.pallet])
})

test('booking twice with the same plate returns the same booking', () => {
  const w = empty()
  const a = book(w, 'KL 01 A 1')
  const b = book(w, 'KL 01 A 1')
  assert.deepEqual(a, b)
})

test('a full site refuses the booking', () => {
  const w = createWorld([PALLETS, PALLETS])
  assert.deepEqual(book(w, 'KL 01 A 1'), { error: 'Both towers are full' })
})

test('parking loads the pallet with the car, then the next empty pallet comes to the door', () => {
  const w = empty()
  const b = book(w, 'KL 01 A 1')
  assert.ok(!('error' in b))
  const r = park(w, 'KL 01 A 1', { kind: 'seal', color: '#ff0000' })
  assert.ok(!('error' in r))
  assert.equal(w.bookings['KL 01 A 1'].status, 'parked')
  assert.deepEqual(w.towers[b.tower].pallets[b.pallet], { plate: 'KL 01 A 1', kind: 'seal', color: '#ff0000' })
  assert.notEqual(w.towers[b.tower].door, b.pallet)
  assert.equal(w.towers[b.tower].pallets[w.towers[b.tower].door], null)
})

test('you cannot park without a booking, nor retrieve a car that is not parked', () => {
  const w = empty()
  assert.ok('error' in park(w, 'KL 01 A 1', { kind: 'seal', color: '#fff' }))
  book(w, 'KL 01 A 1')
  assert.ok('error' in retrieve(w, 'KL 01 A 1'))
})

test('retrieving brings the car pallet to the door, and collecting frees it', () => {
  const w = empty()
  const b = book(w, 'KL 01 A 1')
  assert.ok(!('error' in b))
  park(w, 'KL 01 A 1', { kind: 'atto', color: '#00f' })
  const r = retrieve(w, 'KL 01 A 1')
  assert.ok(!('error' in r))
  assert.equal(r.status, 'retrieving')
  assert.equal(w.towers[b.tower].door, b.pallet)
  assert.equal(readyToCollect(w, 'KL 01 A 1'), true)
  const c = collected(w, 'KL 01 A 1')
  assert.deepEqual(c, { kind: 'atto', color: '#00f' })
  assert.equal(w.towers[b.tower].pallets[b.pallet], null)
  assert.equal(w.bookings['KL 01 A 1'], undefined)
})

test('seeded cars fill the lowest pallets and the door starts on the first empty one', () => {
  const w = createWorld([3, 0])
  assert.ok(w.towers[0].pallets.slice(0, 3).every((p) => p !== null))
  assert.equal(w.towers[0].door, 3)
})
