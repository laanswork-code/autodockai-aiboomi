/* What the player should head for next, shared by the 3D guidance, the HUD and the radar. */
import { dropSpot } from './layout'
import { live, myBooking, useGame } from './store'

export const PINK = '#ff3ea5'
export const ROUTE = '#b24dff'

/** What to aim for right now, or null. Shared with the HUD and minimap. */
export function objective(): { kind: 'car' | 'drop' | 'pickup'; x: number; z: number; tower: 0 | 1 } | null {
  const s = useGame.getState()
  const b = myBooking(s)
  if (!b) return null
  const d = dropSpot(b.tower)
  if (b.status === 'booked' && s.car === 'world') {
    return s.mode === 'car' ? { kind: 'drop', x: d.x, z: d.z, tower: b.tower } : { kind: 'car', x: live.car.x, z: live.car.z, tower: b.tower }
  }
  if (b.status === 'retrieving') return { kind: 'pickup', x: d.x, z: d.z, tower: b.tower }
  return null
}

