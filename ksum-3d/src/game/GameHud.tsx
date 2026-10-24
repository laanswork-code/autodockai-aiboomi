/*
 * On-screen layer: the objective line, a speedometer while driving, the
 * "press E" prompt and toasts. The radar and full map are in MapView.
 * Frame-rate values are read from `live` in an animation-frame loop, so the
 * HUD does not re-render React 60 times a second.
 */
import { useEffect, useState } from 'react'
import { objective } from './guide'
import { routeLength, routeTo } from './layout'
import { Radar } from './MapView'
import { live, myBooking, useGame } from './store'

/** Values that change every frame, sampled a few times a second. */
function useLive() {
  const [v, setV] = useState({ kmh: 0, near: false, metres: 0 })
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = useGame.getState()
      const o = objective()
      const at = s.mode === 'car' ? live.car : live.foot
      setV({
        kmh: Math.round(Math.abs(live.speed) * 3.6),
        near: s.mode === 'foot' && s.car === 'world' && live.foot.distanceTo(live.car) < 3.4,
        metres: o ? Math.round(o.kind === 'car' ? Math.hypot(o.x - at.x, o.z - at.z) : routeLength(routeTo(o.tower, at.x, at.z))) : 0,
      })
    }, 120)
    return () => window.clearInterval(id)
  }, [])
  return v
}

export function GameHud() {
  const me = useGame((s) => s.me)
  const mode = useGame((s) => s.mode)
  const car = useGame((s) => s.car)
  const b = useGame(myBooking)
  const toastText = useGame((s) => s.toast)
  // the player list holds everyone else, so add one for me
  const count = useGame((s) => Object.keys(s.players).length + 1)
  const status = useGame((s) => s.status)
  const { kmh, near, metres } = useLive()

  const hasBooked = useGame((s) => s.hasBooked)
  let goal = 'Press P to book a parking slot'
  if (!b && !hasBooked && mode === 'car') goal = 'Book a slot to start driving: press P'
  if (b?.status === 'booked' && car === 'world') goal = mode === 'car' ? `Drive to Tower ${b.tower + 1} · ${metres} m` : `Get in your car · ${metres} m`
  else if (car === 'docking') goal = `Tower ${b ? b.tower + 1 : ''} is parking your car`
  else if (b?.status === 'parked') goal = `Parked on Tower ${b.tower + 1}, pallet ${b.pallet + 1} · P to retrieve`
  else if (b?.status === 'retrieving') goal = car === 'undocking' ? 'Your car is coming out' : `Your car is on its way down · ${metres} m to Tower ${b.tower + 1}`

  return (
    <div className="gm-hud">
      <div className="gm-top">
        <p className="gm-goal">{goal}</p>
        {toastText && <p className="gm-toast" role="status">{toastText}</p>}
      </div>
      <div className="gm-me">
        <strong>{me?.name}</strong>
        <span className="gm-plate-tag">{me?.plate}</span>
        <span className="gm-online">{count} online{status === 'offline' ? ' · disconnected' : ''}</span>
      </div>
      <Radar />
      {mode === 'car' && (
        <div className="gm-speed" aria-label="Speed">
          <strong>{kmh}</strong><span>km/h</span>
        </div>
      )}
      {near && <p className="gm-prompt">Press <kbd>E</kbd> to get in</p>}
      <p className="gm-help">Esc menu · WASD move · E in/out · P phone · M map · L leaderboard · V camera · Space handbrake · R reset car</p>
    </div>
  )
}
