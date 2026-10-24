/*
 * The Jev questions for one arrival and the mapping from Jev's answers to
 * DecisionSet. All four judgments are independent, so they go in ONE
 * systemOne request over one shared state and run in parallel on TypeSafe's
 * side. Code owns everything deterministic: which pallets are candidates, the
 * numbers in the state, the price tier rounding, the anomaly flag policy, the
 * auto/review gate and the human "why" lines (Jev returns judgments only).
 */
import { choice, noul, score } from '@typesafe-ai/sdk'
import type {
  ChoiceResponse, NoulResponse, Questions, RequestOptions, ResultFor, Question,
  ScoreResponse, SystemOneRequest, SystemOneResult,
} from '@typesafe-ai/sdk'
import { baselineDecisions, stepsToDoor } from '../src/control/baseline.ts'
import type {
  Arrival, ChargePlan, Decision, DecisionKind, DecisionSet, DecisionValues, Minute, PriceTier, SiteState,
} from '../src/control/types.ts'
import { AUTO_THRESHOLD, CHARGER_KW, ESCALATES, PALLETS_PER_TOWER } from '../src/control/types.ts'

/** The slice of TypeSafeClient we use, so tests can inject a fake. */
export interface JevClient {
  systemOne(request: SystemOneRequest<Questions>, options?: RequestOptions): PromiseLike<SystemOneResult<Questions>>
}

/** Plate mismatch probability at or above which the arrival is flagged for an operator. */
export const PLATE_FLAG_AT = 0.7
/**
 * Payment risk probability at or above which the arrival is flagged for an operator.
 * Low on purpose: Jev rates a pending payment about 20-40% likely to fail (and in
 * the simulator a quarter of them do), so a one-in-three chance of an unpaid stay
 * goes to a person. Cleared payments sit around 5%.
 */
export const PAYMENT_FLAG_AT = 0.2
/** Nearest free pallets offered per tower, plus one further round the loop for long stays. */
const NEAR_PER_TOWER = 2
const FAR_STEPS = 6

export interface BayCandidate {
  /** Choice label sent to Jev, e.g. "t1_p08". */
  label: string
  tower: 0 | 1
  pallet: number
  steps: number
  /** Plain-words description Jev matches against the driver's stay. */
  text: string
}

