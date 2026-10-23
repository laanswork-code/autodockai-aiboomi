import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { AUTO_THRESHOLD } from '../src/control/types.ts'
import type { SiteState } from '../src/control/types.ts'
import { bayCandidates, buildRequest, chargeOutcome, groupConfidence, mapAnswers, NEAR_MAX_STEPS, PAYMENT_FLAG_AT, PLATE_FLAG_AT, Q } from './jev.ts'
import { choiceAnswer, liveSample, noulAnswer, scoreAnswer } from './fixtures/fake.ts'
import { overnight, petrol, quickStop, sampleState } from './fixtures/sample.ts'

const state = sampleState()

/** Answers for every question a request asks, with overrides. */
function answersFor(arrival = quickStop, s: SiteState = state, over: Record<string, unknown> = {}) {
  const { request, candidates } = buildRequest(arrival, s)
  const answers: Record<string, unknown> = {
    [Q.price]: scoreAnswer(1, 0.9),
    [Q.plate]: noulAnswer(0.05),
    [Q.payment]: noulAnswer(0.05),
  }
  if (request.questions[Q.bay]) answers[Q.bay] = choiceAnswer(Object.fromEntries(candidates.map((c, i) => [c.label, i === 0 ? 0.9 : 0.1 / (candidates.length - 1)])))
  if (request.questions[Q.charge]) answers[Q.charge] = choiceAnswer({ now: 0.9, wait_solar: 0.04, wait_offpeak: 0.03, no_charge: 0.03 })
  return { candidates, result: { answers: { ...answers, ...over } as never } }
}

/** Answers with a given charge distribution, spread into mapAnswers' trailing arguments. */
function ans(arrival: typeof quickStop, charge: Record<string, number>) {
  const top = Object.entries(charge).sort((x, y) => y[1] - x[1])[0][0]
  const { candidates, result } = answersFor(arrival, state, { charge: { ...choiceAnswer(charge), choice: top, confidence: 0.1 } })
  return [candidates, result, 1] as const
}

describe('buildRequest', () => {
  test('asks all five judgments in one request with the right primitives', () => {
    const { request } = buildRequest(quickStop, state)
    assert.deepEqual(
      Object.fromEntries(Object.entries(request.questions).map(([k, q]) => [k, q.type])),
      { price: 'score', plate_mismatch: 'noul', payment_risk: 'noul', bay: 'choice', charge: 'choice' },
    )
    const charge = request.questions[Q.charge]
    assert.ok(charge?.type === 'choice')
    assert.deepEqual(Object.keys(charge.criteria), ['now', 'wait_solar', 'wait_offpeak', 'no_charge'])
    const price = request.questions[Q.price]
    assert.ok(price?.type === 'score')
    assert.equal(price.criteria.length, 4)
  })

  test('state carries computed numbers, never the arrival id', () => {
    const s = buildRequest(overnight, state).request.state as Record<string, Record<string, unknown>>
    assert.equal(s.energy.grid_headroom_kw, 16)
    assert.equal(s.energy.minutes_until_off_peak, 295)
    assert.equal(s.car.kwh_to_full, 22.5)
    assert.equal(s.driver.expected_departure, '08:05')
    assert.ok(!JSON.stringify(s).includes(overnight.id))
  })

  test('a petrol car is not asked about charging', () => {
    assert.equal(buildRequest(petrol, state).request.questions[Q.charge], undefined)
  })

  test('bay candidates are 4-6 free pallets from both towers, described in words', () => {
    const c = bayCandidates(state)
    assert.ok(c.length >= 4 && c.length <= 6, `got ${c.length}`)
    assert.deepEqual(new Set(c.map((x) => x.tower)), new Set([0, 1]))
    for (const x of c) {
      assert.equal(state.towers[x.tower].pallets[x.pallet].occupiedBy, null)
      assert.match(x.text, /from the door|at the door/)
      assert.match(x.text, /Neighbours:/)
    }
    assert.equal(new Set(c.map((x) => x.label)).size, c.length)
  })
})

