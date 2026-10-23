/*
 * Hand-made site state and arrivals used by the smoke script and the tests.
 * Deterministic, so the recorded live response matches the request it came from.
 */
import type { Arrival, PalletState, SiteState, TowerState } from '../../src/control/types.ts'
import { PALLETS_PER_TOWER } from '../../src/control/types.ts'

const at = (h: number, m = 0) => h * 60 + m

function tower(id: 0 | 1, palletAtDoor: number, parked: Record<number, number | null>): TowerState {
  const pallets: PalletState[] = Array.from({ length: PALLETS_PER_TOWER }, (_, index) => {
    const out = parked[index]
    return out === undefined
      ? { index, occupiedBy: null, expectedOut: null, charging: false }
      : { index, occupiedBy: `parked-${id}-${index}`, expectedOut: out, charging: false }
  })
  return { id, palletAtDoor, pallets }
}

/** 17:05 on a weekday, rush hour, towers about two thirds full, 6 cars queued. */
export function sampleState(): SiteState {
  const parked0: Record<number, number | null> = {}
  const parked1: Record<number, number | null> = {}
  for (const i of [0, 2, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 17]) parked0[i] = i % 3 === 0 ? null : at(17, 30 + i * 4)
  for (const i of [1, 2, 3, 6, 7, 9, 10, 12, 16, 18, 19]) parked1[i] = i % 4 === 0 ? null : at(21, i)
  return {
    t: at(17, 5),
    towers: [tower(0, 3, parked0), tower(1, 8, parked1)],
    gridPriceInr: 11.5,
    offPeak: { priceInr: 6.2, from: at(22) },
    solarKw: 4,
    gridLimitKw: 60,
    loadKw: 44,
    queue: 6,
    scenario: 'rush_hour',
  }
}

/** A quick stop: low battery, leaving soon, clean plate and payment. */
export const quickStop: Arrival = {
  id: 'a-quick',
  t: at(17, 5),
  bookedPlate: 'KL07CD4521',
  plateRead: { text: 'KL07CD4521', ocrConfidence: 0.97 },
  vehicle: { model: 'Tata Nexon EV', ev: true, batteryKwh: 40, socPct: 18, fleet: null },
  plannedStayMin: 45,
  note: 'quick meeting, need some charge to get home to Aluva',
  payment: { method: 'upi', status: 'ok' },
}

/** An overnight stay with a doubtful plate read and a pending card payment. */
export const overnight: Arrival = {
  id: 'a-overnight',
  t: at(17, 5),
  bookedPlate: 'KL01BB8080',
  plateRead: { text: 'KL01B88O8O', ocrConfidence: 0.58 },
  vehicle: { model: 'MG ZS EV', ev: true, batteryKwh: 50, socPct: 55, fleet: null },
  plannedStayMin: 15 * 60,
  note: 'leaving the car overnight, back by 8 tomorrow, cheapest charging is fine',
  payment: { method: 'card', status: 'pending' },
}

/** A petrol car with nothing unusual about it. */
export const petrol: Arrival = {
  id: 'a-petrol',
  t: at(17, 5),
  bookedPlate: 'KL05AZ1100',
  plateRead: { text: 'KL05AZ1100', ocrConfidence: 0.95 },
  vehicle: { model: 'Maruti Swift', ev: false, batteryKwh: 0, socPct: 0, fleet: null },
  plannedStayMin: 120,
  note: '',
  payment: { method: 'fastag', status: 'ok' },
}
