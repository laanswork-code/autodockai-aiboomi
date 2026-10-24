/*
 * Booking ledger: which pallet is promised to which car, and when. Jev picks
 * the pallet; the ledger makes sure no pallet is ever promised twice for
 * overlapping stays, so the site cannot be overbooked. Pure, runs in the
 * browser and in Node.
 */
import { stepsToDoor } from './baseline.ts'
import type { Minute } from './types.ts'
import { PALLETS_PER_TOWER } from './types.ts'

export interface Hold { tower: 0 | 1; pallet: number; from: Minute; to: Minute; carId: string }

export type BookResult =
  | { ok: true; hold: Hold; moved: boolean }
  | { ok: false; nextFrom: Minute }

const overlaps = (h: Hold, from: Minute, to: Minute) => h.from < to && from < h.to

const isFree = (holds: Hold[], tower: 0 | 1, pallet: number, from: Minute, to: Minute) =>
  !holds.some((h) => h.tower === tower && h.pallet === pallet && overlaps(h, from, to))

/** Pallets held at minute t. */
export const heldAt = (holds: Hold[], t: Minute) => holds.filter((h) => h.from <= t && t < h.to).length

/** Free pallets for [from, to), Jev's pick first, then its tower, then the nearest pallet to it. */
function freeFor(holds: Hold[], prefer: { tower: 0 | 1; pallet: number }, from: Minute, to: Minute) {
  const all = ([0, 1] as const).flatMap((tower) => Array.from({ length: PALLETS_PER_TOWER }, (_, pallet) => ({ tower, pallet })))
  return all
    .filter((p) => isFree(holds, p.tower, p.pallet, from, to))
    .sort((a, b) => Number(a.tower !== prefer.tower) - Number(b.tower !== prefer.tower)
      || stepsToDoor(prefer.pallet, a.pallet) - stepsToDoor(prefer.pallet, b.pallet))
}

/**
 * Hold a pallet for one stay. Jev's pick if it is free for the whole stay,
 * else the nearest free pallet. A full site gets no booking, only the earliest
 * time a pallet frees up for a stay of the same length.
 */
export function book(holds: Hold[], req: { carId: string; from: Minute; to: Minute; prefer: { tower: 0 | 1; pallet: number } }): BookResult {
  const [first] = freeFor(holds, req.prefer, req.from, req.to)
  if (first) {
    const moved = first.tower !== req.prefer.tower || first.pallet !== req.prefer.pallet
    return { ok: true, moved, hold: { ...first, from: req.from, to: req.to, carId: req.carId } }
  }
  const length = req.to - req.from
  const nextFrom = holds.map((h) => h.to).filter((t) => t > req.from).sort((a, b) => a - b)
    .find((t) => freeFor(holds, req.prefer, t, t + length).length > 0)
  return { ok: false, nextFrom: nextFrom ?? Math.max(req.from, ...holds.map((h) => h.to)) }
}
