import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Decider, DecisionSet, ScenarioName } from '../src/control/types.ts'
import { baselineDecider, baselineDecisions } from '../src/control/baseline.ts'
import { arrivalsFor } from './arrivals.ts'
import { run, simulate } from './engine.ts'
import { MAX_GATE_WAIT_MIN, OPERATOR_DELAY_MIN, RUN_END_MIN } from './site.ts'

const SCENARIOS: ScenarioName[] = ['normal', 'rush_hour', 'power_cut', 'robotaxi_fleet']

/** A decider that takes the rules policy and rewrites part of it. */
const stub = (edit: (d: DecisionSet) => void): Decider => ({
  name: 'jev',
  decide: async (arrival, state) => {
    const d = baselineDecisions(arrival, state)
    edit(d)
    return d
  },
})
const chargeNow = stub((d) => { d.charge.value = 'now' })

test('arrivals are seeded, realistic and shared across normal and power_cut', () => {
  assert.deepEqual(arrivalsFor('rush_hour', 7), arrivalsFor('rush_hour', 7))
  assert.notDeepEqual(arrivalsFor('normal', 7), arrivalsFor('normal', 8))
  assert.deepEqual(arrivalsFor('power_cut', 7), arrivalsFor('normal', 7))
  for (const s of SCENARIOS) {
    for (const seed of [1, 42, 999]) {
      const cars = arrivalsFor(s, seed)
      assert.ok(cars.length >= 60 && cars.length <= 120, `${s}/${seed}: ${cars.length} cars`)
      for (const c of cars) assert.match(c.arrival.bookedPlate, /^KL-\d{2}-[A-Z]{2}-\d{4}$/)
      assert.ok(cars.some((c) => c.arrival.plateRead.text !== c.arrival.bookedPlate && c.arrival.plateRead.ocrConfidence < 0.8))
      assert.ok(cars.some((c) => c.arrival.payment.status !== 'ok'))
    }
  }
  const fleet = arrivalsFor('robotaxi_fleet', 42).filter((c) => c.arrival.vehicle.fleet === 'robotaxi')
  assert.ok(fleet.length >= 14 && fleet.every((c) => c.arrival.note.includes('ASAP')))
})

test('same seed gives identical metrics', async () => {
  for (const s of SCENARIOS) assert.deepEqual(await run(baselineDecider, s, 42), await run(baselineDecider, s, 42))
})

test('every car is accounted for and no pallet is double-booked', async () => {
  for (const s of SCENARIOS) {
    const r = await simulate(baselineDecider, s, 42)
    const cars = arrivalsFor(s, 42)
    assert.deepEqual(r.cars.map((c) => c.id).sort(), cars.map((c) => c.arrival.id).sort())
    const departAt = new Map(cars.map((c) => [c.arrival.id, c.departAt]))
    for (const c of r.cars) {
      const booking = r.bookings.filter((b) => b.carId === c.id)
      if (c.outcome !== 'parked') {
        assert.equal(booking.length, 0)
        continue
      }
      assert.equal(booking.length, 1)
      // a car whose driver came back before the run ended (06:00 next day) was handed back; the rest are still parked
      if (departAt.get(c.id)! < RUN_END_MIN) assert.notEqual(c.handedBackAt, null, `${s}: ${c.id} never left`)
      else assert.equal(c.handedBackAt, null)
    }
    const byPallet = new Map<string, typeof r.bookings>()
    for (const b of r.bookings) byPallet.set(`${b.tower}/${b.pallet}`, [...(byPallet.get(`${b.tower}/${b.pallet}`) ?? []), b])
    for (const [pallet, list] of byPallet) {
      const sorted = list.toSorted((a, b) => a.from - b.from)
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(sorted[i - 1].to !== null && sorted[i - 1].to! <= sorted[i].from, `${s}: pallet ${pallet} double-booked`)
      }
    }
    for (const c of r.cars) if (c.outcome === 'turned_away') assert.ok(c.waitMin <= MAX_GATE_WAIT_MIN)
  }
})

test('grid draw never exceeds the limit, even when every EV charges at once', async () => {
  for (const s of SCENARIOS) {
    for (const d of [baselineDecider, chargeNow]) {
      const r = await simulate(d, s, 42)
      r.gridKw.forEach((kw, m) => assert.ok(kw <= r.gridLimitKw[m] + 1e-9, `${s} minute ${m}: ${kw} > ${r.gridLimitKw[m]}`))
      assert.ok(r.metrics.gridPeakKw <= 60)
    }
  }
})

test('a power cut lowers kWh delivered', async () => {
  for (const d of [baselineDecider, chargeNow]) {
    const normal = await run(d, 'normal', 42)
    const cut = await run(d, 'power_cut', 42)
    assert.ok(cut.kwhDelivered < normal.kwhDelivered, `${d.name}: ${cut.kwhDelivered} >= ${normal.kwhDelivered}`)
  }
  // the cut window caps the grid at 15 kW
  const r = await simulate(chargeNow, 'power_cut', 42)
  assert.ok(Math.max(...r.gridKw.slice(10 * 60, 16 * 60)) <= 15)
})

test('an injected decider moves outcomes the expected way', async () => {
  const base = await simulate(baselineDecider, 'normal', 42)

  // escalating everything holds every decided car for the operator and adds wait
  const review = await simulate(stub((d) => { for (const x of Object.values(d)) x.mode = 'review' }), 'normal', 42)
  const decided = review.cars.filter((c) => c.outcome !== 'turned_away').length
  assert.equal(review.metrics.escalations, decided)
  assert.equal(review.reviewDecisions, decided * 4)
  assert.ok(review.metrics.avgWaitMin > base.metrics.avgWaitMin)
  assert.ok(review.metrics.avgWaitMin - base.metrics.avgWaitMin <= OPERATOR_DELAY_MIN + 1)

  // never charging delivers no energy and costs nothing
  const off = await run(stub((d) => { d.charge.value = 'no_charge' }), 'normal', 42)
  assert.equal(off.kwhDelivered, 0)
  assert.equal(off.energyCostInr, 0)

  // waiting for off-peak power moves charging into the cheapest tariff band
  const night = await simulate(stub((d) => { if (d.charge.value === 'now') d.charge.value = 'wait_offpeak' }), 'normal', 42)
  assert.ok(night.metrics.kwhDelivered < base.metrics.kwhDelivered)
  assert.ok(night.gridKw.slice(6 * 60, 22 * 60).every((kw) => kw === 0))

  // surge pricing on everyone drives some drivers away
  const surge = await simulate(stub((d) => { d.price.value = 'surge' }), 'normal', 42)
  const balked = (r: typeof base) => r.cars.filter((c) => c.outcome === 'balked').length
  assert.ok(balked(surge) > balked(base))

  // never flagging lets real plate and payment problems through, and stops the holds
  const blind = await simulate(stub((d) => { d.anomaly.value.flag = false }), 'normal', 42)
  assert.ok(blind.missedAnomalies > base.missedAnomalies)
  assert.ok(blind.metrics.escalations < base.metrics.escalations)

  // a decider that throws falls back to the rules policy
  const broken: Decider = { name: 'jev', decide: async () => { throw new Error('offline') } }
  assert.deepEqual({ ...(await run(broken, 'normal', 42)), policy: 'baseline' }, base.metrics)

  // an invalid or taken bay falls back to the nearest free pallet instead of double-parking
  const clash = await simulate(stub((d) => { d.bay.value = { tower: 0, pallet: 0 } }), 'normal', 42)
  assert.equal(clash.cars.filter((c) => c.outcome === 'parked').length, base.cars.filter((c) => c.outcome === 'parked').length)
})