describe('mapAnswers on the recorded live responses', () => {
  test('quick stop: a split between two near-door pallets is indifference, so everything acts', () => {
    const live = liveSample('a-quick')
    const { candidates } = buildRequest(quickStop, state)
    const d = mapAnswers(quickStop, state, candidates, live, live.latencyMs)
    for (const x of Object.values(d)) {
      assert.equal(x.source, 'jev')
      assert.equal(x.arrivalId, quickStop.id)
      assert.equal(x.latencyMs, live.latencyMs)
      assert.ok(x.why.length > 0)
    }
    const bay = live.answers.bay
    assert.ok(bay?.type === 'choice')
    // raw confidence is low (torn between two pallets), but both are near the door
    assert.ok(bay.confidence < AUTO_THRESHOLD.bay)
    assert.ok(d.bay.confidence >= AUTO_THRESHOLD.bay)
    assert.equal(d.bay.mode, 'auto')
    assert.match(d.bay.why, /near the door/)
    assert.equal(d.charge.value, 'now')
    assert.equal(d.price.value, 'peak')
    assert.equal(d.anomaly.value.flag, false)
  })

  test('overnight: long stay goes far round, charging waits, doubtful anomaly escalates', () => {
    const live = liveSample('a-overnight')
    const { candidates } = buildRequest(overnight, state)
    const d = mapAnswers(overnight, state, candidates, live, live.latencyMs)
    const far = candidates.find((c) => c.tower === d.bay.value.tower && c.pallet === d.bay.value.pallet)
    assert.ok(far && far.steps >= 4, 'overnight car should not take a near-door pallet')
    assert.notEqual(d.charge.value, 'now')
    const { plateMismatch, paymentRisk } = d.anomaly.value
    assert.equal(d.anomaly.confidence, Math.min(Math.abs(2 * plateMismatch - 1), Math.abs(2 * paymentRisk - 1)))
    assert.equal(d.anomaly.mode, 'review')
  })
})

