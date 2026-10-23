import { SCENARIOS } from './demoArrivals.ts'
import type { ScenarioName, SimMetrics } from './types.ts'

type MetricKey = 'avgWaitMin' | 'p90WaitMin' | 'kwhDelivered' | 'energyCostInr' | 'revenuePerBayInr' | 'gridPeakKw' | 'escalations'

/** Which way is better for each metric decides how the change is coloured. */
const METRICS: { key: MetricKey; label: string; unit: string; better: 'lower' | 'higher' }[] = [
  { key: 'avgWaitMin', label: 'Average wait', unit: 'min', better: 'lower' },
  { key: 'p90WaitMin', label: 'P90 wait', unit: 'min', better: 'lower' },
  { key: 'kwhDelivered', label: 'Energy delivered', unit: 'kWh', better: 'higher' },
  { key: 'energyCostInr', label: 'Energy cost', unit: 'INR', better: 'lower' },
  { key: 'revenuePerBayInr', label: 'Revenue per bay', unit: 'INR', better: 'higher' },
  { key: 'gridPeakKw', label: 'Grid peak', unit: 'kW', better: 'lower' },
  { key: 'escalations', label: 'Escalations', unit: '', better: 'lower' },
]

const num = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('en-IN')

/** Baseline vs Jev per scenario, from the simulator. Every figure here is simulated. */
export function SimComparison({ metrics }: { metrics: SimMetrics[] }) {
  const scenarios = [...new Set(metrics.map((m) => m.scenario))] as ScenarioName[]
  return (
    <section className="sim" aria-label="Simulated comparison">
      <h3>Rules baseline vs Jev <span className="tag-sim">Simulated</span></h3>
      {scenarios.map((sc) => {
        const base = metrics.find((m) => m.scenario === sc && m.policy === 'baseline')
        const jev = metrics.find((m) => m.scenario === sc && m.policy === 'jev')
        if (!base || !jev) return null
        return (
          <table key={sc} className="sim__table">
            <caption>{SCENARIOS[sc].label} · {jev.cars} cars, simulated day</caption>
            <thead><tr><th scope="col">Metric</th><th scope="col">Rules</th><th scope="col">Jev</th><th scope="col">Change</th></tr></thead>
            <tbody>
              {METRICS.map(({ key, label, unit, better }) => {
                const b = base[key]
                const j = jev[key]
                const delta = b === 0 ? null : ((j - b) / Math.abs(b)) * 100
                const good = delta !== null && (better === 'lower' ? delta < 0 : delta > 0)
                return (
                  <tr key={key}>
                    <th scope="row">{label}{unit && <span className="muted"> {unit}</span>}</th>
                    <td>{num(b)}</td>
                    <td>{num(j)}</td>
                    <td className={delta === null || Math.abs(delta) < 0.5 ? '' : good ? 'is-good' : 'is-bad'}>
                      {delta === null ? '-' : `${delta > 0 ? '+' : ''}${Math.round(delta)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      })}
    </section>
  )
}
