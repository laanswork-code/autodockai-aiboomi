/*
 * Control room state: the decision feed, the operator review queue, the
 * scenario being played and the towers' pallets. Tower state is kept in the
 * SiteState shape so api.ts can send it as-is.
 */
import { create } from 'zustand'
import { TODAY_BAYS } from '../config/site'
import type { TowerLoad } from '../scene/RotaryTower'
import { nearestFreePallet } from './baseline.ts'
import type { Arrival, DecisionKind, DecisionSet, DecisionValues, PalletState, ScenarioName, SiteState, TowerState } from './types.ts'
import { PALLETS_PER_TOWER } from './types.ts'

export type Resolution = 'approved' | 'overridden' | 'cleared'

export interface FeedItem {
  arrival: Arrival
  decisions: DecisionSet
  /** The rules policy on the same state, used when the operator overrides. */
  rules: DecisionSet
  /** What the site actually acts on: the decision, or the operator's correction. */
  final: DecisionValues
  resolved: Partial<Record<DecisionKind, Resolution>>
}

export type ServerStatus = 'unknown' | 'up' | 'down'
type Towers = [TowerState, TowerState]
type PerTower<T> = [T, T]

/**
 * A decision waits for an operator when Jev was unsure, and also when the
 * anomaly check raised a flag: a flagged car is held for a human either way.
 */
export const needsReview = (item: FeedItem, kind: DecisionKind) =>
  !item.resolved[kind] && (item.decisions[kind].mode === 'review' || (kind === 'anomaly' && item.decisions.anomaly.value.flag))

/**
 * Cars already on the towers when a scenario starts. Parking.tsx preloads
 * 7 + the rest of the strip's cars from the ground pallet up; this mirrors it.
 */
const RESIDENTS: PerTower<number> = [7, TODAY_BAYS.length - 7]

function freshTowers(): Towers {
  const tower = (id: 0 | 1): TowerState => ({
    id,
    palletAtDoor: 0,
    pallets: Array.from({ length: PALLETS_PER_TOWER }, (_, index): PalletState => ({
      index, occupiedBy: index < RESIDENTS[id] ? `resident-${id}-${index}` : null, expectedOut: null, charging: false,
    })),
  })
  return [tower(0), tower(1)]
}

/** Returns new towers with one pallet changed. */
function patchPallet(towers: Towers, tower: 0 | 1, pallet: number, patch: Partial<PalletState>, door?: number): Towers {
  const next = [...towers] as Towers
  const t = towers[tower]
  next[tower] = {
    ...t,
    palletAtDoor: door ?? t.palletAtDoor,
    pallets: t.pallets.map((p) => (p.index === pallet ? { ...p, ...patch } : p)),
  }
  return next
}

