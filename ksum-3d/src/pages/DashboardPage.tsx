import { memo, useMemo, useState } from 'react'
import results from '../../sim/results.json'
import { KIND_LABEL as DECISION_LABEL, valueText } from '../control/format.ts'
import { AUTO_THRESHOLD, ESCALATES, type AuditEntry, type Decision, type DecisionKind, type JevUsage, type ScenarioName, type SimMetrics } from '../control/types.ts'
import { Link, NavLinks } from '../Nav.tsx'
import { CATEGORY_LABEL, KERALA, PROBLEMS, countBy } from './problems.ts'
import { usePoll } from './usePoll.ts'
import './pages.css'
import './dashboard.css'

interface Health { ok: boolean; decider: string; model: string; lastModel: string | null; keySet: boolean; jev?: JevUsage }
const KINDS: DecisionKind[] = ['bay', 'charge', 'price', 'anomaly']
const POLL_MS = 5000
const pct = (x: number) => `${Math.round(x * 100)}%`
const usd = (x: number) => `$${x < 1 ? x.toFixed(5) : x.toFixed(2)}`
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Live monitor for the decision layer, plus the simulated comparison and the problem research. */
export default function DashboardPage() {
  const health = usePoll<Health>('/api/health', POLL_MS)
  const audit = usePoll<{ entries: AuditEntry[] }>('/api/audit?limit=500', POLL_MS)
  const entries = useMemo(() => (audit.data?.entries ?? []).toReversed(), [audit.data])
  const live = !!health.data && !health.error
  // Audit unreachable: show the last good data dimmed, or say why there is none.
  const stale = !!audit.error && !!audit.data
  const offline = !!audit.error && !audit.data

  return (
    <div className="page">
      <div className="page__bar" />
      <div className="page__wrap">
        <header className="page__head">
          <div className="page__title">
            <p className="kicker">AutoDock · Jev decision layer</p>
            <h1>Dashboard</h1>
            <p className="sub">Live from the decision server every {POLL_MS / 1000} s: what Jev decided, how sure it was, what it cost, and when it asked a person.</p>
          </div>
          <NavLinks />
        </header>

        <div className="dstatus">
          {live
            ? <span className="pill">Decision server live · {health.data!.lastModel ?? health.data!.model}{health.data!.keySet ? '' : ' · no API key, rules only'}</span>
            : health.at
              ? <span className="pill is-down">Decision server offline: run <code>npm run server</code></span>
              : <span className="pill is-wait">Connecting…</span>}
          {health.at && <span className="dstatus__at">{health.error ? 'Last tried' : 'Updated'} {new Date(health.at).toLocaleTimeString('en-IN')}</span>}
        </div>

        <div className={stale ? 'dstale' : undefined}>
          <Tiles usage={live ? health.data!.jev : undefined} live={live} entries={entries} />

          <div className="dgrid">
            <section className="panel">
              <h2>Who decided, and who needed a person</h2>
              <p className="hint">From the audit log ({entries.length} cars). Bay and price never wait for a person; a flagged plate or payment always does.</p>
              <ModeTable entries={entries} offline={offline} />
            </section>
            <section className="panel">
              <h2>How sure Jev was</h2>
              <p className="hint">Confidence of Jev's decisions, in 10% bins. The red line is where charge and anomaly calls stop acting alone.</p>
              <Confidence entries={entries} offline={offline} />
            </section>
          </div>

          <section className="panel dwide">
            <h2>Latest decisions</h2>
            <p className="hint">Newest first. Amber rows waited for an operator.</p>
            <Recent entries={entries} offline={offline} />
          </section>
        </div>

        <div className="dgrid">
          <section className="panel"><Simulation /></section>
          <section className="panel"><Research /></section>
        </div>
      </div>
    </div>
  )
}

function Tile({ k, v, note }: { k: string; v: string; note?: string }) {
  return <div className="dtile"><span className="dtile__k">{k}</span><b>{v}</b>{note && <span className="dtile__n">{note}</span>}</div>
}

const OFFLINE_TEXT = 'Decision server offline, no audit log to show.'

