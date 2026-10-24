import { useState, type FormEvent } from 'react'
import { Link, Logo } from '../Nav'
import { BoardPreview } from './Leaderboard'
import { connect } from './net'
import { isPlate, randomPlate } from './plates'
import type { CarKind } from './protocol'
import { useGame } from './store'

const PAINTS = ['#c0392b', '#1747a6', '#f2f2f0', '#1b1c1f', '#2e8b57', '#f0b91c', '#7a1e22', '#a9adb2']
/** The controls, shown as key caps on the login card. */
const KEYS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Move, or the arrow keys'],
  [['E'], 'Get in or out'],
  [['P'], 'Phone'],
  [['M'], 'Map'],
  [['L'], 'Leaderboard'],
  [['V'], 'Camera'],
  [['Shift'], 'Run'],
  [['Space'], 'Handbrake'],
  [['Esc'], 'Menu'],
]
/** Join the game: a name, the car's number plate, which car, what colour. */
export function Login() {
  const status = useGame((s) => s.status)
  const error = useGame((s) => s.error)
  // after logging out, the card comes back filled in, ready to change a name or a car
  const last = useGame((s) => s.last)
  const [name, setName] = useState(last?.name ?? '')
  const [plate, setPlate] = useState(last?.plate ?? '')
  const [kind, setKind] = useState<CarKind>(last?.kind ?? 'seal')
  const [color, setColor] = useState(last?.color ?? PAINTS[0])
  const clean = plate.toUpperCase().replace(/\s+/g, ' ').trim()
  const ok = isPlate(clean)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    connect({ t: 'hello', name: name.trim() || 'Driver', plate: clean, kind, color })
  }

  return (
    <div className="gm-login">
      <form className="gm-card" onSubmit={submit}>
        <div className="gm-intro">
          <Logo />
          <p className="ad-label ad-label--live">Multiplayer</p>
          <h1>Park it at KSUM</h1>
          <p className="gm-lede">Drive in, book a pallet on your phone, follow the route, and hand your car to the tower. Everyone here plays in the same world.</p>
        </div>
        <div className="gm-aside">
          <dl className="gm-keys" aria-label="Controls">
            {KEYS.map(([k, what]) => (
              <div key={what}><dt>{k.map((x) => <kbd key={x}>{x}</kbd>)}</dt><dd>{what}</dd></div>
            ))}
          </dl>
          <Link to="/" className="gm-back">Back to the digital twin</Link>
        </div>
        <div className="gm-form">
          <label className="gm-field">
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} placeholder="Asha" autoComplete="nickname" />
          </label>
          <label className="gm-field">
            <span>Vehicle number</span>
            <span className="gm-plate-row">
              <input className="gm-plate" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={13} placeholder="KL 07 AB 1234" required
                aria-invalid={plate !== '' && !ok} autoCapitalize="characters" spellCheck={false} />
              <button type="button" className="gm-random" onClick={() => setPlate(randomPlate())}>Random</button>
            </span>
          </label>
          {plate !== '' && !ok && <p className="gm-hint">Use an Indian plate, like KL 07 AB 1234</p>}
          <fieldset className="gm-field">
            <legend>Car</legend>
            <div className="gm-seg">
              {(['seal', 'atto'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'seal' ? 'BYD Seal' : 'BYD Atto 3'}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="gm-field">
            <legend>Paint</legend>
            <div className="gm-paints">
              {PAINTS.map((p) => (
                <button key={p} type="button" aria-label={`Paint ${p}`} aria-pressed={color === p} style={{ background: p }} onClick={() => setColor(p)} />
              ))}
            </div>
          </fieldset>
          {error && <p className="gm-error" role="alert">{error}</p>}
          <button className="gm-primary ad-btn" type="submit" disabled={!ok || status === 'connecting'}>
            {status === 'connecting' ? 'Joining…' : 'Play'}
          </button>
          <BoardPreview />
        </div>
      </form>
    </div>
  )
}