describe('mapping and modes', () => {
  test('bay: confidence groups near vs deep, and a torn bay still acts on the best guess', () => {
    const { candidates } = buildRequest(quickStop, state)
    const near = candidates.find((c) => c.steps <= NEAR_MAX_STEPS)!
    const deep = candidates.find((c) => c.steps > NEAR_MAX_STEPS)!
    // all probability on one near and one deep pallet: the split is a real disagreement
    const split = (pNear: number) => ({
      ...choiceAnswer(Object.fromEntries(candidates.map((c) => [c.label, c === near ? pNear : c === deep ? 1 - pNear : 0]))),
      choice: near.label, confidence: 0.1,
    })
    const at = mapAnswers(quickStop, state, candidates, answersFor(quickStop, state, { bay: split(AUTO_THRESHOLD.bay) }).result, 5)
    assert.equal(at.bay.mode, 'auto')
    assert.equal(at.bay.confidence, AUTO_THRESHOLD.bay)
    assert.deepEqual(at.bay.value, { tower: near.tower, pallet: near.pallet })
    // a wrong pallet costs seconds, so a torn bay never waits for a person
    const below = mapAnswers(quickStop, state, candidates, answersFor(quickStop, state, { bay: split(AUTO_THRESHOLD.bay - 0.01) }).result, 5)
    assert.equal(below.bay.mode, 'auto')
    assert.match(below.bay.why, /best guess, torn/)
  })

  test('groupConfidence sums interchangeable options and never drops below the answer confidence', () => {
    const a = { ...choiceAnswer({ x1: 0.45, x2: 0.45, y: 0.1 }), choice: 'x1', confidence: 0.2 }
    assert.equal(groupConfidence(a, (l) => l[0]), 0.9)
    assert.equal(groupConfidence({ ...a, confidence: 0.95 }, (l) => l[0]), 0.95)
  })

  test('charge: split between plans that both have the car ready acts; ready vs short escalates', () => {
    // overnight: charging now or at off-peak both finish before 08:05; waiting for
    // the morning sun does not
    for (const plan of ['now', 'wait_offpeak'] as const) assert.equal(chargeOutcome(plan, overnight, state), 'ready')
    assert.equal(chargeOutcome('wait_solar', overnight, state), 'short')
    const calm = mapAnswers(overnight, state, ...ans(overnight, { now: 0.45, wait_solar: 0.05, wait_offpeak: 0.5, no_charge: 0 }))
    assert.equal(calm.charge.mode, 'auto')
    // a short stop leaves before off-peak: waiting means leaving uncharged
    const short = { ...quickStop, plannedStayMin: 45, vehicle: { ...quickStop.vehicle, ev: true, socPct: 70 } }
    assert.equal(chargeOutcome('now', short, state), 'ready')
    assert.equal(chargeOutcome('wait_offpeak', short, state), 'short')
    const torn = mapAnswers(short, state, ...ans(short, { now: 0.5, wait_solar: 0, wait_offpeak: 0.5, no_charge: 0 }))
    assert.equal(torn.charge.mode, 'review')
  })

  test('price score rounds to the nearest tier, keeps Jev confidence and never escalates', () => {
    const cases: [number, string][] = [[0.2, 'discount'], [1.4, 'standard'], [1.6, 'peak'], [2.7, 'surge']]
    for (const [score, tier] of cases) {
      const { candidates, result } = answersFor(quickStop, state, { price: scoreAnswer(score, 0.42) })
      const d = mapAnswers(quickStop, state, candidates, result, 1)
      assert.equal(d.price.value, tier)
      assert.equal(d.price.confidence, 0.42)
      assert.equal(d.price.mode, 'auto')
    }
  })

  test('a petrol car gets a rules no_charge decision', () => {
    const { candidates, result } = answersFor(petrol)
    const d = mapAnswers(petrol, state, candidates, result, 1)
    assert.equal(d.charge.value, 'no_charge')
    assert.equal(d.charge.source, 'rules')
    assert.equal(d.charge.mode, 'auto')
  })

  test('full towers: no bay question, bay goes to an operator', () => {
    const full = sampleState()
    for (const t of full.towers) for (const p of t.pallets) p.occupiedBy ??= 'x'
    const { request, candidates } = buildRequest(quickStop, full)
    assert.equal(request.questions[Q.bay], undefined)
    const d = mapAnswers(quickStop, full, candidates, answersFor(quickStop, full).result, 1)
    assert.equal(d.bay.mode, 'review')
  })

  test('missing or mistyped answers throw, so the decider can fall back', () => {
    const { candidates, result } = answersFor(quickStop, state, { price: undefined })
    assert.throws(() => mapAnswers(quickStop, state, candidates, result, 1), /missing/)
    const bad = answersFor(quickStop, state, { plate_mismatch: scoreAnswer(1, 1) })
    assert.throws(() => mapAnswers(quickStop, state, bad.candidates, bad.result, 1), /expected noul/)
  })
})

describe('anomaly flag policy', () => {
  const run = (plate: number, payment: number) => {
    const { candidates, result } = answersFor(quickStop, state, { plate_mismatch: noulAnswer(plate), payment_risk: noulAnswer(payment) })
    return mapAnswers(quickStop, state, candidates, result, 1).anomaly
  }

  test('a confident flag still goes to review', () => {
    const a = run(0.97, 0.02)
    assert.equal(a.value.flag, true)
    assert.equal(a.mode, 'review')
    assert.ok(a.confidence >= 0.9)
    assert.match(a.why, /^Flagged: plate/)
  })

  test('thresholds are inclusive and apply to either signal', () => {
    assert.equal(run(PLATE_FLAG_AT, 0).value.flag, true)
    assert.equal(run(0, PAYMENT_FLAG_AT).value.flag, true)
    assert.equal(run(PLATE_FLAG_AT - 0.01, PAYMENT_FLAG_AT - 0.01).value.flag, false)
  })

  test('clear signals act; a near coin flip escalates without flagging', () => {
    const clear = run(0.05, 0.1)
    assert.deepEqual([clear.value.flag, clear.mode], [false, 'auto'])
    const unsure = run(0.45, 0.05)
    assert.deepEqual([unsure.value.flag, unsure.mode], [false, 'review'])
    assert.ok(Math.abs(unsure.confidence - 0.1) < 1e-9)
  })
})
