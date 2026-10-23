import { useEffect, useState } from 'react'
import { playNext } from './api.ts'
import { DecisionCard } from './DecisionCard.tsx'
import { SCENARIOS, SCENARIO_ORDER } from './demoArrivals.ts'
import { ReviewQueue } from './ReviewQueue.tsx'
import { useControlStore } from './useControlStore.ts'

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
  const start = useControlStore((s) => s.start)
  const reset = useControlStore((s) => s.reset)
  const setPlaying = useControlStore((s) => s.setPlaying)
  const total = scenario ? SCENARIOS[scenario].arrivals.length : 0
  const done = scenario !== null && cursor >= total
  return (
    <div className="ctl__bar">
      <div className="seg seg--small seg--wrap" role="group" aria-label="Scenario">
        {SCENARIO_ORDER.map((name) => (
          <button key={name} type="button" aria-pressed={scenario === name} onClick={() => start(name)}>{SCENARIOS[name].label}</button>
        ))}
      </div>
      {scenario && (
        <div className="ctl__run">
          <button type="button" className="chip" disabled={done} onClick={() => setPlaying(!playing)}>
            {done ? 'Done' : playing ? 'Pause' : 'Resume'}
          </button>
          <button type="button" className="chip" onClick={reset}>Reset</button>
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

/** The Jev control room: scenario controls, the operator queue and a card per car. */
export function ControlRoom() {
  usePlayback()
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  return (
    <section className={`ctl ${open ? 'is-open' : ''}`} aria-label="Jev control room">
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
          <ReviewQueue />
          <h3>Decisions</h3>
          <Feed />
        </div>
      )}
    </section>
  )
}
