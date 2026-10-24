/*
 * Physical and commercial constants for the simulated KSUM / KINFRA site:
 * two AutoDock rotary towers, rooftop solar, a capped grid connection and a
 * Kerala time-of-day tariff. Every number here is an illustrative assumption,
 * stated once so results.json can carry it alongside the metrics.
 */
import type { Minute, PriceTier, ScenarioName } from '../src/control/types.ts'
import { CHARGER_KW, PALLETS_PER_TOWER, TOWERS } from '../src/control/types.ts'

export const DAY_MIN = 24 * 60
/**
 * The run continues to 06:00 the next morning with no new arrivals, so cars
 * parked overnight get the off-peak hours their plan waited for (22:00 to 06:00).
 */
export const RUN_END_MIN = DAY_MIN + 6 * 60

/** One pallet step of the rotary loop, and the door work around it. */
export const ROTATE_SEC_PER_STEP = 5
export const DOCK_SEC = 60
export const RETRIEVE_SEC = 90

/** Contracted grid connection for charging, and the power cut window. */
export const GRID_LIMIT_KW = 60
export const POWER_CUT = { from: 10 * 60, to: 16 * 60, gridLimitKw: 15 }

/** Rooftop array over both towers; a half-sine from 06:00 to 18:00. */
export const SOLAR_KWP = 30

/** Time a human operator takes to clear an escalated or flagged car. */
export const OPERATOR_DELAY_MIN = 1.5
/** A driver queued at the gate this long with no free pallet gives up. */
export const MAX_GATE_WAIT_MIN = 20

/** Illustrative KSEB-style ToD bands (INR per kWh), not a published tariff. */
export const TARIFF = {
  offPeak: { from: 22 * 60, to: 6 * 60, inr: 6.3 },
  normal: { from: 6 * 60, to: 18 * 60, inr: 7.0 },
  peak: { from: 18 * 60, to: 22 * 60, inr: 9.8 },
}

/** Parking fee per started hour, by tier (INR, illustrative). */
export const PARKING_INR_PER_HR: Record<PriceTier, number> = { discount: 30, standard: 40, peak: 60, surge: 80 }
/** Price charged to drivers for energy (INR per kWh, illustrative). */
export const ENERGY_SALE_INR_PER_KWH = 18
/** Share of drivers who drive off when quoted each tier. */
export const BALK_PROB: Record<PriceTier, number> = { discount: 0, standard: 0.02, peak: 0.1, surge: 0.25 }

/** Default charge target; a note asking for a full charge means 100%. */
export const DEFAULT_TARGET_SOC = 80

export const BAYS = TOWERS * PALLETS_PER_TOWER

export function tariffAt(t: Minute): number {
  const m = ((t % DAY_MIN) + DAY_MIN) % DAY_MIN
  if (m >= TARIFF.peak.from && m < TARIFF.peak.to) return TARIFF.peak.inr
  if (m >= TARIFF.normal.from && m < TARIFF.normal.to) return TARIFF.normal.inr
  return TARIFF.offPeak.inr
}

export const isOffPeak = (t: Minute) => tariffAt(t) === TARIFF.offPeak.inr

/** Cheapest tariff from t onward today: off-peak, from 22:00 (or now if already in it). */
export function offPeakAfter(t: Minute): { priceInr: number; from: Minute } {
  return { priceInr: TARIFF.offPeak.inr, from: isOffPeak(t) ? t : TARIFF.offPeak.from }
}

export function solarKwAt(t: Minute): number {
  const h = (t % DAY_MIN) / 60
  if (h <= 6 || h >= 18) return 0
  return Math.round(SOLAR_KWP * Math.sin((Math.PI * (h - 6)) / 12) * 100) / 100
}

export function gridLimitAt(t: Minute, scenario: ScenarioName): number {
  return scenario === 'power_cut' && t >= POWER_CUT.from && t < POWER_CUT.to ? POWER_CUT.gridLimitKw : GRID_LIMIT_KW
}

/** Human-readable assumptions, written into results.json next to the numbers. */
export const ASSUMPTIONS = {
  towers: `${TOWERS} rotary towers x ${PALLETS_PER_TOWER} pallets, one door each, one door operation at a time`,
  rotation: `${ROTATE_SEC_PER_STEP} s per pallet step (shorter way round), ${DOCK_SEC} s to dock on arrival, ${RETRIEVE_SEC} s to hand a car back`,
  charger: `${CHARGER_KW} kW AC charger in every bay; default target ${DEFAULT_TARGET_SOC}% SoC, 100% when the note asks for a full charge`,
  grid: `${GRID_LIMIT_KW} kW contracted grid limit for charging; power_cut drops it to ${POWER_CUT.gridLimitKw} kW from 10:00 to 16:00 (DG backup)`,
  horizon: 'Arrivals from 00:00 to 24:00; the run continues to 06:00 the next morning so overnight off-peak charging is delivered and billed',
  solar: `${SOLAR_KWP} kWp rooftop solar, half-sine 06:00 to 18:00, peak at noon; charging cars draw solar first, then grid`,
  tariff: `Illustrative Kerala ToD tariff: INR ${TARIFF.offPeak.inr}/kWh 22:00-06:00, ${TARIFF.normal.inr} 06:00-18:00, ${TARIFF.peak.inr} 18:00-22:00`,
  pricing: `Parking INR ${PARKING_INR_PER_HR.discount}/${PARKING_INR_PER_HR.standard}/${PARKING_INR_PER_HR.peak}/${PARKING_INR_PER_HR.surge} per started hour (discount/standard/peak/surge); energy sold at INR ${ENERGY_SALE_INR_PER_KWH}/kWh`,
  balking: `Drivers drive off when quoted a tier with probability ${BALK_PROB.discount}/${BALK_PROB.standard}/${BALK_PROB.peak}/${BALK_PROB.surge}`,
  operator: `An escalated (review) decision or an anomaly flag holds the car ${OPERATOR_DELAY_MIN} min for a human operator, then the decision is applied`,
  anomalies: 'A real plate or payment problem that is not flagged loses that car\'s revenue',
  gate: `No free pallet: the car queues at the gate and gives up after ${MAX_GATE_WAIT_MIN} min`,
  wait: 'Wait per car = gate queue + operator hold + door queue + rotation + dock, plus on exit: door queue + rotation + hand-back',
}
