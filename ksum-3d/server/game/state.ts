/*
 * The shared world of the parking game: two rotary towers of 20 pallets and
 * the bookings against them. Pure functions over a plain object, so the
 * socket server stays thin and this part is tested on its own.
 *
 * Bookings are keyed by number plate, not by connection: log in again with
 * the same plate and your parked car is still yours to retrieve.
 */

import type { Booking, CarKind, PlayerStats, TowerState as Tower, WorldState as World } from '../../src/game/protocol.ts'
export type { World }

export const PALLETS = 20
type Result<T> = T | { error: string }

const NPC_COLORS = ['#f2f2f0', '#1b1c1f', '#a9adb2', '#2a3f6a', '#6b6e73', '#7a1e22']

/** Upper case, single spaces, letters and digits only, 4 to 13 characters; null if it is not a plate. */
export function normalisePlate(raw: string): string | null {
  const p = raw.toUpperCase().trim().replace(/\s+/g, ' ')
  return /^[A-Z0-9 ]{4,13}$/.test(p) ? p : null
}

/** Two towers with `seed[k]` resident cars on their lowest pallets; each door waits on its first empty pallet. */
export function createWorld(seed: [number, number] = [6, 5]): World {
  const tower = (k: number, n: number): Tower => {
    const pallets = Array.from({ length: PALLETS }, (_, i) => i < n
      ? { plate: `KL 07 R ${1000 + k * 100 + i}`, kind: (i % 2 ? 'atto' : 'seal') as CarKind, color: NPC_COLORS[(i + k) % NPC_COLORS.length] }
      : null)
    return { pallets, door: Math.min(n, PALLETS - 1) }
  }
  return { towers: [tower(0, seed[0]), tower(1, seed[1])], bookings: {}, stats: {} }
}

const reserved = (w: World, k: number) => new Set(Object.values(w.bookings).filter((b) => b.tower === k).map((b) => b.pallet))
const freePallets = (w: World, k: 0 | 1) => {
  const taken = reserved(w, k)
  return w.towers[k].pallets.flatMap((p, i) => (p === null && !taken.has(i) ? [i] : []))
}
/** Steps round the chain between two pallets, the short way. */
const chainGap = (a: number, b: number) => { const d = Math.abs(a - b) % PALLETS; return Math.min(d, PALLETS - d) }

/** Reserve a pallet in the emptier tower, the one nearest its door, and turn the tower to it. */
export function book(w: World, plate: string, now = Date.now()): Result<Booking> {
  const had = w.bookings[plate]
  if (had) return had
  const free = ([0, 1] as const).map((k) => freePallets(w, k))
  const k: 0 | 1 = free[1].length > free[0].length ? 1 : 0
  if (!free[k].length) return { error: 'Both towers are full' }
  const door = w.towers[k].door
  const pallet = free[k].reduce((best, i) => (chainGap(i, door) < chainGap(best, door) ? i : best))
  const b: Booking = { plate, tower: k, pallet, status: 'booked', at: now }
  w.bookings[plate] = b
  w.towers[k].door = pallet
  return b
}

/** The car is on its pallet: load it, score the hand-over, then bring the next empty pallet down for whoever comes next. */
export function park(w: World, plate: string, car: { kind: CarKind; color: string }, now = Date.now(), name = plate): Result<Booking> {
  const b = w.bookings[plate]
  if (!b || b.status !== 'booked') return { error: 'No booking waiting for this car' }
  const t = w.towers[b.tower]
  t.pallets[b.pallet] = { plate, kind: car.kind, color: car.color }
  b.status = 'parked'
  const ms = Math.max(0, now - b.at)
  const had = w.stats[plate]
  w.stats[plate] = { name, parks: (had?.parks ?? 0) + 1, bestMs: had ? Math.min(had.bestMs, ms) : ms }
  const next = freePallets(w, b.tower)
  if (next.length) t.door = next.reduce((best, i) => (chainGap(i, b.pallet) < chainGap(best, b.pallet) ? i : best))
  return b
}

/** Bring a parked car's pallet back down to the door. */
export function retrieve(w: World, plate: string): Result<Booking> {
  const b = w.bookings[plate]
  if (!b || b.status === 'booked') return { error: 'No parked car for this plate' }
  b.status = 'retrieving'
  w.towers[b.tower].door = b.pallet
  return b
}

/** True once the tower has been told to bring this car to its door. */
export const readyToCollect = (w: World, plate: string) => {
  const b = w.bookings[plate]
  return !!b && b.status === 'retrieving' && w.towers[b.tower].door === b.pallet
}

/** The car has driven out: free its pallet and close the booking. Returns the car that left. */
export function collected(w: World, plate: string): Result<{ kind: CarKind; color: string }> {
  const b = w.bookings[plate]
  if (!b || b.status !== 'retrieving') return { error: 'This car is not being retrieved' }
  const car = w.towers[b.tower].pallets[b.pallet]
  w.towers[b.tower].pallets[b.pallet] = null
  delete w.bookings[plate]
  return car ? { kind: car.kind, color: car.color } : { kind: 'seal', color: '#f2f2f0' }
}

/** A booking that never parked is released when its driver leaves. */
export function release(w: World, plate: string) {
  if (w.bookings[plate]?.status === 'booked') delete w.bookings[plate]
}

export interface BoardEntry extends PlayerStats { plate: string }

/** Top `n` drivers: most parks first, then the fastest hand-over. */
export function leaderboard(w: World, n = 10): BoardEntry[] {
  return Object.entries(w.stats)
    .map(([plate, st]) => ({ plate, ...st }))
    .sort((a, b) => b.parks - a.parks || a.bestMs - b.bestMs)
    .slice(0, n)
}