const Tiles = memo(function Tiles({ usage, live, entries }: { usage?: JevUsage; live: boolean; entries: AuditEntry[] }) {
  const noData = !entries.length && !live
  const decisions = entries.flatMap((e) => KINDS.map((k) => e.decisions[k] as Decision))
  const review = decisions.filter((d) => d.mode === 'review').length
  const carsHeld = entries.filter((e) => KINDS.some((k) => e.decisions[k].mode === 'review')).length
  const fallback = decisions.filter((d) => d.source === 'rules').length
  return (
    <div className="dtiles">
      <Tile k="Jev decisions" v={usage ? String(usage.decisions) : '-'} note={usage ? `${usage.calls} calls since the server started` : 'server offline'} />
      <Tile k="Cost" v={usage ? usd(usage.costUsd) : '-'} note={usage ? `${usd(usage.usdPerDecision)} per decision` : undefined} />
      <Tile k="Avg latency" v={usage?.avgLatencyMs != null ? `${Math.round(usage.avgLatencyMs)} ms` : '-'} note="per Jev call" />
      <Tile k="Fallbacks" v={usage ? String(usage.failures) : '-'} note="Jev errors handled by rules" />
      <Tile k="Cars audited" v={noData ? '-' : String(entries.length)} note={noData ? 'server offline' : `${carsHeld} held for an operator`} />
      <Tile k="Escalation rate" v={decisions.length ? pct(review / decisions.length) : '-'} note={noData ? undefined : `${review} of ${decisions.length} decisions · ${fallback} by rules`} />
    </div>
  )
})

