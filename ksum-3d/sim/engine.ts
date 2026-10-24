/*
 * Minute-by-minute simulation of one day at the towers under one decider.
 * Each minute: finished retrievals free their pallets, drivers coming back
 * queue a retrieval, new cars join the gate queue and are decided and parked
 * while pallets are free, then the chargers share solar and the capped grid.
 * Door work is serial per tower, so waits come from real queueing plus
 * rotation, not from a formula. All results are simulated.
 */
import type {
  ChargePlan, Decider, DecisionSet, Minute, PalletState, PriceTier, ScenarioName, SimMetrics, SiteState, TowerState,
} from '../src/control/types.ts'
import { CHARGER_KW, PALLETS_PER_TOWER, TOWERS } from '../src/control/types.ts'
import { baselineDecisions, nearestFreePallet, stepsToDoor } from '../src/control/baseline.ts'
import { arrivalsFor, type SimCar } from './arrivals.ts'
import {
  BALK_PROB, BAYS, DOCK_SEC, RUN_END_MIN, ENERGY_SALE_INR_PER_KWH, MAX_GATE_WAIT_MIN, OPERATOR_DELAY_MIN, PARKING_INR_PER_HR,
  RETRIEVE_SEC, ROTATE_SEC_PER_STEP, gridLimitAt, isOffPeak, offPeakAfter, solarKwAt, tariffAt,
} from './site.ts'

export type Outcome = 'parked' | 'balked' | 'turned_away'

/** What happened to one car, for tests and for drilling into a run. */
export interface CarLog {
  id: string
  arrivedAt: Minute
  outcome: Outcome
  bay: { tower: 0 | 1; pallet: number } | null
  /** Minute the car was docked on its pallet, and handed back (null if still parked at midnight). */
  dockedAt: number | null
  handedBackAt: number | null
  waitMin: number
  kwh: number
  revenueInr: number
  heldForOperator: boolean
  charge: ChargePlan | null
  price: PriceTier | null
}

/** One pallet holding one car, from the decision until the car is handed back. */
export interface Booking { tower: 0 | 1; pallet: number; carId: string; from: number; to: number | null }

export interface SimRun {
  metrics: SimMetrics
  cars: CarLog[]
  bookings: Booking[]
  /** Grid draw and grid limit for each minute of the day (kW). */
  gridKw: number[]
  gridLimitKw: number[]
  /** Decisions sent to an operator because Jev was unsure (mode 'review'). */
  reviewDecisions: number
  /** Real plate or payment problems that went unflagged. */
  missedAnomalies: number
}

interface Parked {
  car: SimCar
  log: CarLog
  booking: Booking
  plan: ChargePlan
  tier: PriceTier
  needKwh: number
  leaving: boolean
  /** Unflagged real anomaly: this car pays nothing. */
  leak: boolean
}

const opMin = (steps: number, sec: number) => (steps * ROTATE_SEC_PER_STEP + sec) / 60
const round = (x: number, dp = 0) => Math.round(x * 10 ** dp) / 10 ** dp

/** Use the decider, but fall back to the rules policy if it throws, as the server does. */
async function decideSafely(decider: Decider, car: SimCar, state: SiteState): Promise<DecisionSet> {
  try {
    return await decider.decide(car.arrival, state)
  } catch {
    return baselineDecisions(car.arrival, state)
  }
}

