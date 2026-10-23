/*
 * Browser side of the decision layer. The TypeSafe key lives on the server, so
 * the page only calls /api/decide. If that fails for any reason the page runs
 * the same rules policy locally, which is exactly what the site would do if
 * Jev were down.
 */
import { baselineDecisions } from './baseline.ts'
import { SCENARIOS } from './demoArrivals.ts'
import type { Arrival, DecideRequest, DecideResponse, DecisionSet, SiteState } from './types.ts'
import { CHARGER_KW } from './types.ts'
import { useControlStore } from './useControlStore.ts'

/** Jev answers in well under a second; past this the demo moves on with the rules. */
const TIMEOUT_MS = 4000

/** SiteState at the moment `arrival` reaches the gate, from the store and the scenario's grid conditions. */
export function siteState(arrival: Arrival): SiteState {
  const { scenario, towers } = useControlStore.getState()
  const name = scenario ?? 'normal'
  const { env, arrivals } = SCENARIOS[name]
  const charging = towers.reduce((n, t) => n + t.pallets.filter((p) => p.charging).length, 0)
  // cars due at the gate within the next five minutes are the queue behind this one
  const queue = arrivals.filter((a) => a.id !== arrival.id && a.t >= arrival.t && a.t <= arrival.t + 5).length
  return {
    t: arrival.t,
    towers,
    gridPriceInr: env.gridPriceInr,
    offPeak: env.offPeak,
    solarKw: env.solarKw,
    gridLimitKw: env.gridLimitKw,
    loadKw: env.baseLoadKw + charging * CHARGER_KW,
    queue,
    scenario: name,
  }
}

const isDecisionSet = (d: unknown): d is DecisionSet =>
  !!d && typeof d === 'object' && ['bay', 'charge', 'price', 'anomaly'].every((k) => k in d)

/** Ask the decision server; on any failure, decide with the rules and report the server as unreachable. */
export async function decide(arrival: Arrival, state: SiteState): Promise<{ decisions: DecisionSet; reachable: boolean }> {
  try {
    const body: DecideRequest = { arrival, state }
    const res = await fetch('/api/decide', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`decide: HTTP ${res.status}`)
    const { decisions } = (await res.json()) as DecideResponse
    if (!isDecisionSet(decisions)) throw new Error('decide: bad response')
    return { decisions, reachable: true }
  } catch {
    return { decisions: baselineDecisions(arrival, state), reachable: false }
  }
}

/** Decide the next arrival of the running scenario and put it in the feed. */
export async function playNext() {
  const store = useControlStore.getState()
  const { scenario, cursor, run, busy } = store
  if (!scenario || busy) return
  const arrival = SCENARIOS[scenario].arrivals[cursor]
  if (!arrival) { store.setPlaying(false); return }
  store.setBusy(true)
  const state = siteState(arrival)
  const rules = baselineDecisions(arrival, state)
  const { decisions, reachable } = await decide(arrival, state)
  const now = useControlStore.getState()
  if (now.run !== run) return // the scenario was restarted or reset while we waited
  now.setServer(reachable ? 'up' : 'down')
  now.ingest({ arrival, decisions, rules })
}
