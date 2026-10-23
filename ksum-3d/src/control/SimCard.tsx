import { useState } from 'react'
import results from '../../sim/results.json'
import { SCENARIOS } from './demoArrivals.ts'
import { SimComparison } from './SimComparison.tsx'
import type { ScenarioName, SimMetrics } from './types.ts'
import { useControlStore } from './useControlStore.ts'

/** Written by `npm run sim`; the JSON import keeps the card in step with the last run. */
const METRICS = results.results as SimMetrics[]
const RUN_SCENARIOS = [...new Set(METRICS.map((m) => m.scenario))]

/** One simulated scenario at a time, following the playing scenario when the sim covered it. */
export function SimCard() {
  const playing = useControlStore((s) => s.scenario)
  const [picked, setPicked] = useState<ScenarioName | null>(null)
  const shown = picked ?? (playing && RUN_SCENARIOS.includes(playing) ? playing : RUN_SCENARIOS[0])
  return (
    <div className="simcard">
      <div className="seg seg--small seg--wrap" role="group" aria-label="Simulated scenario">
        {RUN_SCENARIOS.map((sc) => (
          <button key={sc} type="button" aria-pressed={shown === sc} onClick={() => setPicked(sc)}>{SCENARIOS[sc].label}</button>
        ))}
      </div>
      <SimComparison metrics={METRICS.filter((m) => m.scenario === shown)} />
      <details className="simcard__more">
        <summary>Assumptions (seed {results.seed})</summary>
        <p>{results.note}</p>
        <ul>
          {Object.entries(results.assumptions).map(([k, v]) => <li key={k}><b>{k}</b>: {v}</li>)}
        </ul>
      </details>
    </div>
  )
}
