/*
 * npm run sim -- --policy baseline|jev|both --scenario normal|rush_hour|power_cut|robotaxi_fleet|all --seed 42
 * (--scenario also takes a comma list, e.g. normal,rush_hour)
 *
 * Runs simulated days, prints a comparison table and writes sim/results.json.
 * The Jev decider is imported lazily so the baseline runs without an API key
 * or before the server code exists. Jev answers are cached on disk by the
 * decider, so a re-run of the same day replays instead of paying again.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import type { Decider, ScenarioName, SimMetrics } from '../src/control/types.ts'
import { baselineDecider } from '../src/control/baseline.ts'
import { simulate } from './engine.ts'
import { ASSUMPTIONS } from './site.ts'

const SCENARIOS: ScenarioName[] = ['normal', 'rush_hour', 'power_cut', 'robotaxi_fleet']

const { values } = parseArgs({
  options: {
    policy: { type: 'string', default: 'both' },
    scenario: { type: 'string', default: 'all' },
    seed: { type: 'string', default: '42' },
  },
})

const seed = Number(values.seed)
const scenarios = values.scenario === 'all' ? SCENARIOS : (values.scenario.split(',') as ScenarioName[])
if (!Number.isInteger(seed) || !scenarios.every((s) => SCENARIOS.includes(s)) || !['baseline', 'jev', 'both'].includes(values.policy)) {
  console.error('usage: node sim/run.ts --policy baseline|jev|both --scenario <name>[,<name>]|all --seed <int>')
  console.error(`scenarios: ${SCENARIOS.join(', ')}`)
  process.exit(2)
}

let fallbacks = 0

/** Load ../server/jevDecider.ts on demand; null (with a message) if it cannot run. */
async function loadJev(): Promise<Decider | null> {
  if (!process.env.TYPESAFE_API_KEY) {
    console.log('Jev skipped: TYPESAFE_API_KEY is not set (run with --env-file=../.env). Running baseline only.')
    return null
  }
  try {
    const mod = await import('../server/jevDecider.ts') as typeof import('../server/jevDecider.ts')
    return mod.createJevDecider({ cachePath: mod.DEFAULT_CACHE_PATH, onFallback: () => { fallbacks++ } })
  } catch (error) {
    console.log(`Jev skipped: could not load server/jevDecider.ts (${error instanceof Error ? error.message : error}). Running baseline only.`)
    return null
  }
}

const deciders: Decider[] = []
if (values.policy !== 'jev') deciders.push(baselineDecider)
if (values.policy !== 'baseline') {
  const jev = await loadJev()
  if (jev) deciders.push(jev)
}
if (!deciders.length) process.exit(1)

const results: SimMetrics[] = []
const details: { policy: string; scenario: ScenarioName; parked: number; balked: number; turnedAway: number; reviewDecisions: number; missedAnomalies: number }[] = []
for (const scenario of scenarios) {
  for (const decider of deciders) {
    const r = await simulate(decider, scenario, seed)
    results.push(r.metrics)
    const count = (o: string) => r.cars.filter((c) => c.outcome === o).length
    details.push({
      policy: decider.name, scenario, parked: count('parked'), balked: count('balked'), turnedAway: count('turned_away'),
      reviewDecisions: r.reviewDecisions, missedAnomalies: r.missedAnomalies,
    })
  }
}

writeFileSync(join(import.meta.dirname, 'results.json'), JSON.stringify({
  simulated: true,
  note: 'Simulated results from a synthetic day at the KSUM / KINFRA towers. Tariffs, prices and behaviour are illustrative assumptions, not measurements.',
  seed,
  assumptions: ASSUMPTIONS,
  results,
  details,
}, null, 2) + '\n')

const cols: [string, (m: SimMetrics, i: number) => string | number][] = [
  ['scenario', (m) => m.scenario],
  ['policy', (m) => m.policy],
  ['cars', (m) => m.cars],
  ['parked', (_, i) => details[i].parked],
  ['away', (_, i) => details[i].balked + details[i].turnedAway],
  ['avg wait', (m) => m.avgWaitMin.toFixed(2)],
  ['p90 wait', (m) => m.p90WaitMin.toFixed(2)],
  ['kWh', (m) => m.kwhDelivered.toFixed(1)],
  ['energy INR', (m) => m.energyCostInr],
  ['revenue INR', (m) => m.revenueInr],
  ['INR/bay', (m) => m.revenuePerBayInr],
  ['grid peak kW', (m) => m.gridPeakKw.toFixed(1)],
  ['escalations', (m) => m.escalations],
  ['missed', (_, i) => details[i].missedAnomalies],
]
const rows = [cols.map(([h]) => h), ...results.map((m, i) => cols.map(([, f]) => String(f(m, i))))]
const widths = cols.map((_, c) => Math.max(...rows.map((r) => r[c].length)))
console.log(`SIMULATED results, seed ${seed} (waits in minutes; away = balked at price or gave up at the gate; missed = real anomalies not flagged)`)
for (const [i, r] of rows.entries()) {
  console.log(r.map((v, c) => (c < 2 ? v.padEnd(widths[c]) : v.padStart(widths[c]))).join('  '))
  if (i === 0) console.log(widths.map((w) => '-'.repeat(w)).join('  '))
}
if (fallbacks) console.log(`Jev fell back to rules on ${fallbacks} decisions.`)
console.log('Wrote sim/results.json')
