import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Arrival } from '../control/types.ts'
import { SAMPLE_ARRIVAL } from './sample.ts'
import { bill, ENERGY_INR_PER_KWH, rangeKm, SOLAR_INR_PER_KWH, trip } from './plan.ts'

const car = (patch: Partial<Arrival['vehicle']>, t = SAMPLE_ARRIVAL.t, id = 'a1'): Arrival =>
  ({ ...SAMPLE_ARRIVAL, id, t, vehicle: { ...SAMPLE_ARRIVAL.vehicle, ...patch } })

test('range follows battery size and charge, zero for a non-EV', () => {
  assert.equal(rangeKm(car({ batteryKwh: 40, socPct: 32 })), 96)
  assert.equal(rangeKm(car({ batteryKwh: 40, socPct: 0 })), 0)
  assert.equal(rangeKm(car({ ev: false })), 0)
})

test('trip is stable for one car and lands the driver at the arrival time', () => {
  const a = car({}, 8 * 60 + 40, 'demo-1')
  const t1 = trip(a)
  assert.deepEqual(trip(a), t1)
  assert.ok(t1.km >= 3 && t1.km <= 25)
  assert.ok(t1.etaMin > 0)
  assert.equal(t1.leaveAt + t1.etaMin, a.t)
})

test('rush hour traffic is slower than midday for the same distance', () => {
  const rush = trip(car({}, 9 * 60, 'same'))
  const midday = trip(car({}, 13 * 60, 'same'))
  assert.equal(rush.km, midday.km)
  assert.ok(rush.etaMin > midday.etaMin)
  assert.equal(rush.traffic, 'heavy')
  assert.equal(midday.traffic, 'light')
})

test('charging in solar hours bills those kWh at the lower solar rate', () => {
  // 32% to 100% of 40 kWh is 27.2 kWh, about 3 h 40 min at 7.4 kW
  const note = 'need a full charge'
  const morning = bill(car({}, 8 * 60 + 40), 'now', 'standard', note, 480)
  assert.equal(morning.kwh.toFixed(1), '27.2')
  assert.ok(morning.solarKwh > 0 && morning.solarKwh < morning.kwh)
  assert.equal(Math.round(morning.energy), Math.round(morning.solarKwh * SOLAR_INR_PER_KWH + (morning.kwh - morning.solarKwh) * ENERGY_INR_PER_KWH))
  const midday = bill(car({}, 11 * 60), 'now', 'standard', note, 480)
  assert.equal(midday.solarKwh.toFixed(1), '27.2')
  const evening = bill(car({}, 18 * 60), 'now', 'standard', note, 480)
  assert.equal(evening.solarKwh, 0)
  assert.equal(bill(car({}, 11 * 60), 'wait_offpeak', 'standard', note, 720).solarKwh, 0)
})
