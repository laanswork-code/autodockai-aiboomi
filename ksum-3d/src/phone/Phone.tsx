/*
 * Driver phone mockup: arrive, dock, charge, pay by UPI. It shows what the
 * decision layer means for one driver. With no props it runs on sample data
 * and says so. Payment is a mock: nothing leaves the page.
 */
import { useEffect, useState } from 'react'
import type { Arrival, Decision, DecisionSet } from '../control/types'
import { QrPlaceholder } from './Qr'
import { SAMPLE_ARRIVAL, SAMPLE_DECISIONS } from './sample'
import { bill, chargeWords, clock, inr, targetSoc, TIER_LABEL } from './plan'
import './phone.css'

export interface PhoneProps {
  arrival?: Arrival
  decisions?: DecisionSet
  onClose?: () => void
}

type Step = 'arrive' | 'dock' | 'charge' | 'pay' | 'upi' | 'paid'
const TABS: { id: Step; label: string }[] = [
  { id: 'arrive', label: 'Arrive' },
  { id: 'dock', label: 'Dock' },
  { id: 'charge', label: 'Charge' },
  { id: 'pay', label: 'Pay' },
]
const TAB_OF: Record<Step, Step> = { arrive: 'arrive', dock: 'dock', charge: 'charge', pay: 'pay', upi: 'pay', paid: 'pay' }
const STAYS = [60, 120, 240, 480, 720]
const PAYEE = 'autodock@upi'
/**
 * Demo clock: one tick per 100 ms of wall time. Rotation takes 50 ticks (5 s,
 * matching --ph-dock-ms in phone.css); charging adds 1% per tick. Ticks only
 * drive the text and the button: the ring and the dock bar animate in CSS.
 * Ticks come from elapsed time, not a count of interval callbacks, so the text
 * stays in step with the CSS even when the WebGL frame starves the timer.
 */
const TICK_MS = 100
const ROTATE_TICKS = 50

