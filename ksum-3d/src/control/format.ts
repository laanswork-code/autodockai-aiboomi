/** Display text for decisions, shared by the cards and the review queue. */
import type { DecisionKind, DecisionValues, Minute } from './types.ts'

export const KIND_LABEL: Record<DecisionKind, string> = { bay: 'Bay', charge: 'Charge', price: 'Price', anomaly: 'Anomaly' }

const CHARGE: Record<DecisionValues['charge'], string> = {
  now: 'Charge now', wait_offpeak: 'Wait for off-peak', no_charge: 'No charge',
}
const PRICE: Record<DecisionValues['price'], string> = { discount: 'Discount', standard: 'Standard', peak: 'Peak', surge: 'Surge' }
const pct = (p: number) => `${Math.round(p * 100)}%`

/** `unsure`: the decision is waiting for an operator because Jev could not tell, so an unflagged check is not "clear". */
export function valueText<K extends DecisionKind>(kind: K, value: DecisionValues[K], unsure = false): string {
  const v = value as DecisionValues[DecisionKind]
  switch (kind) {
    case 'bay': { const b = v as DecisionValues['bay']; return `Tower ${b.tower + 1}, pallet ${b.pallet + 1}` }
    case 'charge': return CHARGE[v as DecisionValues['charge']]
    case 'price': return PRICE[v as DecisionValues['price']]
    default: {
      const a = v as DecisionValues['anomaly']
      return `${a.flag ? 'Flagged' : unsure ? 'Unsure' : 'Clear'} · plate ${pct(a.plateMismatch)}, pay ${pct(a.paymentRisk)}`
    }
  }
}

export const clock = (t: Minute) => `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
