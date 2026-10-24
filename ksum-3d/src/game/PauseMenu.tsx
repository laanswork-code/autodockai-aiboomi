import { navigate } from '../route'
import { logout } from './net'
import { useGame } from './store'

/** Esc: resume, log out to change name or car, or leave for the digital twin. */
export function PauseMenu() {
  const open = useGame((s) => s.menu)
  const me = useGame((s) => s.me)
  const set = useGame((s) => s.set)
  if (!open || !me) return null
  return (
    <div className="gm-menu" role="dialog" aria-label="Paused">
      <div className="gm-menu-card">
        <p className="gm-kicker">Paused</p>
        <h2>{me.name}</h2>
        <p className="gm-menu-sub"><span className="gm-plate-tag">{me.plate}</span> {me.kind === 'seal' ? 'BYD Seal' : 'BYD Atto 3'}</p>
        <button type="button" className="gm-primary" autoFocus onClick={() => set({ menu: false })}>Resume</button>
        <button type="button" className="gm-secondary" onClick={logout}>Change name or car</button>
        <button type="button" className="gm-secondary" onClick={() => { logout(); navigate('/') }}>Leave game</button>
        <p className="gm-menu-note">A car you have parked stays in its tower under your plate. Come back with the same plate to collect it.</p>
        <p className="gm-board-foot">Esc to resume</p>
      </div>
    </div>
  )
}
