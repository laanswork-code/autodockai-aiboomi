/*
 * /film: the driver's journey as a short film. The site, a car driving in,
 * Tower 2 and the driver, beside the real driver phone on the same clock.
 *
 * Plays in real time by default. With ?record the canvas only draws when
 * window.__film.seek(t) is called, so scripts/record-film.mjs in video/ can
 * step it frame by frame and every frame is exact, however slow the GPU.
 */
import { useProgress } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import type { Arrival, DecisionSet } from '../control/types'
import { Phone } from '../phone'
import { clock } from '../phone/plan'
import { SAMPLE_ARRIVAL } from '../phone/sample'
import { Scene } from '../scene/Scene'
import { FILM_PALLET, FILM_PLATE, FILM_TOWER, FilmRig } from './FilmRig'
import { useFilm } from './store'
import { CHAPTERS, captionAt, chapterAt, clockAt, phoneAt, smooth, T } from './timeline'
import './film.css'

const RECORD = new URLSearchParams(window.location.search).has('record')

const ARRIVAL: Arrival = {
  ...SAMPLE_ARRIVAL,
  id: 'film-1',
  bookedPlate: FILM_PLATE,
  plateRead: { text: FILM_PLATE.replace(/\s/g, ''), ocrConfidence: 0.97 },
  vehicle: { model: 'BYD Atto 3', ev: true, batteryKwh: 60, socPct: 32, fleet: null },
}
const jev = { arrivalId: ARRIVAL.id, source: 'jev', mode: 'auto', latencyMs: 0 } as const
const DECISIONS: DecisionSet = {
  bay: { ...jev, kind: 'bay', value: { tower: FILM_TOWER, pallet: FILM_PALLET }, confidence: 0.9, why: 'Eight hour stay: a pallet up the loop keeps the door pallets for short stops' },
  charge: { ...jev, kind: 'charge', value: 'now', confidence: 0.84, why: 'Full by about 14:10 for the drive to Kochi, mostly on rooftop solar' },
  price: { ...jev, kind: 'price', value: 'discount', confidence: 0.76, why: 'Quiet morning with pallets to spare earns the discount tier' },
  anomaly: { ...jev, kind: 'anomaly', value: { plateMismatch: 0.02, paymentRisk: 0.03, flag: false }, confidence: 0.96, why: 'Plate and payment match the booking' },
}

/** Real-time playback: film time follows the frame clock and loops. */
function Player() {
  useFrame(({ clock: c }) => useFilm.setState({ t: c.elapsedTime % T.total }))
  return null
}

/** Frame-stepped playback for the recorder. */
function Stepper() {
  const advance = useThree((s) => s.advance)
  const { active, progress } = useProgress()
  useEffect(() => {
    const w = window as unknown as { __film?: unknown }
    w.__film = {
      duration: T.total,
      ready: () => !active && progress === 100,
      seek: async (t: number) => {
        useFilm.setState({ t })
        advance(t)
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      },
    }
  }, [advance, active, progress])
  return null
}

const fadeIn = (t: number, at: number, len = 0.6) => smooth((t - at) / len)

function Overlay() {
  const t = useFilm((s) => s.t)
  const chapter = chapterAt(t)
  const caption = captionAt(t)
  const phone = phoneAt(t)
  const title = 1 - fadeIn(t, T.book - 0.8, 0.8)
  const end = fadeIn(t, T.end, 0.8)
  const ui = Math.min(1 - title, 1 - end)
  return (
    <div className="film-ui">
      <div className="film-stripe" />
      <header className="film-top" style={{ opacity: ui }}>
        <div className="film-brand"><b>AutoDock</b><span>Driver journey</span></div>
        <div className="film-clock">{t >= T.drive ? clock(clockAt(t)) : '08:22'}<span>{t >= T.lapse && t < T.pay ? 'time lapse' : 'Kalamassery'}</span></div>
      </header>

      <aside className="film-phone" style={{ opacity: ui, transform: `translateY(${(1 - ui) * 24}px)` }}>
        <Phone arrival={ARRIVAL} decisions={DECISIONS} film={phone} />
        <p>The driver app, step by step</p>
      </aside>

      <footer className="film-bottom" style={{ opacity: ui }}>
        {caption && <p key={caption} className="film-caption">{caption}</p>}
        <ol className="film-rail">
          {CHAPTERS.map((c, i) => (
            <li key={c.label} className={i === chapter ? 'is-on' : i < chapter ? 'is-done' : undefined}>
              <span>{i + 1}</span>{c.label}
            </li>
          ))}
        </ol>
      </footer>

      <section className="film-card" style={{ opacity: title }} aria-hidden={title === 0}>
        <p className="film-card__kicker">AutoDock</p>
        <h1>A driver's morning</h1>
        <p>Book from the car. Drive in. The tower does the rest.</p>
      </section>
      <section className="film-card film-card--end" style={{ opacity: end }} aria-hidden={end === 0}>
        <p className="film-card__kicker">AutoDock · our agent framework, built on Jev</p>
        <h1>Book. Drive. Dock. Charge. Pay.</h1>
        <p>No taps on arrival. No pallet promised twice. Charging on solar when the sun is up.</p>
        <small>Simulated demo: the car, traffic, bookings and payment are sample data.</small>
      </section>
    </div>
  )
}

export default function FilmPage() {
  return (
    <div className="film">
      <Canvas
        shadows="percentage"
        dpr={RECORD ? 1 : [1, 1.5]}
        frameloop={RECORD ? 'never' : 'always'}
        camera={{ position: [0, 60, 120], fov: 38, near: 0.3, far: 3000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: RECORD }}
      >
        <Suspense fallback={null}>
          <Scene film />
          <FilmRig />
        </Suspense>
        {RECORD ? <Stepper /> : <Player />}
      </Canvas>
      <Overlay />
    </div>
  )
}
