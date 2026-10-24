import { VIEWS, type ViewName } from '../config/site'
import { ControlRoom } from '../control/ControlRoom'
import { SimCard } from '../control/SimCard'
import { spaceStats } from '../lib/stats'
import { useSceneStore, type Mode } from '../store/useSceneStore'
import { DriverPhone } from './DriverPhone'
import { NavLinks } from '../Nav.tsx'

const MODES: { id: Mode; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'autodock', label: 'With AutoDock' },
]
const VIEW_LABELS: Record<ViewName, string> = { overview: 'Overview', street: 'Street', towers: 'Towers', entrance: 'Entrance', plan: 'Plan' }
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN')

function ModeSwitch() {
  const mode = useSceneStore((s) => s.mode)
  const setMode = useSceneStore((s) => s.setMode)
  return (
    <div className="seg" role="group" aria-label="Scenario">
      {MODES.map((m) => (
        <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
      ))}
    </div>
  )
}

function ViewSwitch() {
  const view = useSceneStore((s) => s.view)
  const setView = useSceneStore((s) => s.setView)
  return (
    <div className="seg seg--small" role="group" aria-label="Camera">
      {(Object.keys(VIEWS) as ViewName[]).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABELS[v]}</button>
      ))}
    </div>
  )
}

function SpinToggle() {
  const spinning = useSceneStore((s) => s.spinning)
  const toggle = useSceneStore((s) => s.toggleSpin)
  return (
    <button type="button" className="chip" aria-pressed={spinning} onClick={toggle}>
      {spinning ? 'Pause towers' : 'Run towers'}
    </button>
  )
}

/** Today vs AutoDock, computed from the strip and the measured tower footprint. */
function Stats() {
  const mode = useSceneStore((s) => s.mode)
  const st = spaceStats()
  return (
    <div className="stats">
      <div className={`stat ${mode === 'today' ? 'is-on' : ''}`}>
        <span className="stat__k">Surface strip today</span>
        <b>{st.today.cars} cars</b>
        <span>{fmt(st.today.area)} m² · {st.today.perCar.toFixed(1)} m² per car</span>
      </div>
      <div className={`stat ${mode === 'autodock' ? 'is-on' : ''}`}>
        <span className="stat__k">2 AutoDock towers</span>
        <b>{st.autodock.cars + st.keptBays} cars</b>
        <span>{st.autodock.cars} on {fmt(st.autodock.area)} m² · {st.autodock.perCar.toFixed(1)} m² per car, plus {st.keptBays} surface bays</span>
      </div>
      <div className="stat stat--big">
        <b>{st.densityGain.toFixed(1)}×</b>
        <span>cars per m² of ground in the towers, with the other {st.keptBays} surface bays still in use</span>
      </div>
    </div>
  )
}

export function Hud() {
  const mode = useSceneStore((s) => s.mode)
  return (
    <>
      <header className="hud-top">
        <div>
          <p className="kicker">AutoDock · digital twin</p>
          <h1>KINFRA Hi-Tech Park, Kalamassery</h1>
          <p className="sub">Example site: the Kerala Startup Mission building (KTIZ), Kalamassery, with two rotary towers on today's parking strip.</p>
        </div>
        <div className="hud-top__right">
          <NavLinks />
          <ModeSwitch />
        </div>
      </header>
      {mode === 'autodock' && <ControlRoom />}
      <aside className="hud-side">
        <Stats />
        {mode === 'autodock' && <SimCard />}
      </aside>
      <footer className="hud-bottom">
        <ViewSwitch />
        <SpinToggle />
        {mode === 'autodock' && <DriverPhone />}
        <span className="credit">Map data © OpenStreetMap contributors · heights estimated · tower and cars from the AutoDock demo</span>
      </footer>
    </>
  )
}
