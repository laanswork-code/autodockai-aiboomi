/*
 * Pure helpers that turn a DecisionSet into what the driver reads on the
 * phone: the charge plan in plain words, the energy estimate and the bill.
 * All prices here are demo rates, not a real tariff.
 */
import type { Arrival, ChargePlan, Minute, PriceTier } from '../control/types'

/** Parking rate per hour for each tier (INR, demo). */
export const RATE_PER_HOUR: Record<PriceTier, number> = { discount: 30, standard: 40, peak: 60, surge: 90 }
/** Energy rate charged to the driver (INR per kWh, demo). */
export const ENERGY_INR_PER_KWH = 18
/** Lower rate for energy delivered in solar hours, when the rooftop panels carry the chargers (demo). */
export const SOLAR_INR_PER_KWH = 12
/** One pallet charger (kW). */
export const CHARGER_KW = 7.4
/** Solar hours and the off-peak start the phone tells the driver about. Demo site constants. */
export const SOLAR_FROM: Minute = 10 * 60
export const SOLAR_UNTIL: Minute = 16 * 60
export const OFF_PEAK_FROM: Minute = 22 * 60
/** Stay assumed when the driver did not say. */
export const DEFAULT_STAY_MIN = 120

export const TIER_LABEL: Record<PriceTier, string> = { discount: 'Discount', standard: 'Standard', peak: 'Peak', surge: 'Surge' }

export const clock = (t: Minute) => {
  const m = ((Math.round(t) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

/** Charge target: full if the note asks for it, else 80% to spare the battery. */
export const targetSoc = (note: string) => (/\bfull\b|100\s*%/i.test(note) ? 100 : 80)

/** kWh needed to reach the target, zero for non-EVs or no charge. */
export function kwhNeeded(arrival: Arrival, plan: ChargePlan, note: string) {
  if (!arrival.vehicle.ev || plan === 'no_charge') return 0
  const gap = Math.max(0, targetSoc(note) - arrival.vehicle.socPct)
  return (gap / 100) * arrival.vehicle.batteryKwh
}

const inSolar = (day: Minute) => day >= SOLAR_FROM && day < SOLAR_UNTIL

/** Next time of day at or after t that the clock reads `at`. */
const nextAt = (t: Minute, at: Minute) => (t % 1440 <= at ? t - (t % 1440) + at : t - (t % 1440) + 1440 + at)

/** The charge decision as one sentence the driver understands. */
export function chargeWords(plan: ChargePlan, t: Minute): { title: string; detail: string } {
  switch (plan) {
    case 'now': {
      const day = t % 1440
      const detail = inSolar(day)
        ? 'Your car started charging as soon as it was parked, on rooftop solar at the lower solar rate.'
        : day < SOLAR_FROM
          ? `Your car started charging as soon as it was parked. From ${clock(SOLAR_FROM)} it runs on rooftop solar at the lower rate.`
          : 'Your car started charging as soon as it was parked.'
      return { title: 'Charging now', detail }
    }
    case 'wait_offpeak': return { title: 'Waiting for off-peak', detail: `Charging starts at ${clock(nextAt(t, OFF_PEAK_FROM))} on the cheaper night tariff.` }
    case 'no_charge': return { title: 'Not charging', detail: 'No charge planned for this stay.' }
  }
}

/** Typical real-world efficiency of a compact Indian EV (km per kWh). */
export const KM_PER_KWH = 7.5

/** Range left on the battery, as the connected car would report it. */
export const rangeKm = (a: Arrival) => (a.vehicle.ev ? Math.round((a.vehicle.socPct / 100) * a.vehicle.batteryKwh * KM_PER_KWH) : 0)

export interface Trip { km: number; etaMin: number; leaveAt: Minute; traffic: 'heavy' | 'light' }

/**
 * Simulated drive to the site: distance seeded by the arrival id, speed by the
 * time of day, so the driver leaves exactly etaMin before arriving.
 */
export function trip(a: Arrival): Trip {
  let h = 0
  for (const c of a.id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const km = 3 + (h % 221) / 10
  const day = a.t % 1440
  const heavy = (day >= 8 * 60 && day < 10 * 60) || (day >= 17 * 60 && day < 19 * 60)
  const etaMin = Math.max(5, Math.round((km / (heavy ? 18 : 32)) * 60))
  return { km, etaMin, leaveAt: a.t - etaMin, traffic: heavy ? 'heavy' : 'light' }
}

export interface Bill { hours: number; parking: number; kwh: number; solarKwh: number; energy: number; total: number }

/** kWh of a charge started now that land in solar hours, at the full charger rate. */
function solarShare(t: Minute, kwh: number) {
  let left = kwh
  let solar = 0
  for (let m = t; left > 1e-9; m++) {
    const e = Math.min(left, CHARGER_KW / 60)
    if (inSolar(m % 1440)) solar += e
    left -= e
  }
  return solar
}

export function bill(arrival: Arrival, plan: ChargePlan, tier: PriceTier, note: string, stayMin: number | null): Bill {
  const hours = Math.max(1, Math.ceil((stayMin ?? DEFAULT_STAY_MIN) / 60))
  const parking = hours * RATE_PER_HOUR[tier]
  const kwh = kwhNeeded(arrival, plan, note)
  const solarKwh = plan === 'now' ? solarShare(arrival.t, kwh) : 0
  const energy = solarKwh * SOLAR_INR_PER_KWH + (kwh - solarKwh) * ENERGY_INR_PER_KWH
  return { hours, parking, kwh, solarKwh, energy, total: Math.round(parking + energy) }
}