const ModeTable = memo(function ModeTable({ entries, offline }: { entries: AuditEntry[]; offline: boolean }) {
  if (!entries.length) return <p className="dempty">{offline ? OFFLINE_TEXT : 'No decisions yet. Play a scenario in the digital twin.'}</p>
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Decision</th><th className="num">Jev</th><th className="num">Rules</th><th className="num">Auto</th><th className="num">Review</th><th>Review share</th></tr></thead>
        <tbody>
          {KINDS.map((k) => {
            const ds = entries.map((e) => e.decisions[k] as Decision)
            const review = ds.filter((d) => d.mode === 'review').length
            return (
              <tr key={k}>
                <td>{DECISION_LABEL[k]}</td>
                <td className="num">{ds.filter((d) => d.source === 'jev').length}</td>
                <td className="num">{ds.filter((d) => d.source === 'rules').length}</td>
                <td className="num">{ds.length - review}</td>
                <td className="num">{review}</td>
                <td><div className="track" title={`${review} of ${ds.length} went to an operator`}><div className="fill fill--warn" style={{ width: `${(review / ds.length) * 100}%` }} /></div></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})

const Confidence = memo(function Confidence({ entries, offline }: { entries: AuditEntry[]; offline: boolean }) {
  const hist = useMemo(() => KINDS.map((k) => {
    const bins = Array<number>(10).fill(0)
    for (const e of entries) {
      const d = e.decisions[k] as Decision
      if (d.source === 'jev') bins[Math.min(9, Math.floor(d.confidence * 10))]++
    }
    return { k, bins, n: bins.reduce((a, b) => a + b, 0) }
  }), [entries])
  if (!entries.length) return <p className="dempty">{offline ? OFFLINE_TEXT : 'No decisions yet.'}</p>
  return (
    <div className="dhists">
      {hist.map(({ k, bins, n }) => {
        const max = Math.max(1, ...bins)
        return (
          <figure key={k} className="dhist" aria-label={`${DECISION_LABEL[k]} confidence, ${n} Jev decisions`}>
            <figcaption>{DECISION_LABEL[k]} <span>{n}</span></figcaption>
            <div className="dhist__plot">
              {bins.map((b, i) => (
                <div key={i} className="dhist__col" title={`${i * 10}-${i * 10 + 10}%: ${b}`}>
                  <div className="dhist__bar" style={{ height: `${(b / max) * 100}%` }} />
                </div>
              ))}
              {ESCALATES[k] && <div className="dhist__line" style={{ left: `${AUTO_THRESHOLD[k] * 100}%` }} title={`Auto at ${pct(AUTO_THRESHOLD[k])}`} />}
            </div>
            <div className="dhist__axis"><span>0%</span><span>100%</span></div>
          </figure>
        )
      })}
    </div>
  )
})

const Recent = memo(function Recent({ entries, offline }: { entries: AuditEntry[]; offline: boolean }) {
  if (!entries.length) return <p className="dempty">{offline ? OFFLINE_TEXT : 'No decisions yet. Start the decision server and play a scenario in the digital twin.'}</p>
  return <RecentTable entries={entries} />
})

const rowKey = (e: AuditEntry) => `${e.at}-${e.arrival.id}`

/** Mounts with the first non-empty audit, so only rows that arrive after it get the new-row tint. */
function RecentTable({ entries }: { entries: AuditEntry[] }) {
  const [initial] = useState(() => new Set(entries.slice(0, 15).map(rowKey)))
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>Time</th><th>Plate</th><th>Car</th><th>Bay</th><th>Charge</th><th>Price</th><th>Checks</th><th>Operator</th></tr></thead>
        <tbody>
          {entries.slice(0, 15).map((e) => {
            const held = KINDS.filter((k) => e.decisions[k].mode === 'review')
            return (
              <tr key={rowKey(e)} className={[held.length ? 'is-held' : '', initial.has(rowKey(e)) ? '' : 'is-new'].join(' ').trim() || undefined}>
                <td className="mono">{time(e.at)}</td>
                <td className="mono">{e.arrival.bookedPlate}</td>
                <td>{e.arrival.vehicle.model}{e.arrival.vehicle.ev ? ` · ${e.arrival.vehicle.socPct}%` : ''}</td>
                {(['bay', 'charge', 'price', 'anomaly'] as const).map((k) => {
                  const d = e.decisions[k] as Decision
                  return <td key={k} title={d.why}>{valueText(k, d.value as never, d.mode === 'review')}<span className="dconf">{d.source === 'jev' ? pct(d.confidence) : 'rules'}</span></td>
                })}
                <td>{held.length ? held.map((k) => DECISION_LABEL[k]).join(', ') : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const SCENARIO_LABEL: Record<ScenarioName, string> = { normal: 'Normal', rush_hour: 'Rush hour', power_cut: 'Power cut', robotaxi_fleet: 'Robotaxi fleet' }
/** Lower is better for these; the rest are better higher. */
const LOWER_BETTER = new Set(['avgWaitMin', 'energyCostInr', 'gridPeakKw', 'escalations'])
const METRICS: [keyof SimMetrics, string][] = [
  ['avgWaitMin', 'Average wait, min'], ['kwhDelivered', 'Energy delivered, kWh'], ['energyCostInr', 'Energy cost, INR'],
  ['revenuePerBayInr', 'Revenue per bay, INR'], ['gridPeakKw', 'Grid peak, kW'], ['escalations', 'Cars sent to an operator'],
]

function Simulation() {
  const rows = results.results as SimMetrics[]
  const [scenario, setScenario] = useState<ScenarioName>('rush_hour')
  const base = rows.find((r) => r.scenario === scenario && r.policy === 'baseline')
  const jev = rows.find((r) => r.scenario === scenario && r.policy === 'jev')
  return (
    <>
      <h2>Rules vs Jev <span className="tag-sim">SIMULATED</span></h2>
      <p className="hint">Same seeded day (seed {results.seed}), illustrative tariffs and behaviour. Not a measurement.</p>
      <div className="seg seg--small dseg" role="group" aria-label="Scenario">
        {(Object.keys(SCENARIO_LABEL) as ScenarioName[]).map((s) => (
          <button key={s} type="button" aria-pressed={scenario === s} onClick={() => setScenario(s)}>{SCENARIO_LABEL[s]}</button>
        ))}
      </div>
      {base && jev && (
        <table className="tbl">
          <thead><tr><th>{base.cars} cars</th><th className="num">Rules</th><th className="num">Jev</th><th className="num">Change</th></tr></thead>
          <tbody>
            {METRICS.map(([key, label]) => {
              const a = base[key] as number
              const b = jev[key] as number
              const change = a ? (b - a) / a : 0
              const good = change === 0 ? '' : (change < 0) === LOWER_BETTER.has(key) ? 'better' : 'worse'
              return (
                <tr key={key}>
                  <td>{label}</td>
                  <td className="num">{a.toLocaleString('en-IN')}</td>
                  <td className="num">{b.toLocaleString('en-IN')}</td>
                  <td className={`num ${good}`}>{change > 0 ? '+' : ''}{Math.round(change * 100)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}

const categories = countBy(PROBLEMS, (p) => p.category)
const kerala = PROBLEMS.filter((p) => KERALA.has(p.city)).length

function Research() {
  const max = categories[0]?.[1] ?? 1
  return (
    <>
      <h2>Parking problems people face</h2>
      <p className="hint">{PROBLEMS.length} real complaints from Reddit, forums and news, {kerala} in Kerala. <Link to="/problems">See them all</Link>.</p>
      <ul className="bars">
        {categories.map(([cat, n]) => (
          <li key={cat}>
            <span>{CATEGORY_LABEL[cat] ?? cat}</span>
            <span className="track"><span className="fill" style={{ display: 'block', width: `${(n / max) * 100}%` }} /></span>
            <span className="val">{n}</span>
          </li>
        ))}
      </ul>
    </>
  )
}
