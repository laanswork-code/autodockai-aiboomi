/*
 * Deterministic, seeded arrivals for one simulated day at the KSUM / KINFRA
 * towers in Kalamassery. Each car carries what the gate and app see (the
 * Arrival a decider gets) plus hidden ground truth the engine uses to score
 * decisions: when the driver really leaves, the charge they really want, and
 * whether a plate or payment problem is real.
 */
import type { Arrival, Minute, PaymentMethod, PaymentStatus, ScenarioName } from '../src/control/types.ts'
import { DEFAULT_TARGET_SOC } from './site.ts'

export interface SimCar {
  arrival: Arrival
  /** Minute the driver comes back for the car (may be past midnight). */
  departAt: Minute
  targetSocPct: number
  /** Uniform 0 to 1; the driver drives off if it falls below the tier's balk chance. */
  priceDraw: number
  /** Ground truth behind the anomaly check. */
  truth: { wrongCar: boolean; paymentFails: boolean }
}

/** mulberry32: tiny, fast, and identical on every platform. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rand = ReturnType<typeof rng>

const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]
const between = (r: Rand, lo: number, hi: number) => lo + r() * (hi - lo)
const int = (r: Rand, lo: number, hi: number) => Math.floor(between(r, lo, hi + 1))

const EVS = [
  { model: 'BYD Atto 3', batteryKwh: 60.48 },
  { model: 'BYD Seal', batteryKwh: 82.56 },
  { model: 'Tata Nexon EV', batteryKwh: 45 },
  { model: 'MG ZS EV', batteryKwh: 50.3 },
  { model: 'Tata Punch EV', batteryKwh: 35 },
] as const
const PETROL = ['Maruti Swift', 'Hyundai Creta', 'Honda City', 'Toyota Innova Crysta', 'Maruti Baleno', 'Kia Seltos'] as const
const ROBOTAXI = { model: 'BYD e6 (robotaxi)', batteryKwh: 71.7 }
/** Ernakulam district RTOs first: Ernakulam, Aluva, Thrippunithura, Muvattupuzha. */
const RTO = ['07', '07', '07', '41', '41', '39', '17', '42', '01', '11'] as const
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ'

function plate(r: Rand): string {
  const series = LETTERS[int(r, 0, LETTERS.length - 1)] + LETTERS[int(r, 0, LETTERS.length - 1)]
  return `KL-${pick(r, RTO)}-${series}-${String(int(r, 1, 9999)).padStart(4, '0')}`
}

/** Typical gate camera confusions: O/0, B/8, I/1, S/5, or a dropped character. */
function misread(r: Rand, p: string): string {
  const swaps: [string, string][] = [['0', 'O'], ['O', '0'], ['8', 'B'], ['B', '8'], ['1', 'I'], ['5', 'S'], ['S', '5']]
  const options = swaps.filter(([from]) => p.slice(3).includes(from))
  if (options.length && r() < 0.7) {
    const [from, to] = pick(r, options)
    const i = p.indexOf(from, 3)
    return p.slice(0, i) + to + p.slice(i + 1)
  }
  const i = int(r, 6, p.length - 1)
  return p[i] === '-' ? p.slice(0, i + 1) + p.slice(i + 2) : p.slice(0, i) + p.slice(i + 1)
}

/** "17:30" -> "5:30", "18:00" -> "6". */
function clock(t: Minute): string {
  const h = Math.floor(t / 60) % 12 || 12
  const m = t % 60
  return m ? `${h}:${String(m).padStart(2, '0')}` : String(h)
}

type Profile = 'commuter' | 'visitor' | 'evening' | 'overnight' | 'robotaxi'

interface Plan { t: Minute; departAt: Minute; planned: number | null; note: string; fullCharge: boolean }

