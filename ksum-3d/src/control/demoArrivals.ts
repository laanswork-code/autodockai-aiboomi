/*
 * Hand-written arrivals for the judge-controlled scenarios. Each list has at
 * least one camera misread and one payment that is not clean, so the operator
 * review queue always gets something to do. Plates use Kerala RTO codes around
 * Kalamassery (KL 07 Ernakulam, KL 41 Aluva, KL 63 Angamaly and so on).
 */
import type { Arrival, Minute, PaymentMethod, PaymentStatus, ScenarioName } from './types.ts'

/** Grid and solar conditions the scenario starts in; fed into SiteState. */
export interface ScenarioEnv {
  gridPriceInr: number
  offPeak: { priceInr: number; from: Minute }
  solarKw: number
  gridLimitKw: number
  /** Building load on the same connection, before any car charges. */
  baseLoadKw: number
}

export interface Scenario {
  label: string
  blurb: string
  env: ScenarioEnv
  arrivals: Arrival[]
}

/** Battery sizes are the makers' usable kWh; null means not an EV. */
const MODELS: Record<string, number | null> = {
  'Tata Nexon EV': 40.5,
  'Tata Punch EV': 35,
  'Tata Tiago EV': 24,
  'MG Windsor EV': 38,
  'MG ZS EV': 50.3,
  'BYD Atto 3': 60.5,
  'BYD Seal': 82.5,
  'Hyundai Creta Electric': 51.4,
  'Mahindra BE 6': 59,
  'Mahindra XUV400': 39.4,
  'Maruti Swift': null,
  'Toyota Innova Crysta': null,
  'Hyundai i20': null,
}

const hm = (h: number, m: number): Minute => h * 60 + m

interface Extra {
  /** Plate the gate camera read, and its confidence, when it differs from a clean read. */
  read?: [string, number]
  pay?: [PaymentMethod, PaymentStatus]
  robotaxi?: boolean
}

function arrive(
  id: string, t: Minute, plate: string, model: keyof typeof MODELS, socPct: number,
  plannedStayMin: number | null, note: string, extra: Extra = {},
): Arrival {
  const kwh = MODELS[model]
  return {
    id, t,
    bookedPlate: plate,
    plateRead: extra.read ? { text: extra.read[0], ocrConfidence: extra.read[1] } : { text: plate, ocrConfidence: 0.97 },
    vehicle: { model, ev: kwh !== null, batteryKwh: kwh ?? 0, socPct: kwh === null ? 0 : socPct, fleet: extra.robotaxi ? 'robotaxi' : null },
    plannedStayMin,
    note,
    payment: { method: extra.pay?.[0] ?? 'upi', status: extra.pay?.[1] ?? 'ok' },
  }
}

const normal: Arrival[] = [
  arrive('n1', hm(8, 40), 'KL 07 CX 4821', 'Tata Nexon EV', 38, 540, 'Office till 5:30, need 80% for the drive home to Aluva'),
  arrive('n2', hm(9, 5), 'KL 41 F 7310', 'Maruti Swift', 0, 120, 'Meeting at KSUM, back by 11', { pay: ['card', 'ok'] }),
  arrive('n3', hm(9, 30), 'KL 39 H 2207', 'MG Windsor EV', 62, 480, 'No rush on charging, here all day'),
  arrive('n4', hm(10, 10), 'KL 07 CB 8812', 'BYD Atto 3', 45, 240, 'Demo day at KSUM, leaving around 2', { read: ['KL 07 C8 8812', 0.61] }),
  arrive('n5', hm(10, 45), 'KL 63 B 5590', 'Hyundai Creta Electric', 22, 90, 'Need as much charge as possible in 90 min', { pay: ['fastag', 'ok'] }),
  arrive('n6', hm(11, 20), 'KL 17 M 4419', 'Toyota Innova Crysta', 0, null, '', { pay: ['fastag', 'ok'] }),
  arrive('n7', hm(12, 5), 'KL 08 BK 6034', 'Tata Punch EV', 71, 300, 'Lunch then a workshop', { pay: ['upi', 'pending'] }),
  arrive('n8', hm(13, 15), 'KL 01 CF 9921', 'Mahindra BE 6', 54, 600, 'Charge whenever it is cheapest', { pay: ['card', 'ok'] }),
  arrive('n9', hm(14, 0), 'KL 42 E 1188', 'Tata Tiago EV', 15, 60, 'Battery almost flat, quick top-up'),
  arrive('n10', hm(15, 30), 'KL 11 AZ 3020', 'BYD Seal', 66, 180, 'Visiting from Kozhikode, driving back tonight', { pay: ['card', 'ok'] }),
]

