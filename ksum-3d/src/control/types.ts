/*
 * Shared contract for the Jev decision layer. Used by the decision server
 * (server/), the simulator (sim/) and the control room UI (src/control/).
 *
 * Runs in the browser and in Node (native type stripping), so: types and plain
 * constants only, no enums, no runtime imports. Relative imports elsewhere in
 * server/ and sim/ use explicit `.ts` extensions.
 */

/** Minutes since the start of the simulated day (0 = 00:00). */
export type Minute = number

export type PaymentMethod = 'upi' | 'card' | 'fastag'
export type PaymentStatus = 'ok' | 'pending' | 'mismatch'

/** A car arriving at the towers, as the gate and app see it. */
export interface Arrival {
  id: string
  t: Minute
  /** Plate as typed in the booking app. */
  bookedPlate: string
  /** Plate as read by the gate camera, with the camera's own confidence. */
  plateRead: { text: string; ocrConfidence: number }
  vehicle: {
    model: string
    ev: boolean
    batteryKwh: number
    socPct: number
    /** 'robotaxi' for autonomous fleet cars, otherwise null. */
    fleet: 'robotaxi' | null
  }
  /** What the driver told the app; null if they did not say. */
  plannedStayMin: number | null
  /** Free-text note from the booking app, e.g. "back by 6, need full charge". */
  note: string
  payment: { method: PaymentMethod; status: PaymentStatus }
}

export interface PalletState {
  index: number
  /** Arrival id of the car on this pallet, or null. */
  occupiedBy: string | null
  /** Minute the parked car is expected to leave, if known. */
  expectedOut: Minute | null
  charging: boolean
}

export interface TowerState {
  id: 0 | 1
  /** Pallet at the door right now; rotating to pallet p takes rotateCost(p). */
  palletAtDoor: number
  pallets: PalletState[]
}

/** Everything a decision may depend on, at the moment it is made. */
export interface SiteState {
  t: Minute
  towers: [TowerState, TowerState]
  /** Grid tariff right now (INR per kWh). */
  gridPriceInr: number
  /** Cheapest tariff later today and when it starts. */
  offPeak: { priceInr: number; from: Minute }
  solarKw: number
  /** Site's contracted grid limit and the charging load now. */
  gridLimitKw: number
  loadKw: number
  /** Cars queued at the gate. */
  queue: number
  scenario: ScenarioName
}

export type ScenarioName = 'normal' | 'rush_hour' | 'power_cut' | 'robotaxi_fleet'

export type ChargePlan = 'now' | 'wait_solar' | 'wait_offpeak' | 'no_charge'
export type PriceTier = 'discount' | 'standard' | 'peak' | 'surge'

export interface DecisionValues {
  bay: { tower: 0 | 1; pallet: number }
  charge: ChargePlan
  price: PriceTier
  /** Probabilities from 0 to 1; `flag` is the policy outcome. */
  anomaly: { plateMismatch: number; paymentRisk: number; flag: boolean }
}
export type DecisionKind = keyof DecisionValues

export interface Decision<K extends DecisionKind = DecisionKind> {
  kind: K
  arrivalId: string
  value: DecisionValues[K]
  /** 0 to 1. For Choice/Score this is Jev's answer confidence; for rules it is 1. */
  confidence: number
  source: 'jev' | 'rules'
  /** 'auto' acts immediately; 'review' waits for an operator. */
  mode: 'auto' | 'review'
  /** One line a human can read in the audit log and the UI. */
  why: string
  latencyMs: number
}

export type DecisionSet = { [K in DecisionKind]: Decision<K> }

export interface Decider {
  name: 'baseline' | 'jev'
  decide(arrival: Arrival, state: SiteState): Promise<DecisionSet>
}

/**
 * Which decisions may go to an operator when Jev is unsure: only those where a
 * wrong call costs the driver or the site (a car left uncharged, a wrong car or
 * unpaid stay). Bay and price act on Jev's best answer: a misjudged pallet costs a
 * few seconds of rotation, a misjudged tier a few rupees. A full site still needs
 * a person for the bay, whatever Jev says.
 */
export const ESCALATES: Record<DecisionKind, boolean> = { bay: false, charge: true, price: false, anomaly: true }

/** Confidence at or above which an escalating decision acts on its own; below goes to review. */
export const AUTO_THRESHOLD: Record<DecisionKind, number> = {
  bay: 0.6,
  charge: 0.6,
  price: 0.55,
  anomaly: 0.5,
}

export const TOWERS = 2
export const PALLETS_PER_TOWER = 20
/** AC charger in every bay, as on AutoDock towers. */
export const CHARGER_KW = 7.4

/** Result of one simulated day under one policy. All values are simulated. */
export interface SimMetrics {
  policy: Decider['name']
  scenario: ScenarioName
  cars: number
  avgWaitMin: number
  p90WaitMin: number
  kwhDelivered: number
  energyCostInr: number
  revenueInr: number
  revenuePerBayInr: number
  gridPeakKw: number
  escalations: number
  decisions: number
}

/** POST /api/decide body and response. */
export interface DecideRequest { arrival: Arrival; state: SiteState }
export interface DecideResponse { decisions: DecisionSet; usage?: JevUsage }

/**
 * Running totals of real Jev calls since the decision server started, for the
 * control room's cost counter and GET /api/health. One decision is one
 * question Jev answered; an arrival asks three to five in one call. Cache hits
 * and rules fallbacks are not calls and cost nothing.
 */
export interface JevUsage {
  /** systemOne calls that returned a usable answer. */
  calls: number
  /** Calls that errored, timed out or came back malformed (the rules decided instead). */
  failures: number
  decisions: number
  /** Token totals as reported by the SDK; null until a response reports them. */
  inputTokens: number | null
  outputTokens: number | null
  usdPerDecision: number
  costUsd: number
  /** Mean round trip of the successful calls; null before the first one. */
  avgLatencyMs: number | null
}
/** One line of server/data/audit.jsonl. */
export interface AuditEntry { at: string; arrival: Arrival; decisions: DecisionSet }