/** Arrival time, true departure, what the app was told, and the note, per kind of driver. */
function planFor(r: Rand, profile: Profile, burstAt: Minute): Plan {
  switch (profile) {
    case 'commuter': {
      // office peak 8:30-10:30, back between 17:00 and 19:00
      const t = Math.round(8.5 * 60 + (between(r, 0, 60) + between(r, 0, 60)))
      const out = 17 * 60 + 30 * int(r, 0, 4)
      const departAt = out + int(r, -10, 20)
      const kind = r()
      const note = kind < 0.3 ? `back by ${clock(out)}, need full charge`
        : kind < 0.55 ? `in the office till ${clock(out)}`
        : kind < 0.7 ? `leaving at ${clock(out)}, top up if you can`
        : kind < 0.8 ? 'all day at KSUM' : ''
      return { t, departAt, planned: r() < 0.35 ? out - t : null, note, fullCharge: kind < 0.3 }
    }
    case 'visitor': {
      const t = int(r, 10 * 60, 17 * 60)
      const [stay, note] = pick(r, [
        [45, 'client meeting, 45 min'], [60, 'quick lunch, back in an hour'], [90, 'interview at KSUM, about 90 min'],
        [30, 'dropping off documents, 30 min'], [120, 'investor demo day, 2 hours'], [60, ''], [75, 'bank work at KINFRA, an hour or so'],
      ] as const)
      return { t, departAt: t + Math.round(stay * between(r, 0.8, 1.3)), planned: r() < 0.5 ? stay : null, note, fullCharge: false }
    }
    case 'evening': {
      // second peak 17:00-19:00: evening shift and events
      const t = int(r, 17 * 60, 19 * 60)
      const [stay, note] = pick(r, [
        [120, 'evening workshop at KSUM, 2 hours'], [60, 'gym session, an hour'], [180, 'hackathon judging, around 3 hours'], [90, ''],
      ] as const)
      return { t, departAt: t + Math.round(stay * between(r, 0.85, 1.25)), planned: r() < 0.4 ? stay : null, note, fullCharge: false }
    }
    case 'overnight': {
      const t = int(r, 19 * 60, 22 * 60)
      const airport = r() < 0.5
      const out = airport ? 24 * 60 + 5 * 60 + 30 : 24 * 60 + 7 * 60
      return {
        t, departAt: out, planned: r() < 0.4 ? out - t : null, fullCharge: airport,
        note: airport ? 'leaving for the airport tomorrow morning' : 'night shift, out by 7 am',
      }
    }
    case 'robotaxi': {
      const t = burstAt + int(r, 0, 60)
      const stay = int(r, 40, 60)
      return { t, departAt: t + stay, planned: stay, note: 'robotaxi, return to service ASAP', fullCharge: false }
    }
  }
}

function makeCar(r: Rand, id: string, profile: Profile, burstAt: Minute): SimCar {
  const p = planFor(r, profile, burstAt)
  const fleet = profile === 'robotaxi' ? 'robotaxi' as const : null
  const ev = fleet !== null || r() < 0.45
  const spec = fleet ? ROBOTAXI : ev ? pick(r, EVS) : { model: pick(r, PETROL), batteryKwh: 0 }
  const socPct = !ev ? 0 : fleet ? int(r, 15, 35) : int(r, 15, 85)

  const booked = plate(r)
  // 12% camera misreads with lower confidence; ~1.5% a different car on the booking
  const roll = r()
  const wrongCar = roll < 0.015
  const plateRead = wrongCar ? { text: plate(r), ocrConfidence: round2(between(r, 0.9, 0.98)) }
    : roll < 0.135 ? { text: misread(r, booked), ocrConfidence: round2(between(r, 0.55, 0.8)) }
    : { text: booked, ocrConfidence: round2(between(r, 0.9, 0.99)) }

  const method: PaymentMethod = fleet ? 'fastag' : pick(r, ['upi', 'upi', 'upi', 'upi', 'fastag', 'card'] as const)
  const pr = r()
  const status: PaymentStatus = pr < 0.04 ? 'mismatch' : pr < 0.12 ? 'pending' : 'ok'
  // most pending UPI payments settle on their own; mismatches never do
  const paymentFails = status === 'mismatch' || (status === 'pending' && r() < 0.25)

  return {
    arrival: {
      id, t: p.t, bookedPlate: booked, plateRead,
      vehicle: { model: spec.model, ev, batteryKwh: spec.batteryKwh, socPct, fleet },
      plannedStayMin: p.planned, note: p.note, payment: { method, status },
    },
    departAt: p.departAt,
    targetSocPct: p.fullCharge ? 100 : DEFAULT_TARGET_SOC,
    priceDraw: r(),
    truth: { wrongCar, paymentFails },
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100

const MIX: Record<'day' | 'rush', Record<Exclude<Profile, 'robotaxi'>, [number, number]>> = {
  day: { commuter: [20, 28], visitor: [32, 44], evening: [6, 10], overnight: [2, 4] },
  rush: { commuter: [30, 35], visitor: [54, 62], evening: [9, 12], overnight: [3, 5] },
}

/**
 * Cars for one day, sorted by arrival. normal and power_cut share the same
 * cars for a seed (only the grid differs); robotaxi_fleet is that same day
 * plus a burst of fleet cars from a separate stream.
 */
export function arrivalsFor(scenario: ScenarioName, seed: number): SimCar[] {
  const r = rng(seed)
  const mix = MIX[scenario === 'rush_hour' ? 'rush' : 'day']
  const profiles: Profile[] = []
  for (const [profile, [lo, hi]] of Object.entries(mix) as [Profile, [number, number]][]) {
    for (let n = int(r, lo, hi); n > 0; n--) profiles.push(profile)
  }
  const cars = profiles.map((p, i) => makeCar(r, `c${String(i + 1).padStart(3, '0')}`, p, 0))
  if (scenario === 'robotaxi_fleet') {
    const f = rng(seed ^ 0x5eed_f1ee)
    const burstAt = 13 * 60
    for (let n = int(f, 14, 18), i = 1; i <= n; i++) cars.push(makeCar(f, `rt${String(i).padStart(2, '0')}`, 'robotaxi', burstAt))
  }
  return cars.sort((a, b) => a.arrival.t - b.arrival.t || (a.arrival.id < b.arrival.id ? -1 : 1))
}