const pad = (n: number) => String(n).padStart(2, '0')
/** "17:05" for a simulated minute; wraps past midnight. */
export const clock = (m: Minute) => {
  const d = ((Math.round(m) % 1440) + 1440) % 1440
  return `${pad(Math.floor(d / 60))}:${pad(d % 60)}`
}
const duration = (min: number) => min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${pad(Math.round(min % 60))} min`
const pct = (x: number) => `${Math.round(x * 100)}%`

/**
 * Free pallets worth offering: per tower the nearest few to the door plus one
 * further round, so a long stay has somewhere sensible to go. Ranked like the
 * baseline (steps, then a penalty on the fuller tower).
 */
export function bayCandidates(state: SiteState): BayCandidate[] {
  const out: (BayCandidate & { cost: number })[] = []
  for (const tower of state.towers) {
    const free = tower.pallets.filter((p) => !p.occupiedBy)
    const ranked = free
      .map((p) => ({ p, steps: stepsToDoor(tower.palletAtDoor, p.index) }))
      .sort((a, b) => a.steps - b.steps || a.p.index - b.p.index)
    const picked = ranked.slice(0, NEAR_PER_TOWER)
    const far = ranked
      .filter((r) => !picked.includes(r))
      .sort((a, b) => Math.abs(a.steps - FAR_STEPS) - Math.abs(b.steps - FAR_STEPS))[0]
    if (far) picked.push(far)
    for (const { p, steps } of picked) {
      const neighbours = [-1, 1].map((d) => {
        const n = tower.pallets[(p.index + d + PALLETS_PER_TOWER) % PALLETS_PER_TOWER]
        if (!n?.occupiedBy) return `pallet ${n ? n.index + 1 : '?'} is empty`
        return n.expectedOut == null
          ? `the car on pallet ${n.index + 1} has no known departure`
          : `the car on pallet ${n.index + 1} is expected out at ${clock(n.expectedOut)}`
      })
      out.push({
        label: `t${tower.id + 1}_p${pad(p.index + 1)}`,
        tower: tower.id,
        pallet: p.index,
        steps,
        cost: steps + (PALLETS_PER_TOWER - free.length) * 0.1,
        text: `Tower ${tower.id + 1}, pallet ${p.index + 1}: ${steps === 0 ? 'at the door now' : `${steps} step${steps === 1 ? '' : 's'} from the door`}. `
          + `Neighbours: ${neighbours.join('; ')}. Tower ${tower.id + 1} has ${free.length} of ${PALLETS_PER_TOWER} pallets free.`,
      })
    }
  }
  return out.sort((a, b) => a.cost - b.cost).map(({ cost: _cost, ...c }) => c)
}

const occupancy = (state: SiteState) => {
  const used = state.towers.reduce((a, t) => a + t.pallets.filter((p) => p.occupiedBy).length, 0)
  const total = state.towers.reduce((a, t) => a + t.pallets.length, 0)
  return { used, total, ratio: total ? used / total : 0 }
}

/** Below this grid limit the site is on backup power. */
const NORMAL_GRID_KW = 30

const SCENARIO_WORDS: Record<SiteState['scenario'], string> = {
  normal: 'normal day',
  rush_hour: 'rush hour',
  power_cut: 'power cut day',
  robotaxi_fleet: 'a robotaxi fleet is arriving',
}

/** The one state every question reads. Numbers code can compute are computed here. */
export function jevState(arrival: Arrival, state: SiteState) {
  const v = arrival.vehicle
  const kwhToFull = v.ev ? Math.max(0, v.batteryKwh * (1 - v.socPct / 100)) : 0
  const occ = occupancy(state)
  const untilOffPeak = ((state.offPeak.from - state.t) % 1440 + 1440) % 1440
  return {
    now: clock(state.t),
    // a power cut is only news while the grid is actually limited
    scenario: state.scenario === 'power_cut' && state.gridLimitKw >= NORMAL_GRID_KW ? 'normal day, grid restored after a power cut' : SCENARIO_WORDS[state.scenario],
    car: {
      model: v.model,
      electric: v.ev,
      robotaxi: v.fleet === 'robotaxi',
      ...(v.ev && {
        battery_kwh: v.batteryKwh,
        charge_pct: Math.round(v.socPct),
        kwh_to_full: Math.round(kwhToFull * 10) / 10,
        hours_to_full_on_bay_charger: Math.round((kwhToFull / CHARGER_KW) * 10) / 10,
      }),
    },
    driver: {
      planned_stay: arrival.plannedStayMin == null ? 'not given' : duration(arrival.plannedStayMin),
      expected_departure: arrival.plannedStayMin == null ? 'unknown' : clock(state.t + arrival.plannedStayMin),
      note: arrival.note || '(none)',
    },
    booking: { plate: arrival.bookedPlate },
    gate_camera: { plate_read: arrival.plateRead.text, ocr_confidence: arrival.plateRead.ocrConfidence },
    payment: { method: arrival.payment.method, status: arrival.payment.status },
    site: {
      cars_queued_at_gate: state.queue,
      pallets_occupied: occ.used,
      pallets_total: occ.total,
      occupancy_pct: Math.round(occ.ratio * 100),
    },
    energy: {
      bay_charger_kw: CHARGER_KW,
      grid_tariff_inr_per_kwh_now: state.gridPriceInr,
      off_peak_tariff_inr_per_kwh: state.offPeak.priceInr,
      off_peak_starts: clock(state.offPeak.from),
      minutes_until_off_peak: untilOffPeak,
      solar_kw_now: state.solarKw,
      grid_limit_kw: state.gridLimitKw,
      charging_load_kw: state.loadKw,
      grid_headroom_kw: Math.round((state.gridLimitKw - state.loadKw) * 10) / 10,
    },
  }
}

export const CHARGE_CRITERIA = {
  now: 'Start charging as soon as the car is parked: the driver leaves before off-peak power would give enough charge, or the battery is low, and `energy.grid_headroom_kw` can carry another bay charger. While the sun is up the charger draws rooftop solar first, at a lower cost.',
  wait_offpeak: 'Hold charging until the cheaper off-peak tariff: the car is still parked after `energy.off_peak_starts` with enough time left to charge, and nothing in the note needs charge sooner.',
  no_charge: 'Do not charge: the battery is already nearly full or the driver asked not to. A temporary power cut or little grid headroom right now is a reason to wait for off-peak, not to skip charging.',
} as const

/** Ordered from cheapest to dearest; index = Score level. */
export const PRICE_TIERS: readonly PriceTier[] = ['discount', 'standard', 'peak', 'surge']
export const PRICE_LEVELS = [
  'Quiet: nobody queued at the gate and fewer than half the pallets taken; spare capacity is going unused.',
  'Ordinary demand: five or fewer cars queued and the towers at most 85% full.',
  'Busy: more than five cars queued, or the towers more than 85% full.',
  'Overloaded: busy and squeezed further: ten or more cars queued with the towers nearly full, or a power cut or a robotaxi fleet arriving while the site is already busy.',
] as const

/** Question ids, as Jev's answers come back. */
export const Q = { bay: 'bay', charge: 'charge', price: 'price', plate: 'plate_mismatch', payment: 'payment_risk' } as const

/** Builds the single request. The bay question is left out when there is nothing to choose. */
export function buildRequest(arrival: Arrival, state: SiteState) {
  const candidates = bayCandidates(state)
  const questions: Questions = {
    [Q.price]: score('How much demand is there for parking right now, judging by `site` and `scenario`?', PRICE_LEVELS),
    [Q.plate]: noul(
      'Is the car at the gate a different vehicle from the one booked, comparing `booking.plate` with `gate_camera.plate_read`?',
      {
        true: 'The plates differ in a way that a camera misread (O for 0, I for 1, B for 8, a dropped space) does not explain, especially when `gate_camera.ocr_confidence` is high.',
        false: 'The plates match, or differ only by spacing, case, or one easily confused character while `gate_camera.ocr_confidence` is low.',
      },
    ),
    [Q.payment]: noul('Is there a real risk this parking session will not be paid, judging by `payment` and `driver.note`?', {
      true: 'Payment failed or does not match, is pending with nothing suggesting it will clear, or the note hints at a dispute or refusal to pay.',
      false: 'Payment has cleared, or is pending by a method that normally settles on its own.',
    }),
  }
  if (candidates.length >= 2) {
    questions[Q.bay] = choice(
      'Which free pallet should this car be parked on? Cars leaving soon should sit close to the door so they come back quickly; long stays can go further round to keep near-door pallets for short stays. Use `driver.planned_stay`, `driver.expected_departure` and `driver.note`.',
      Object.fromEntries(candidates.map((c) => [c.label, c.text])),
    )
  }
  if (arrival.vehicle.ev) {
    questions[Q.charge] = choice('When should this electric car be charged during its stay?', CHARGE_CRITERIA)
  }
  const request: SystemOneRequest<Questions> = { state: jevState(arrival, state), questions }
  return { request, candidates }
}

type Answers = SystemOneResult<Questions>['answers']

function answer<T extends ResultFor<Question>['type']>(answers: Answers, id: string, type: T) {
  const a = answers[id]
  if (!a) return undefined
  if (a.type !== type) throw new Error(`Jev answer "${id}" is ${a.type}, expected ${type}`)
  return a as Extract<ResultFor<Question>, { type: T }>
}

const gate = (kind: DecisionKind, confidence: number) => !ESCALATES[kind] || confidence >= AUTO_THRESHOLD[kind] ? 'auto' as const : 'review' as const

/**
 * Probability Jev puts on options with the same outcome as its pick. Spreading
 * probability across interchangeable options is indifference, not doubt (see the
 * TypeSafe confidence guide), so escalation follows disagreement between outcome
 * groups, not the raw top probability. The answer's own confidence is the floor.
 */
export function groupConfidence(a: ChoiceResponse, groupOf: (label: string) => string) {
  const g = groupOf(a.choice)
  const mass = Object.entries(a.probabilities).reduce((sum, [label, p]) => sum + (groupOf(label) === g ? p : 0), 0)
  return Math.max(a.confidence, mass)
}

/** Pallets this close to the door suit short stays; the rest are "deep" in the loop. */
export const NEAR_MAX_STEPS = 3

/**
 * Whether a charge plan leaves the car charged to 80% by the time the driver is
 * due back. Rough on purpose: it only separates plans that clearly do from plans
 * that clearly do not. Unknown stay: the outcome is just "charges" or "does not".
 */
export function chargeOutcome(plan: ChargePlan, arrival: Arrival, state: SiteState): string {
  if (plan === 'no_charge') return 'no_charge'
  if (arrival.plannedStayMin == null) return 'charges'
  const needKwh = Math.max(0, ((80 - arrival.vehicle.socPct) / 100) * arrival.vehicle.batteryKwh)
  const leave = state.t + arrival.plannedStayMin
  let hours: number
  if (plan === 'now') hours = (leave - state.t) / 60
  else hours = (leave - state.offPeak.from) / 60
  return Math.max(0, hours) * CHARGER_KW >= needKwh ? 'ready' : 'short'
}
const sure = (c: number) => `Jev ${pct(c)} sure`

/** Second most likely option, mentioned when Jev is torn. */
function runnerUp(a: ChoiceResponse) {
  const [, second] = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1])
  return second
}

function jevDecision<K extends DecisionKind>(kind: K, arrival: Arrival, value: DecisionValues[K], confidence: number, why: string, latencyMs: number, mode = gate(kind, confidence)): Decision<K> {
  return { kind, arrivalId: arrival.id, value, confidence, source: 'jev', mode, why, latencyMs }
}

function mapBay(arrival: Arrival, state: SiteState, candidates: BayCandidate[], a: ChoiceResponse | undefined, latencyMs: number, rules: DecisionSet): Decision<'bay'> {
  if (!a) {
    // Zero or one free pallet: nothing for Jev to judge. A full site needs an operator.
    const full = candidates.length === 0
    return { ...rules.bay, mode: full ? 'review' : 'auto', why: full ? 'Both towers full: operator must hold the car at the gate' : rules.bay.why }
  }
  const c = candidates.find((x) => x.label === a.choice)
  if (!c) throw new Error(`Jev chose unknown pallet "${a.choice}"`)
  const stay = arrival.plannedStayMin == null ? 'stay unknown' : `leaves ${clock(state.t + arrival.plannedStayMin)}`
  const steps = new Map(candidates.map((x) => [x.label, x.steps]))
  const zone = (label: string) => ((steps.get(label) ?? 0) <= NEAR_MAX_STEPS ? 'near' : 'deep')
  const confidence = groupConfidence(a, zone)
  const where = zone(a.choice) === 'near' ? 'near the door' : 'deep in the loop'
  const second = runnerUp(a)
  const torn = confidence < AUTO_THRESHOLD.bay && second
    ? `; best guess, torn ${pct(a.probabilities[a.choice] ?? 0)} vs ${second[0].replace('_', ' ').toUpperCase()} at ${pct(second[1])}`
    : ''
  return jevDecision('bay', arrival, { tower: c.tower, pallet: c.pallet }, confidence,
    `${stay}: tower ${c.tower + 1} pallet ${c.pallet + 1}, ${c.steps} step${c.steps === 1 ? '' : 's'} from the door (Jev ${pct(confidence)} sure it belongs ${where}${torn})`, latencyMs)
}

const CHARGE_WORDS: Record<ChargePlan, string> = {
  now: 'charge now', wait_offpeak: 'wait for off-peak', no_charge: 'do not charge',
}

function mapCharge(arrival: Arrival, state: SiteState, a: ChoiceResponse | undefined, latencyMs: number): Decision<'charge'> {
  if (!a) {
    return { kind: 'charge', arrivalId: arrival.id, value: 'no_charge', confidence: 1, source: 'rules', mode: 'auto', why: 'Not an EV: nothing to charge', latencyMs }
  }
  const plan = a.choice as ChargePlan
  const headroom = Math.round(state.gridLimitKw - state.loadKw)
  const leaves = arrival.plannedStayMin == null ? 'stay unknown' : `leaves ${clock(state.t + arrival.plannedStayMin)}`
  // escalate only when the likely plans disagree on whether the car is ready in time
  const confidence = groupConfidence(a, (label) => chargeOutcome(label as ChargePlan, arrival, state))
  return jevDecision('charge', arrival, plan, confidence,
    `${Math.round(arrival.vehicle.socPct)}% charged, ${leaves}, solar ${state.solarKw} kW, ${headroom} kW headroom, off-peak ${clock(state.offPeak.from)}: ${CHARGE_WORDS[plan]} (${sure(confidence)})`, latencyMs)
}

function mapPrice(arrival: Arrival, state: SiteState, a: ScoreResponse, latencyMs: number): Decision<'price'> {
  const tier = PRICE_TIERS[Math.min(PRICE_TIERS.length - 1, Math.max(0, Math.round(a.score)))]
  const occ = occupancy(state)
  return jevDecision('price', arrival, tier, a.confidence,
    `Queue ${state.queue}, ${pct(occ.ratio)} full, ${SCENARIO_WORDS[state.scenario]}: ${tier} (demand ${a.score.toFixed(2)} of 3, ${sure(a.confidence)})`, latencyMs)
}

/** Noul confidence: distance from a coin flip, on the same 0-1 scale as Choice confidence. */
export const noulConfidence = (p: number) => Math.abs(2 * p - 1)

function mapAnomaly(arrival: Arrival, plate: NoulResponse, payment: NoulResponse, latencyMs: number): Decision<'anomaly'> {
  const plateFlag = plate.noul >= PLATE_FLAG_AT
  const payFlag = payment.noul >= PAYMENT_FLAG_AT
  const flag = plateFlag || payFlag
  const confidence = Math.min(noulConfidence(plate.noul), noulConfidence(payment.noul))
  const parts = [
    arrival.plateRead.text === arrival.bookedPlate
      ? `plate ${arrival.bookedPlate} matches booking (mismatch ${pct(plate.noul)})`
      : `camera read ${arrival.plateRead.text} at OCR ${pct(arrival.plateRead.ocrConfidence)} vs booked ${arrival.bookedPlate} (mismatch ${pct(plate.noul)})`,
    `payment ${arrival.payment.status} by ${arrival.payment.method} (risk ${pct(payment.noul)})`,
  ]
  const verdict = flag ? `Flagged: ${plateFlag ? 'plate' : 'payment'}` : confidence >= AUTO_THRESHOLD.anomaly ? 'Clear' : 'Unsure'
  // A flag always needs a person, however sure Jev is.
  return jevDecision('anomaly', arrival, { plateMismatch: plate.noul, paymentRisk: payment.noul, flag }, confidence,
    `${verdict}: ${parts.join('; ')}`, latencyMs, flag ? 'review' : gate('anomaly', confidence))
}

/** Turns one Jev response into the four decisions. Throws if the response is missing an answer it needs. */
export function mapAnswers(arrival: Arrival, state: SiteState, candidates: BayCandidate[], result: Pick<SystemOneResult<Questions>, 'answers'>, latencyMs: number): DecisionSet {
  const { answers } = result
  const price = answer(answers, Q.price, 'score')
  const plate = answer(answers, Q.plate, 'noul')
  const payment = answer(answers, Q.payment, 'noul')
  if (!price || !plate || !payment) throw new Error('Jev response is missing price or anomaly answers')
  const bay = answer(answers, Q.bay, 'choice')
  const charge = answer(answers, Q.charge, 'choice')
  if (candidates.length >= 2 && !bay) throw new Error('Jev response is missing the bay answer')
  if (arrival.vehicle.ev && !charge) throw new Error('Jev response is missing the charge answer')
  return {
    bay: mapBay(arrival, state, candidates, bay, latencyMs, baselineDecisions(arrival, state)),
    charge: mapCharge(arrival, state, charge, latencyMs),
    price: mapPrice(arrival, state, price, latencyMs),
    anomaly: mapAnomaly(arrival, plate, payment, latencyMs),
  }
}
