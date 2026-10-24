/*
 * The driver-journey film as a pure function of time: chapter times, what the
 * phone shows, the captions, and the motion profiles the 3D scene follows.
 * Times are seconds from the start of the film.
 */
import type { PhoneStep } from '../phone/Phone'

export const FPS = 30
export const T = {
  book: 5,
  plan: 8,
  booked: 13,
  drive: 15,
  gate: 29,
  pallet: 34,
  driveIn: 40,
  parked: 46,
  exit: 46.5,
  charger: 48.6,
  plug: 50.4,
  leave: 51.6,
  lapse: 58,
  lift: 58.6,
  pay: 66,
  end: 72,
  total: 77,
} as const

export const CHAPTERS = [
  { label: 'Book', from: T.book },
  { label: 'Arrive', from: T.drive },
  { label: 'Dock', from: T.pallet },
  { label: 'Charge', from: T.exit },
  { label: 'Pay', from: T.pay },
] as const

/** Index of the chapter on screen, or -1 on the title card. */
export const chapterAt = (t: number) => CHAPTERS.reduce((at, c, i) => (t >= c.from ? i : at), -1)

const PHONE: [number, PhoneStep][] = [
  [0, 'connect'], [T.plan, 'plan'], [T.booked, 'booked'], [T.gate, 'gate'], [T.pallet, 'dock'],
  [T.plug + 0.4, 'charge'], [T.pay, 'pay'], [T.pay + 2.2, 'upi'], [T.pay + 4.4, 'paid'],
]

/** The phone screen at time t and how long it has been showing (it drives the app's own progress bars). */
export function phoneAt(t: number): { step: PhoneStep; elapsedMs: number } {
  let i = 0
  while (i + 1 < PHONE.length && t >= PHONE[i + 1][0]) i++
  return { step: PHONE[i][1], elapsedMs: Math.max(0, (t - PHONE[i][0]) * 1000) }
}

const CAPTIONS: [number, string][] = [
  [T.book, 'Connect the car. Our agent, built on Jev, reads battery, range, traffic and free chargers, and holds a pallet for the arrival time.'],
  [T.drive, 'Just drive. The booking follows the car: nothing to type, nothing to tap.'],
  [T.gate, 'At the gate a vision model recognises the car and its plate, and checks it against the booking.'],
  [T.pallet, 'Tower 2 turns the held pallet down to the door.'],
  [T.driveIn, 'Drive onto the pallet. Engine off.'],
  [T.exit, 'Plug in. Charging starts at once; in solar hours it runs on rooftop solar at a lower rate.'],
  [T.leave, 'Walk away. Our agent watches the battery, the grid and the sun for the rest of the stay.'],
  [T.lapse, 'The pallet lifts the car into the tower and frees the door for the next driver. It keeps charging up there.'],
  [T.lift + 4, 'Full by about 14:10 for the drive to Kochi, mostly on solar.'],
  [T.pay, 'Back at 16:40: the pallet brings the car down to the door, and the bill is paid by UPI.'],
]

export const captionAt = (t: number) => (t < T.book || t >= T.end ? null : CAPTIONS.reduce((c, [from, text]) => (t >= from ? text : c), ''))

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u) }
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k

/**
 * Distance covered on the drive in: cruise, then a linear brake over the last
 * 40% of the time to a stop at the gate. Cruise speed is set so the car covers
 * exactly `length` metres.
 */
export function cruiseThenBrake(t: number, t0: number, t1: number, length: number) {
  const T = t1 - t0
  const u = clamp01((t - t0) / T)
  const v = length / (0.8 * T)
  const cruise = 0.6
  if (u <= cruise) return v * u * T
  const b = (u - cruise) / (1 - cruise)
  return v * cruise * T + v * (1 - cruise) * T * (b - b * b / 2)
}

/** Tower 2's roller shutter: up as the pallet arrives, down once the driver has gone, up again at pickup. */
export function shutterAt(t: number) {
  const up = (a: number) => smooth((t - a) / 2.2)
  const down = (a: number) => 1 - smooth((t - a) / 2.2)
  if (t < T.leave + 3) return up(T.pallet + 2.2)
  if (t < T.pay) return down(T.leave + 3)
  return up(T.pay + 2.4)
}

/** Simulated clock shown in the corner: the morning in real time, then a time lapse to the afternoon. */
export function clockAt(t: number): number {
  const arrive = 8 * 60 + 40
  if (t < T.gate) return arrive - 18 + ((t - T.drive) / (T.gate - T.drive)) * 18
  if (t < T.lapse) return arrive + (t - T.gate) / 60 * 6
  if (t < T.pay) return lerp(arrive + 5, 14 * 60 + 10, smooth((t - T.lapse) / (T.pay - T.lapse - 1)))
  return 16 * 60 + 40
}