const rushHour: Arrival[] = [
  arrive('r1', hm(8, 45), 'KL 07 DA 3318', 'Tata Nexon EV', 31, 540, 'Back by 6, need full charge'),
  arrive('r2', hm(8, 47), 'KL 41 G 2290', 'Hyundai i20', 0, 510, 'Standup at 9, leave at 5:30', { pay: ['fastag', 'ok'] }),
  arrive('r3', hm(8, 49), 'KL 07 DE 5501', 'MG ZS EV', 48, 480, 'Late for a pitch, please hurry', { read: ['KL 07 DF 5501', 0.55] }),
  arrive('r4', hm(8, 51), 'KL 63 C 7742', 'Tata Punch EV', 19, 240, 'Half day, leaving at 1'),
  arrive('r5', hm(8, 53), 'KL 39 K 6610', 'BYD Atto 3', 74, 540, ''),
  arrive('r6', hm(8, 55), 'KL 40 B 1203', 'Mahindra XUV400', 27, 600, 'Long day, any time before 7 is fine', { pay: ['card', 'pending'] }),
  arrive('r7', hm(8, 58), 'KL 07 CZ 9087', 'Maruti Swift', 0, 120, 'Dropping documents at KINFRA office'),
  arrive('r8', hm(9, 1), 'KL 17 P 4456', 'MG Windsor EV', 55, 510, 'Need 70% for Muvattupuzha tonight'),
  arrive('r9', hm(9, 4), 'KL 07 DB 2271', 'Tata Tiago EV', 12, 300, 'Nearly empty, charge first please'),
  arrive('r10', hm(9, 8), 'KL 42 F 8034', 'Hyundai Creta Electric', 63, 480, '', { pay: ['upi', 'mismatch'] }),
  arrive('r11', hm(9, 12), 'KL 01 CA 5562', 'BYD Seal', 41, 540, 'Visiting from Trivandrum, out at 6', { pay: ['card', 'ok'] }),
  arrive('r12', hm(9, 20), 'KL 07 CW 3390', 'Tata Nexon EV', 58, 240, 'Client call till 1'),
]

const powerCut: Arrival[] = [
  arrive('p1', hm(13, 0), 'KL 07 CY 4410', 'Tata Nexon EV', 18, 180, 'Low battery, is charging working today?'),
  arrive('p2', hm(13, 12), 'KL 41 H 9021', 'BYD Atto 3', 52, 300, 'Saw the KSEB outage notice, no rush'),
  arrive('p3', hm(13, 25), 'KL 63 D 1174', 'Toyota Innova Crysta', 0, 90, 'Picking up a guest', { pay: ['fastag', 'ok'] }),
  arrive('p4', hm(13, 38), 'KL 07 DC 6630', 'Tata Tiago EV', 9, 240, 'Will not make it home without a charge'),
  arrive('p5', hm(13, 50), 'KL 08 CM 2219', 'MG Windsor EV', 66, 360, '', { read: ['KL 08 CM 2219', 0.58], pay: ['upi', 'pending'] }),
  arrive('p6', hm(14, 5), 'KL 39 L 7781', 'Mahindra BE 6', 35, 420, 'Fine to charge after the power is back'),
  arrive('p7', hm(14, 20), 'KL 11 BA 4402', 'BYD Seal', 23, 120, 'Driving to Kozhikode at 4, need range'),
  arrive('p8', hm(14, 35), 'KL 07 CV 3348', 'Hyundai Creta Electric', 47, 300, '', { read: ['KL 07 CU 3348', 0.52] }),
  arrive('p9', hm(14, 50), 'KL 42 G 5506', 'Tata Punch EV', 80, 180, 'Just parking, no charge needed', { pay: ['card', 'ok'] }),
  arrive('p10', hm(15, 5), 'KL 17 R 6619', 'Mahindra XUV400', 29, 480, 'Here till evening'),
]