const stayLabel = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`)

/** Small pill when a decision is waiting for an operator instead of acting on its own. */
function Review({ d }: { d: Decision }) {
  if (d.mode !== 'review') return null
  return <p className="ph-review">An operator is confirming this ({Math.round(d.confidence * 100)}% sure)</p>
}

export function Phone({ arrival, decisions, onClose }: PhoneProps) {
  const demo = !arrival || !decisions
  const a = arrival ?? SAMPLE_ARRIVAL
  const d = decisions ?? SAMPLE_DECISIONS

  const [step, setStep] = useState<Step>('arrive')
  const [plate, setPlate] = useState(a.bookedPlate)
  const [stay, setStay] = useState<number | null>(a.plannedStayMin)
  const [note, setNote] = useState(a.note)
  const [elapsedMs, setElapsedMs] = useState(0)
  const ticks = Math.floor(elapsedMs / TICK_MS)

  const go = (s: Step) => { setStep(s); setElapsedMs(0) }

  // drives the rotation and charge animations; values are derived from ticks
  const animating = step === 'dock' || (step === 'charge' && d.charge.value === 'now')
  useEffect(() => {
    if (!animating) return
    const t0 = performance.now()
    const id = window.setInterval(() => setElapsedMs(performance.now() - t0), TICK_MS)
    return () => window.clearInterval(id)
  }, [animating, step])

  const { tower, pallet } = d.bay.value
  const rotatePct = Math.min(100, (ticks / ROTATE_TICKS) * 100)
  const target = targetSoc(note)
  const startSoc = a.vehicle.socPct
  const soc = d.charge.value === 'now' ? Math.min(target, startSoc + ticks) : startSoc
  const plan = chargeWords(a.vehicle.ev ? d.charge.value : 'no_charge', a.t)
  const b = bill(a, d.charge.value, d.price.value, note, stay)
  const upiUri = `upi://pay?pa=${PAYEE}&pn=AutoDock&am=${b.total}&cu=INR&tn=${encodeURIComponent(plate)}`
  const source = d.bay.source === 'jev' ? 'Jev' : 'rules (fallback)'

  return (
    <div className="ph-device" role="dialog" aria-label="Driver phone">
      <div className="ph-notch" aria-hidden="true" />
      <div className="ph-screen">
        <header className="ph-bar">
          <span>{clock(a.t)}</span>
          {onClose ? <button type="button" className="ph-close" onClick={onClose} aria-label="Close phone">Close</button> : <span />}
        </header>
        {demo && <p className="ph-demo">Sample data, simulated</p>}

        <nav className="ph-tabs" aria-label="Steps">
          {TABS.map((t) => (
            <span key={t.id} className="ph-tab" aria-current={TAB_OF[step] === t.id ? 'step' : undefined}>{t.label}</span>
          ))}
        </nav>

        <main className="ph-body">
          {step === 'arrive' && (
            <form className="ph-card" onSubmit={(e) => { e.preventDefault(); go('dock') }}>
              <h2>Your booking</h2>
              <label className="ph-field">
                <span>Plate</span>
                <input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} autoComplete="off" />
              </label>
              <label className="ph-field">
                <span>Planned stay</span>
                <select value={stay ?? ''} onChange={(e) => setStay(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Not sure</option>
                  {STAYS.map((m) => <option key={m} value={m}>{stayLabel(m)}</option>)}
                </select>
              </label>
              <label className="ph-field">
                <span>Note</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. back by 6, need full charge" />
                <small>Jev reads this note to plan your bay and charge.</small>
              </label>
              <p className="ph-meta">{a.vehicle.model}{a.vehicle.ev ? `, battery at ${startSoc}%` : ''}</p>
              {d.anomaly.value.flag && <p className="ph-review">Plate or payment check: an operator will confirm at the gate</p>}
              <button type="submit" className="ph-primary">I have arrived</button>
            </form>
          )}

          {step === 'dock' && (
            <section className="ph-card">
              <h2>Tower {tower + 1}, pallet {pallet + 1}</h2>
              <p className="ph-why">{d.bay.why}</p>
              <Review d={d.bay} />
              <div className="ph-rotor" aria-hidden="true">
                <div className="ph-rotor__ring">
                  <span className="ph-rotor__pallet" />
                </div>
                <b>{Math.round(rotatePct)}%</b>
              </div>
              <div className="ph-progress ph-progress--dock" role="progressbar" aria-label="Pallet rotation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rotatePct)}>
                <span />
              </div>
              {rotatePct < 100
                ? <p className="ph-instr">Pallet {pallet + 1} is turning to the door. Wait at the line.</p>
                : <p className="ph-instr ph-instr--go">Drive in, the door is open. Engine off, take your key.</p>}
              <button type="button" className="ph-primary" disabled={rotatePct < 100} onClick={() => go('charge')}>I have parked</button>
            </section>
          )}

          {step === 'charge' && (
            <section className="ph-card">
              <h2>{plan.title}</h2>
              <p>{plan.detail}</p>
              <Review d={d.charge} />
              {a.vehicle.ev && (
                <>
                  <div className="ph-soc">
                    <b>{Math.round(soc)}%</b>
                    <span>target {target}%</span>
                  </div>
                  <div className="ph-progress ph-progress--go" role="progressbar" aria-label="State of charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(soc)}>
                    <span style={{ transform: `scaleX(${soc / 100})` }} />
                  </div>
                </>
              )}
              <dl className="ph-lines">
                <div><dt>Energy</dt><dd>{b.kwh.toFixed(1)} kWh</dd></div>
                <div><dt>Charging estimate</dt><dd>{inr(b.energy)}</dd></div>
              </dl>
              <p className="ph-why">{d.charge.why}</p>
              <button type="button" className="ph-primary" onClick={() => go('pay')}>Collect car and pay</button>
            </section>
          )}

          {step === 'pay' && (
            <section className="ph-card">
              <h2>Your bill</h2>
              <dl className="ph-lines">
                <div><dt>Parking, {b.hours} h at {TIER_LABEL[d.price.value]} rate</dt><dd>{inr(b.parking)}</dd></div>
                <div><dt>Charging, {b.kwh.toFixed(1)} kWh</dt><dd>{inr(b.energy)}</dd></div>
                <div className="ph-total"><dt>Total</dt><dd>{inr(b.total)}</dd></div>
              </dl>
              <p className="ph-why">{d.price.why}</p>
              <Review d={d.price} />
              <button type="button" className="ph-primary" onClick={() => go('upi')}>Pay {inr(b.total)} by UPI</button>
            </section>
          )}

          {step === 'upi' && (
            <section className="ph-card ph-upi">
              <p className="ph-demo">Demo only, no real payment</p>
              <h2>Pay {inr(b.total)}</h2>
              <p className="ph-meta">To AutoDock, <b>{PAYEE}</b></p>
              <QrPlaceholder text={upiUri} />
              <code className="ph-uri">{upiUri}</code>
              <button type="button" className="ph-primary" onClick={() => go('paid')}>Approve in UPI app (demo)</button>
              <button type="button" className="ph-ghost" onClick={() => go('pay')}>Back</button>
            </section>
          )}

          {step === 'paid' && (
            <section className="ph-card ph-paid">
              <svg viewBox="0 0 48 48" width={64} height={64} aria-hidden="true">
                <circle cx={24} cy={24} r={22} fill="var(--go, #2f9e5b)" />
                <path d="M14 25l7 7 13-15" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2>Paid {inr(b.total)}</h2>
              <p>Your car is on its way to the door of tower {tower + 1}.</p>
              <p className="ph-demo">Simulated payment, no money moved</p>
              <button type="button" className="ph-ghost" onClick={() => go('arrive')}>Start again</button>
            </section>
          )}
        </main>

        <footer className="ph-foot">Decided by {source}</footer>
      </div>
    </div>
  )
}
