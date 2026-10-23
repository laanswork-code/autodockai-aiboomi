/*
 * Rules-only decider. It is both the naive baseline the simulator compares Jev
 * against and the fallback the server uses when Jev is unavailable. Pure and
 * deterministic; runs in the browser and in Node.
 */
import type { Arrival, Decider, Decision, DecisionKind, DecisionSet, DecisionValues, SiteState } from './types.ts'
import { PALLETS_PER_TOWER } from './types.ts'

/** Pallet steps from the door, the shorter way round the loop. */
export const stepsToDoor = (palletAtDoor: number, pallet: number) => {
  const d = Math.abs(pallet - palletAtDoor) % PALLETS_PER_TOWER
  return Math.min(d, PALLETS_PER_TOWER - d)
}

const rule = <K extends DecisionKind>(kind: K, arrival: Arrival, value: DecisionValues[K], why: string): Decision<K> => ({
  kind, arrivalId: arrival.id, value, confidence: 1, source: 'rules', mode: 'auto', why, latencyMs: 0,
})

/** Nearest free pallet to a door, preferring the emptier tower. */
export function nearestFreePallet(state: SiteState): DecisionValues['bay'] | null {
  let best: { tower: 0 | 1; pallet: number; cost: number } | null = null
  for (const tower of state.towers) {
    const free = tower.pallets.filter((p) => !p.occupiedBy).length
    for (const p of tower.pallets) {
      if (p.occupiedBy) continue
      // a fuller tower is penalised so load spreads across both
      const cost = stepsToDoor(tower.palletAtDoor, p.index) + (PALLETS_PER_TOWER - free) * 0.1
      if (!best || cost < best.cost) best = { tower: tower.id, pallet: p.index, cost }
    }
  }
  return best && { tower: best.tower, pallet: best.pallet }
}

export function baselineDecisions(arrival: Arrival, state: SiteState): DecisionSet {
  const bay = nearestFreePallet(state) ?? { tower: 0 as const, pallet: 0 }
  // naive: every EV below 80% starts charging on arrival, whatever the tariff or grid
  const charge = arrival.vehicle.ev && arrival.vehicle.socPct < 80 ? 'now' as const : 'no_charge' as const
  const occupied = state.towers.reduce((a, t) => a + t.pallets.filter((p) => p.occupiedBy).length, 0)
  const price = state.queue > 5 || occupied > 0.85 * 2 * PALLETS_PER_TOWER ? 'peak' as const : 'standard' as const
  const plateDiffers = arrival.plateRead.text.replace(/\s/g, '').toUpperCase() !== arrival.bookedPlate.replace(/\s/g, '').toUpperCase()
  const paymentBad = arrival.payment.status !== 'ok'
  return {
    bay: rule('bay', arrival, bay, `Nearest free pallet: tower ${bay.tower + 1}, pallet ${bay.pallet + 1}`),
    charge: rule('charge', arrival, charge, charge === 'now' ? 'EV below 80%: charge on arrival' : 'Not charging'),
    price: rule('price', arrival, price, price === 'peak' ? 'Queue or occupancy high' : 'Standard rate'),
    anomaly: rule('anomaly', arrival, { plateMismatch: plateDiffers ? 1 : 0, paymentRisk: paymentBad ? 1 : 0, flag: plateDiffers || paymentBad },
      plateDiffers ? 'Camera plate differs from booking' : paymentBad ? `Payment ${arrival.payment.status}` : 'No anomaly'),
  }
}

export const baselineDecider: Decider = {
  name: 'baseline',
  decide: async (arrival, state) => baselineDecisions(arrival, state),
}