const COLORS = ['#f2f2f0', '#1b1c1f', '#a9adb2', '#2a3f6a', '#6b6e73', '#7a1e22', '#f2f2f0', '#3d5a40']
function carFor(arrival: Arrival): TowerLoad {
  let h = 0
  for (const ch of arrival.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  // robotaxis wear the fleet's white
  const color = arrival.vehicle.fleet === 'robotaxi' ? '#f2f2f0' : COLORS[h % COLORS.length]
  return { kind: /seal/i.test(arrival.vehicle.model) ? 'seal' : 'atto', color }
}

interface ControlState {
  scenario: ScenarioName | null
  /** Bumped on every start or reset so a late server reply for an old run is dropped. */
  run: number
  playing: boolean
  /** Waiting on a decision for the next arrival. */
  busy: boolean
  /** Index of the next arrival to play. */
  cursor: number
  /** Newest first. */
  feed: FeedItem[]
  server: ServerStatus
  towers: Towers
  /** Cars the decisions have docked, by pallet; shown on top of the preloaded ones. */
  cars: PerTower<Record<number, TowerLoad>>
  /** Pallet each tower should bring to its door; null holds still. */
  door: PerTower<number | null>

  start: (scenario: ScenarioName) => void
  reset: () => void
  setPlaying: (playing: boolean) => void
  setBusy: (busy: boolean) => void
  setServer: (server: ServerStatus) => void
  ingest: (item: Omit<FeedItem, 'final' | 'resolved'>) => void
  resolve: (arrivalId: string, kind: DecisionKind, action: 'approve' | 'override') => void
}

const idle = () => ({
  playing: false, busy: false, cursor: 0, feed: [] as FeedItem[], towers: freshTowers(),
  cars: [{}, {}] as PerTower<Record<number, TowerLoad>>, door: [null, null] as PerTower<number | null>,
})

/** Dock the car: the pallet is taken, its charger set, and its tower turns it to the door. */
function dock(s: ControlState, item: FeedItem): Partial<ControlState> {
  const { tower, pallet } = item.final.bay
  const charging = item.final.charge === 'now' && !needsReview(item, 'charge')
  const expectedOut = item.arrival.plannedStayMin === null ? null : item.arrival.t + item.arrival.plannedStayMin
  const cars = [...s.cars] as ControlState['cars']
  cars[tower] = { ...cars[tower], [pallet]: carFor(item.arrival) }
  const door = [...s.door] as ControlState['door']
  door[tower] = pallet
  return { towers: patchPallet(s.towers, tower, pallet, { occupiedBy: item.arrival.id, charging, expectedOut }, pallet), cars, door }
}

const replaceItem = (feed: FeedItem[], item: FeedItem) => feed.map((f) => (f.arrival.id === item.arrival.id ? item : f))

export const useControlStore = create<ControlState>()((set) => ({
  scenario: null,
  run: 0,
  server: 'unknown',
  ...idle(),

  start: (scenario) => set((s) => ({ ...idle(), scenario, run: s.run + 1, playing: true })),
  reset: () => set((s) => ({ ...idle(), scenario: null, run: s.run + 1 })),
  setPlaying: (playing) => set({ playing }),
  setBusy: (busy) => set({ busy }),
  setServer: (server) => set({ server }),

  ingest: ({ arrival, decisions, rules }) => set((s) => {
    const item: FeedItem = {
      arrival, decisions, rules, resolved: {},
      final: { bay: decisions.bay.value, charge: decisions.charge.value, price: decisions.price.value, anomaly: decisions.anomaly.value },
    }
    const base = { feed: [item, ...s.feed], cursor: s.cursor + 1, busy: false }
    if (!needsReview(item, 'bay')) return { ...base, ...dock(s, item) }
    // Hold the pallet while the operator decides, so the next car is not sent to it.
    const { tower, pallet } = item.final.bay
    return { ...base, towers: patchPallet(s.towers, tower, pallet, { occupiedBy: arrival.id }) }
  }),

  resolve: (arrivalId, kind, action) => set((s) => {
    const found = s.feed.find((f) => f.arrival.id === arrivalId)
    if (!found || found.resolved[kind]) return {}
    const sameAsRules = JSON.stringify(found.rules[kind].value) === JSON.stringify(found.decisions[kind].value)
    let resolution: Resolution = action === 'approve' ? 'approved' : 'overridden'
    const final = { ...found.final }
    if (action === 'override') {
      if (kind === 'anomaly' && sameAsRules) {
        // Rules agree with the flag, so the only correction left is the operator clearing it.
        final.anomaly = { ...final.anomaly, flag: false }
        resolution = 'cleared'
      } else {
        Object.assign(final, { [kind]: found.rules[kind].value })
      }
    }
    let towers = s.towers
    if (kind === 'bay' && action === 'override') {
      // Free the held pallet; take the rules pallet, or the nearest free one if it has filled since.
      const held = found.final.bay
      towers = patchPallet(towers, held.tower, held.pallet, { occupiedBy: null })
      const want = final.bay
      if (towers[want.tower].pallets[want.pallet].occupiedBy) {
        // nearestFreePallet only reads the towers
        final.bay = nearestFreePallet({ towers } as SiteState) ?? held
      }
    }
    const item: FeedItem = { ...found, final, resolved: { ...found.resolved, [kind]: resolution } }
    const feed = replaceItem(s.feed, item)
    if (kind === 'bay') return { feed, ...dock({ ...s, towers }, item) }
    if (kind === 'charge' && !needsReview(item, 'bay')) {
      return { feed, towers: patchPallet(towers, final.bay.tower, final.bay.pallet, { charging: final.charge === 'now' }) }
    }
    return { feed }
  }),
}))
