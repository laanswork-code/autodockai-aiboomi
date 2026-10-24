/*
 * Sample booking and decisions so the phone runs on its own with no props.
 * This is demo data, not a real Jev response; the phone labels it so.
 */
import type { Arrival, DecisionSet } from '../control/types'

export const SAMPLE_ARRIVAL: Arrival = {
  id: 'demo-1',
  t: 8 * 60 + 40,
  bookedPlate: 'KL 01 CB 4821',
  plateRead: { text: 'KL01CB4821', ocrConfidence: 0.97 },
  vehicle: { model: 'Tata Nexon EV', ev: true, batteryKwh: 40, socPct: 32, fleet: null },
  plannedStayMin: 480,
  note: 'In meetings till 5, need a full charge before I drive to Kochi',
  payment: { method: 'upi', status: 'ok' },
}

export const SAMPLE_DECISIONS: DecisionSet = {
  bay: { kind: 'bay', arrivalId: 'demo-1', value: { tower: 1, pallet: 6 }, confidence: 0.88, source: 'jev', mode: 'auto', why: 'Long stay: a pallet away from the door keeps short stays fast', latencyMs: 0 },
  charge: { kind: 'charge', arrivalId: 'demo-1', value: 'now', confidence: 0.81, source: 'jev', mode: 'auto', why: 'Eight hour stay and a drive to Kochi: full by about 12:20, mostly on solar', latencyMs: 0 },
  price: { kind: 'price', arrivalId: 'demo-1', value: 'discount', confidence: 0.72, source: 'jev', mode: 'auto', why: 'Quiet morning with pallets to spare earns the discount tier', latencyMs: 0 },
  anomaly: { kind: 'anomaly', arrivalId: 'demo-1', value: { plateMismatch: 0.02, paymentRisk: 0.03, flag: false }, confidence: 0.95, source: 'jev', mode: 'auto', why: 'Plate and payment match the booking', latencyMs: 0 },
}