const robotaxiFleet: Arrival[] = [
  arrive('f1', hm(22, 0), 'KL 07 DR 0101', 'BYD Atto 3', 21, 450, 'Fleet return, next dispatch 06:00, needs 90%', { robotaxi: true, pay: ['fastag', 'ok'] }),
  arrive('f2', hm(22, 4), 'KL 07 DR 0102', 'BYD Atto 3', 34, 450, 'Fleet return, next dispatch 06:00, needs 90%', { robotaxi: true, pay: ['fastag', 'ok'] }),
  arrive('f3', hm(22, 8), 'KL 07 DR 0107', 'Tata Nexon EV', 17, 420, 'Fleet return, airport run at 05:30', { robotaxi: true, pay: ['fastag', 'ok'] }),
  arrive('f4', hm(22, 12), 'KL 07 DR 0110', 'BYD Atto 3', 46, 450, 'Fleet return, cabin cleaning requested', { robotaxi: true, pay: ['fastag', 'ok'], read: ['KL 07 DR 0118', 0.57] }),
  arrive('f5', hm(22, 15), 'KL 07 CT 7704', 'Hyundai Creta Electric', 39, 90, 'Late shift at KINFRA, out by 23:45'),
  arrive('f6', hm(22, 19), 'KL 07 DR 0113', 'Tata Nexon EV', 28, 450, 'Fleet return, next dispatch 06:00', { robotaxi: true, pay: ['fastag', 'ok'] }),
  arrive('f7', hm(22, 24), 'KL 07 DR 0115', 'BYD Atto 3', 12, 420, 'Fleet return, battery low after long run', { robotaxi: true, pay: ['fastag', 'mismatch'] }),
  arrive('f8', hm(22, 30), 'KL 07 DR 0120', 'BYD Seal', 51, 480, 'Fleet return, premium tier, dispatch 07:00', { robotaxi: true, pay: ['fastag', 'ok'] }),
  arrive('f9', hm(22, 36), 'KL 07 DR 0122', 'BYD Atto 3', 40, 450, 'Fleet return, next dispatch 06:00', { robotaxi: true, pay: ['fastag', 'ok'] }),
  arrive('f10', hm(22, 45), 'KL 07 DR 0125', 'Tata Nexon EV', 26, 420, 'Fleet return, sensor wipe due', { robotaxi: true, pay: ['fastag', 'pending'] }),
]

/*
 * Grid and tariff numbers match the simulator's assumptions (sim/site.ts), so the
 * gauge and the simulated comparison tell the same story: a 60 kW charging limit
 * and an illustrative Kerala ToD tariff of INR 6.3 off-peak, 7.0 by day, 9.8 at
 * the evening peak. The power cut runs on diesel backup, hence its price.
 */
export const SCENARIOS: Record<ScenarioName, Scenario> = {
  normal: {
    label: 'Normal',
    blurb: 'A weekday at KINFRA, solar up by mid-morning.',
    env: { gridPriceInr: 7.0, offPeak: { priceInr: 6.3, from: hm(22, 0) }, solarKw: 18, gridLimitKw: 60, baseLoadKw: 20 },
    arrivals: normal,
  },
  rush_hour: {
    label: 'Rush hour',
    blurb: '12 cars in 35 minutes before 9:30, chargers already busy, little sun yet.',
    env: { gridPriceInr: 7.0, offPeak: { priceInr: 6.3, from: hm(22, 0) }, solarKw: 6, gridLimitKw: 60, baseLoadKw: 35 },
    arrivals: rushHour,
  },
  power_cut: {
    label: 'Power cut',
    blurb: 'KSEB outage: the site runs on rooftop solar and a small backup feed.',
    env: { gridPriceInr: 14, offPeak: { priceInr: 6.3, from: hm(22, 0) }, solarKw: 22, gridLimitKw: 15, baseLoadKw: 8 },
    arrivals: powerCut,
  },
  robotaxi_fleet: {
    label: 'Robotaxi fleet',
    blurb: 'A robotaxi fleet returns overnight to charge before the morning dispatch.',
    env: { gridPriceInr: 6.3, offPeak: { priceInr: 6.3, from: hm(22, 0) }, solarKw: 0, gridLimitKw: 60, baseLoadKw: 10 },
    arrivals: robotaxiFleet,
  },
}

export const SCENARIO_ORDER: ScenarioName[] = ['normal', 'rush_hour', 'power_cut', 'robotaxi_fleet']
