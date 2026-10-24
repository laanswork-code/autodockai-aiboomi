import { useState, type FormEvent } from 'react'
import { Link } from '../Nav'
import { connect } from './net'
import { isPlate, randomPlate } from './plates'
import type { CarKind } from './protocol'
import { useGame } from './store'

const PAINTS = ['#c0392b', '#1747a6', '#f2f2f0', '#1b1c1f', '#2e8b57', '#f0b91c', '#7a1e22', '#a9adb2']
/** Join the game: a name, the car's number plate, which car, what colour. */
export function Login() {
  const status = useGame((s) => s.status)
  const error = useGame((s) => s.error)
  const [name, setName] = useState('')
  const [plate, setPlate] = useState('')
  const [kind, setKind] = useState<CarKind>('seal')
  const [color, setColor] = useState(PAINTS[0])
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
        <p className="gm-kicker">AutoDock · Multiplayer</p>
        <h1>Park it at KSUM</h1>
        <p className="gm-lede">Drive in, book a pallet on your phone, follow the route, and hand your car to the tower. Everyone here plays in the same world.</p>
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
        <button className="gm-primary" type="submit" disabled={!ok || status === 'connecting'}>
          {status === 'connecting' ? 'Joining…' : 'Play'}
        </button>
        <p className="gm-keys">W A S D or arrows to move · E get in or out · P phone · M map · V camera · Shift run · Space handbrake</p>
        <Link to="/" className="gm-back">Back to the digital twin</Link>
      </form>
    </div>
  )
}