export async function simulate(decider: Decider, scenario: ScenarioName, seed: number): Promise<SimRun> {
  const cars = arrivalsFor(scenario, seed)
  const slots: (Parked | null)[][] = Array.from({ length: TOWERS }, () => Array<Parked | null>(PALLETS_PER_TOWER).fill(null))
  const palletAtDoor = Array<number>(TOWERS).fill(0)
  const doorFreeAt = Array<number>(TOWERS).fill(0)
  const releases: { tower: number; pallet: number; at: number }[] = []
  const parkOpsDoneAt: number[] = []
  const gate: SimCar[] = []
  const logs: CarLog[] = []
  const bookings: Booking[] = []
  const gridKw: number[] = []
  const gridLimitKw: number[] = []
  let charging = new Set<string>()
  let loadKw = 0
  let kwh = 0
  let energyCost = 0
  let decisions = 0
  let reviewDecisions = 0
  let missedAnomalies = 0
  let next = 0

  const parkedCars = () => slots.flat().filter((p): p is Parked => p !== null)

  const siteState = (m: Minute): SiteState => {
    const tower = (id: 0 | 1): TowerState => ({
      id,
      palletAtDoor: palletAtDoor[id],
      pallets: slots[id].map((p, index): PalletState => ({
        index,
        occupiedBy: p ? p.car.arrival.id : null,
        expectedOut: p && p.car.arrival.plannedStayMin !== null ? p.car.arrival.t + p.car.arrival.plannedStayMin : null,
        charging: p ? charging.has(p.car.arrival.id) : false,
      })),
    })
    return {
      t: m,
      towers: [tower(0), tower(1)],
      gridPriceInr: tariffAt(m),
      offPeak: offPeakAfter(m),
      solarKw: solarKwAt(m),
      gridLimitKw: gridLimitAt(m, scenario),
      loadKw: round(loadKw, 2),
      queue: gate.length - 1 + parkOpsDoneAt.filter((d) => d > m).length,
      scenario,
    }
  }

  const bill = (p: Parked, until: Minute) => {
    const hours = Math.max(1, Math.ceil((until - p.car.arrival.t) / 60))
    p.log.revenueInr = p.leak ? 0 : round(hours * PARKING_INR_PER_HR[p.tier] + p.log.kwh * ENERGY_SALE_INR_PER_KWH, 2)
  }

  async function admit(car: SimCar, m: Minute) {
    const state = siteState(m)
    const d = await decideSafely(decider, car, state)
    decisions += 4
    const reviews = Object.values(d).filter((x) => x.mode === 'review').length
    reviewDecisions += reviews
    const held = reviews > 0 || d.anomaly.value.flag
    const realIssue = car.truth.wrongCar || car.truth.paymentFails
    const log: CarLog = {
      id: car.arrival.id, arrivedAt: car.arrival.t, outcome: 'balked', bay: null, dockedAt: null, handedBackAt: null,
      waitMin: m - car.arrival.t, kwh: 0, revenueInr: 0, heldForOperator: held, charge: d.charge.value, price: d.price.value,
    }
    logs.push(log)
    if (car.priceDraw < BALK_PROB[d.price.value]) return

    const want = d.bay.value
    const valid = (want.tower === 0 || want.tower === 1) && Number.isInteger(want.pallet)
      && want.pallet >= 0 && want.pallet < PALLETS_PER_TOWER && !slots[want.tower][want.pallet]
    const bay = valid ? { tower: want.tower, pallet: want.pallet } : nearestFreePallet(state)!
    const start = Math.max(m + (held ? OPERATOR_DELAY_MIN : 0), doorFreeAt[bay.tower])
    const docked = start + opMin(stepsToDoor(palletAtDoor[bay.tower], bay.pallet), DOCK_SEC)
    doorFreeAt[bay.tower] = docked
    palletAtDoor[bay.tower] = bay.pallet
    parkOpsDoneAt.push(docked)

    const v = car.arrival.vehicle
    const booking: Booking = { tower: bay.tower, pallet: bay.pallet, carId: car.arrival.id, from: m, to: null }
    bookings.push(booking)
    Object.assign(log, { outcome: 'parked', bay, dockedAt: docked, waitMin: docked - car.arrival.t })
    const leak = realIssue && !d.anomaly.value.flag
    if (leak) missedAnomalies++
    slots[bay.tower][bay.pallet] = {
      car, log, booking, plan: d.charge.value, tier: d.price.value, leaving: false, leak,
      needKwh: v.ev ? Math.max(0, ((car.targetSocPct - v.socPct) / 100) * v.batteryKwh) : 0,
    }
  }

  /** Can this car draw power this minute under its plan? */
  const wantsPower = (p: Parked, m: Minute) => {
    if (p.leaving || p.needKwh <= 1e-9 || p.log.dockedAt === null || p.log.dockedAt > m) return false
    if (p.plan === 'now') return true
    return p.plan === 'wait_offpeak' && isOffPeak(m)
  }

  for (let m = 0; m < RUN_END_MIN; m++) {
    // 1. retrievals that finished free their pallets
    for (let i = releases.length - 1; i >= 0; i--) {
      if (releases[i].at > m) continue
      slots[releases[i].tower][releases[i].pallet] = null
      releases.splice(i, 1)
    }
    // 2. drivers coming back queue a retrieval at their tower's door
    for (const p of parkedCars()) {
      if (p.leaving || p.car.departAt > m) continue
      const { tower, pallet } = p.booking
      const start = Math.max(m, doorFreeAt[tower], p.log.dockedAt ?? m)
      const done = start + opMin(stepsToDoor(palletAtDoor[tower], pallet), RETRIEVE_SEC)
      doorFreeAt[tower] = done
      palletAtDoor[tower] = pallet
      p.leaving = true
      p.booking.to = done
      p.log.handedBackAt = done
      p.log.waitMin += done - m
      bill(p, m)
      releases.push({ tower, pallet, at: done })
    }
    // 3. new cars join the gate queue; drivers who waited too long give up
    while (next < cars.length && cars[next].arrival.t === m) gate.push(cars[next++])
    for (let i = gate.length - 1; i >= 0; i--) {
      const c = gate[i]
      if (m - c.arrival.t < MAX_GATE_WAIT_MIN) continue
      logs.push({
        id: c.arrival.id, arrivedAt: c.arrival.t, outcome: 'turned_away', bay: null, dockedAt: null, handedBackAt: null,
        waitMin: MAX_GATE_WAIT_MIN, kwh: 0, revenueInr: 0, heldForOperator: false, charge: null, price: null,
      })
      gate.splice(i, 1)
    }
    // 4. decide and park while pallets are free
    while (gate.length && slots.some((t) => t.some((p) => !p))) await admit(gate.shift()!, m)

    // 5. chargers share rooftop solar first, then the grid
    const solar = solarKwAt(m)
    const limit = gridLimitAt(m, scenario)
    const ready = parkedCars()
      .filter((p) => wantsPower(p, m))
      .sort((a, b) => a.log.dockedAt! - b.log.dockedAt! || (a.car.arrival.id < b.car.arrival.id ? -1 : 1))
    let solarLeft = solar
    let gridLeft = limit
    const nowCharging = new Set<string>()
    const give = (p: Parked, kw: number) => {
      if (kw <= 0) return
      const e = kw / 60
      p.needKwh -= e
      p.log.kwh += e
      kwh += e
      nowCharging.add(p.car.arrival.id)
    }
    for (const p of ready) {
      const kw = Math.min(CHARGER_KW, p.needKwh * 60, solarLeft + gridLeft)
      const fromSolar = Math.min(kw, solarLeft)
      solarLeft -= fromSolar
      gridLeft -= kw - fromSolar
      give(p, kw)
    }
    const draw = limit - gridLeft
    energyCost += (draw / 60) * tariffAt(m)
    gridKw.push(round(draw, 3))
    gridLimitKw.push(limit)
    loadKw = solar - solarLeft + draw
    charging = nowCharging
  }

  // 06:00 next day: bill cars still parked; anyone still at the gate gives up
  for (const p of parkedCars()) if (!p.leaving) bill(p, RUN_END_MIN)
  for (const c of gate) {
    logs.push({
      id: c.arrival.id, arrivedAt: c.arrival.t, outcome: 'turned_away', bay: null, dockedAt: null, handedBackAt: null,
      waitMin: RUN_END_MIN - c.arrival.t, kwh: 0, revenueInr: 0, heldForOperator: false, charge: null, price: null,
    })
  }
  logs.sort((a, b) => a.arrivedAt - b.arrivedAt || (a.id < b.id ? -1 : 1))
  for (const l of logs) l.kwh = round(l.kwh, 3)

  const waits = logs.map((l) => l.waitMin).sort((a, b) => a - b)
  const revenue = logs.reduce((a, l) => a + l.revenueInr, 0)
  const metrics: SimMetrics = {
    policy: decider.name,
    scenario,
    cars: cars.length,
    avgWaitMin: round(waits.reduce((a, w) => a + w, 0) / Math.max(1, waits.length), 2),
    p90WaitMin: round(waits[Math.max(0, Math.ceil(0.9 * waits.length) - 1)] ?? 0, 2),
    kwhDelivered: round(kwh, 1),
    energyCostInr: round(energyCost),
    revenueInr: round(revenue),
    revenuePerBayInr: round(revenue / BAYS),
    gridPeakKw: round(Math.max(0, ...gridKw), 1),
    escalations: logs.filter((l) => l.heldForOperator).length,
    decisions,
  }
  return { metrics, cars: logs, bookings, gridKw, gridLimitKw, reviewDecisions, missedAnomalies }
}

/** One simulated day under one decider. Same decider, scenario and seed give the same metrics. */
export async function run(decider: Decider, scenario: ScenarioName, seed: number): Promise<SimMetrics> {
  return (await simulate(decider, scenario, seed)).metrics
}
