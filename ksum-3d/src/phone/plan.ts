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
/** When the phone tells the driver a deferred charge starts. Demo site constants. */
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

/** Next time of day at or after t that the clock reads `at`. */
const nextAt = (t: Minute, at: Minute) => (t % 1440 <= at ? t - (t % 1440) + at : t - (t % 1440) + 1440 + at)

/** The charge decision as one sentence the driver understands. */
export function chargeWords(plan: ChargePlan, t: Minute): { title: string; detail: string } {
  switch (plan) {
    case 'now': return { title: 'Charging now', detail: 'Your car started charging as soon as it was parked.' }
    case 'wait_solar': {
      const day = t % 1440
      const detail = day >= SOLAR_FROM && day < SOLAR_UNTIL
        ? 'Charging starts as soon as the roof panels have spare output, usually within the hour.'
        : `Charging starts around ${clock(nextAt(t, SOLAR_FROM))} when the roof panels pick up.`
      return { title: 'Waiting for solar', detail }
    }
    case 'wait_offpeak': return { title: 'Waiting for off-peak', detail: `Charging starts at ${clock(nextAt(t, OFF_PEAK_FROM))} on the cheaper night tariff.` }
    case 'no_charge': return { title: 'Not charging', detail: 'No charge planned for this stay.' }
  }
}

export interface Bill { hours: number; parking: number; kwh: number; energy: number; total: number }

export function bill(arrival: Arrival, plan: ChargePlan, tier: PriceTier, note: string, stayMin: number | null): Bill {
  const hours = Math.max(1, Math.ceil((stayMin ?? DEFAULT_STAY_MIN) / 60))
  const parking = hours * RATE_PER_HOUR[tier]
  const kwh = kwhNeeded(arrival, plan, note)
  const energy = kwh * ENERGY_INR_PER_KWH
  return { hours, parking, kwh, energy, total: Math.round(parking + energy) }
}
