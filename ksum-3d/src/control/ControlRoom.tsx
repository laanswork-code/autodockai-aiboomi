import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { CostCounter } from './CostCounter.tsx'
import { DecisionCard } from './DecisionCard.tsx'
import { clock } from './format.ts'
import { SCENARIOS, SCENARIO_ORDER } from './demoArrivals.ts'
import { describeEvent } from './eventBus.ts'
import { bus, playNext, playScenario } from './pipeline.ts'
import { ReviewQueue } from './ReviewQueue.tsx'
import { siteEnergy, useControlStore } from './useControlStore.ts'

/** Gap between arrivals: long enough to read a card and watch a tower turn. */
const STEP_MS = 3500

/** Plays the running scenario one arrival at a time while `playing` is on. */
function usePlayback() {
  const playing = useControlStore((s) => s.playing)
  const busy = useControlStore((s) => s.busy)
  const cursor = useControlStore((s) => s.cursor)
  const run = useControlStore((s) => s.run)
  useEffect(() => {
    if (!playing || busy) return
    const id = setTimeout(playNext, cursor === 0 ? 300 : STEP_MS)
    return () => clearTimeout(id)
  }, [playing, busy, cursor, run])
}

function ServerPill() {
  const server = useControlStore((s) => s.server)
  if (server === 'unknown') return <span className="pill">Decision server: not called yet</span>
  return server === 'up'
    ? <span className="pill pill--up">Decision server live</span>
    : <span className="pill pill--down">Rules fallback: decision server unreachable</span>
}

function ScenarioBar() {
  const scenario = useControlStore((s) => s.scenario)
  const playing = useControlStore((s) => s.playing)
  const cursor = useControlStore((s) => s.cursor)
  const setPlaying = useControlStore((s) => s.setPlaying)
  const total = scenario ? SCENARIOS[scenario].arrivals.length : 0
  const done = scenario !== null && cursor >= total
  return (
    <div className="ctl__bar">
      <div className="seg seg--small seg--wrap" role="group" aria-label="Scenario">
        {SCENARIO_ORDER.map((name) => (
          <button key={name} type="button" aria-pressed={scenario === name} onClick={() => playScenario(name)}>{SCENARIOS[name].label}</button>
        ))}
      </div>
      {scenario && (
        <div className="ctl__run">
          <button type="button" className="chip" disabled={done} onClick={() => setPlaying(!playing)}>
            {done ? 'Done' : playing ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="chip" onClick={() => playScenario(null)}>Reset</button>
          <span className="muted">{Math.min(cursor, total)} of {total} cars</span>
        </div>
      )}
      {scenario && <p className="muted ctl__blurb">{SCENARIOS[scenario].blurb}</p>}
    </div>
  )
}

function Feed() {
  const feed = useControlStore((s) => s.feed)
  const scenario = useControlStore((s) => s.scenario)
  if (!feed.length) {
    return <p className="muted">{scenario ? 'First car at the gate...' : 'Pick a scenario to play its arrivals through the decision layer.'}</p>
  }
  return <div className="feed">{feed.map((item) => <DecisionCard key={item.arrival.id} item={item} />)}</div>
}

const kw = (v: number) => (v < 10 ? v.toFixed(1) : String(Math.round(v)))

/** Solar, grid draw against the connection limit, and the tariff now; the same numbers drive the 3D flows. */
function EnergyGauge() {
  const scenario = useControlStore((s) => s.scenario)
  const towers = useControlStore((s) => s.towers)
  const e = useMemo(() => siteEnergy(scenario, towers), [scenario, towers])
  const cut = e.gridLimitKw < e.normalLimitKw
  const over = e.gridKw > e.gridLimitKw
  const charging = e.charging[0] + e.charging[1]
  return (
    <section className={`energy ${cut ? 'is-cut' : ''} ${over ? 'is-over' : ''}`} aria-label="Site power">
      <div className="energy__cell energy__cell--solar">
        <span>Solar</span>
        <b>{kw(e.solarKw)} kW</b>
      </div>
      <div className="energy__cell energy__cell--grid">
        <span>Grid{cut ? ' (cut)' : ''}</span>
        <b>{kw(e.gridKw)} <small>/ {e.gridLimitKw} kW</small></b>
        <div className="energy__bar" role="meter" aria-label="Grid draw against the limit"
          aria-valuemin={0} aria-valuemax={e.gridLimitKw} aria-valuenow={Math.round(e.gridKw)}>
          <div style={{ transform: `scaleX(${Math.min(1, e.gridKw / e.gridLimitKw)})` }} />
        </div>
      </div>
      <div className="energy__cell">
        <span>Tariff now</span>
        <b>INR {e.gridPriceInr}<small>/kWh</small></b>
      </div>
      <p className="muted energy__note">
        {cut
          ? `Power cut: grid limit down to ${e.gridLimitKw} kW from ${e.normalLimitKw} kW. `
          : ''}
        {charging} pallets charging. Off-peak INR {e.offPeak.priceInr} from {clock(e.offPeak.from)}.
      </p>
    </section>
  )
}

/** Events shown in the log strip. */
const LOG_LINES = 8

/** The newest events on the pipeline bus, oldest first, so the flow reads top to bottom. */
function EventLog() {
  const history = useSyncExternalStore(bus.watch, bus.history)
  const shown = history.slice(-LOG_LINES)
  return (
    <section className="evlog" aria-label="Event log">
      <h3>Event log</h3>
      <p className="muted evlog__flow">Scenario player → bus → Jev decision step → tower orchestrator → 3D twin</p>
      {shown.length === 0
        ? <p className="muted">No events yet.</p>
        : (
          <ol className="evlog__list">
            {shown.map(({ seq, event }) => (
              <li key={seq} className={`evlog__row evlog__row--${event.type}`}>
                <span className="evlog__seq">{seq}</span>
                <code className="evlog__type">{event.type}</code>
                <span className="evlog__text">{describeEvent(event)}</span>
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}

/** Leaf for the playback timer, so its busy/cursor updates do not re-render the whole control room. */
function Playback() {
  usePlayback()
  return null
}

/** The Jev control room: scenario controls, the operator queue and a card per car. */
export function ControlRoom() {
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  return (
    <section className={`ctl ${open ? 'is-open' : ''}`} aria-label="Jev control room">
      <Playback />
      <header className="ctl__head">
        <div>
          <p className="kicker">Jev decision layer</p>
          <h2>Control room</h2>
        </div>
        <button type="button" className="chip chip--small" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </header>
      <ScenarioBar />
      {open && (
        <div className="ctl__body">
          <ServerPill />
          <EnergyGauge />
          <CostCounter />
          <ReviewQueue />
          <EventLog />
          <h3>Decisions</h3>
          <Feed />
        </div>
      )}
    </section>
  )
}
