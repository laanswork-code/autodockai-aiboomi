/*
 * The phone (P): book a pallet, see where to go, and call the car back down.
 * Built from the driver phone's own styles so it looks like the same app.
 */
import '../phone/phone.css'
import { send } from './net'
import { myBooking, useGame } from './store'

export function GamePhone() {
  const open = useGame((s) => s.phone)
  const me = useGame((s) => s.me)
  const b = useGame(myBooking)
  const car = useGame((s) => s.car)
  const world = useGame((s) => s.world)
  const set = useGame((s) => s.set)
  if (!open || !me) return null
  const free = world ? world.towers.map((t) => t.pallets.filter((p) => p === null).length) : [0, 0]

  return (
    <div className="gm-phone">
      <div className="ph-device" role="dialog" aria-label="Phone">
        <div className="ph-notch" aria-hidden="true" />
        <div className="ph-screen">
          <header className="ph-bar">
            <span>AutoDock</span>
            <button type="button" className="ph-close" onClick={() => set({ phone: false })}>Close</button>
          </header>
          <main className="ph-body">
            <section className="ph-card">
              <h2>{me.plate}</h2>
              <p className="ph-meta">{me.kind === 'seal' ? 'BYD Seal' : 'BYD Atto 3'} · {me.name}</p>
              {!b && (
                <>
                  <p className="ph-why">Tower 1: {free[0]} free pallets · Tower 2: {free[1]} free pallets</p>
                  <button type="button" className="ph-primary" onClick={() => send({ t: 'book' })}>Book a slot</button>
                </>
              )}
              {b && (
                <>
                  <p className="gm-slot">Tower {b.tower + 1}, pallet {b.pallet + 1}</p>
                  {b.status === 'booked' && car === 'world' && (
                    <p className="ph-instr">Follow the purple route and stop in the pink circle at Tower {b.tower + 1}. The tower takes it from there.</p>
                  )}
                  {b.status === 'booked' && car === 'docking' && <p className="ph-instr">Hand-over in progress: the tower is parking your car.</p>}
                  {b.status === 'parked' && (
                    <>
                      <p className="ph-instr ph-instr--go">Parked and charging. Call it back any time.</p>
                      <button type="button" className="ph-primary" onClick={() => { send({ t: 'retrieve' }); set({ phone: false }) }}>Retrieve my car</button>
                    </>
                  )}
                  {b.status === 'retrieving' && <p className="ph-instr">Your pallet is turning to the door. Walk to the pink circle at Tower {b.tower + 1}.</p>}
                </>
              )}
            </section>
          </main>
          <footer className="ph-foot">Press P or Esc to close</footer>
        </div>
      </div>
    </div>
  )
}
