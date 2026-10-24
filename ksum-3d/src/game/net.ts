/*
 * The socket to the game server. Vite proxies /game to it in development;
 * VITE_GAME_URL points somewhere else when the page is hosted apart from it.
 */
import type { ClientMsg, ServerMsg } from './protocol'
import { live, remote, shutterTarget, toast, useGame } from './store'

const POSE_MS = 66
let ws: WebSocket | null = null
let poseTimer = 0

const url = () => import.meta.env.VITE_GAME_URL
  ?? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/game`

export const send = (m: ClientMsg) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m)) }

export function connect(hello: Extract<ClientMsg, { t: 'hello' }>) {
  const g = useGame.getState()
  g.set({ status: 'connecting', error: null, last: { name: hello.name, plate: hello.plate, kind: hello.kind, color: hello.color } })
  ws?.close()
  const sock = new WebSocket(url())
  ws = sock
  sock.onopen = () => send(hello)
  sock.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as ServerMsg
    const s = useGame.getState()
    switch (m.t) {
      case 'welcome':
        s.set({
          status: 'playing', world: m.world,
          me: { id: m.id, name: hello.name, plate: m.plate, kind: hello.kind, color: hello.color },
          hasBooked: !!m.world.bookings[m.plate],
          players: Object.fromEntries(m.players.map((p) => [p.id, p])),
        })
        startPoses()
        break
      case 'world': {
        const plate = s.me?.plate ?? ''
        const was = s.world?.bookings[plate]
        const now = m.world.bookings[plate]
        s.set({ world: m.world, hasBooked: s.hasBooked || !!now })
        // just parked: say how long the hand-over took, and whether it is a personal best
        if (was?.status === 'booked' && now?.status === 'parked') {
          const secs = (Date.now() - now.at) / 1000
          const best = m.world.stats[plate]
          toast(best && Math.abs(best.bestMs / 1000 - secs) < 1.5 ? `Parked in ${secs.toFixed(1)} s · personal best` : `Parked in ${secs.toFixed(1)} s`, 4500)
        }
        break
      }
      case 'join':
        if (m.player.id !== s.me?.id) { s.set({ players: { ...s.players, [m.player.id]: m.player } }); toast(`${m.player.name} joined`) }
        break
      case 'leave': {
        const { [m.id]: gone, ...rest } = s.players
        remote.delete(m.id)
        s.set({ players: rest })
        if (gone) toast(`${gone.name} left`)
        break
      }
      case 'poses':
        for (const [id, p] of Object.entries(m.poses)) if (id !== s.me?.id) remote.set(id, p)
        break
      case 'error':
        if (s.status === 'connecting') s.set({ status: 'login', error: m.message })
        else toast(m.message)
        break
    }
  }
  sock.onclose = () => {
    if (ws !== sock) return
    window.clearInterval(poseTimer)
    const s = useGame.getState()
    if (s.status === 'playing') s.set({ status: 'offline' })
    else if (s.status === 'connecting') s.set({ status: 'login', error: 'Could not reach the game server. Is `npm run game` running?' })
  }
}

/** My pose, about 15 times a second. */
function startPoses() {
  window.clearInterval(poseTimer)
  poseTimer = window.setInterval(() => {
    const { mode } = useGame.getState()
    const r = (n: number) => Math.round(n * 100) / 100
    const r3 = (n: number) => Math.round(n * 1000) / 1000
    send({
      t: 'pose',
      pose: {
        x: r(live.foot.x), y: r(live.foot.y), z: r(live.foot.z), yaw: r(live.footYaw),
        mode, walked: r(live.walked), moving: r(live.moving),
        car: live.carVisible ? {
          x: r(live.car.x), y: r(live.car.y), z: r(live.car.z),
          qx: r3(live.carQuat.x), qy: r3(live.carQuat.y), qz: r3(live.carQuat.z), qw: r3(live.carQuat.w),
          steer: r(live.steer), spin: r(live.spin),
        } : undefined,
      },
    })
  }, POSE_MS)
}

export function disconnect() {
  window.clearInterval(poseTimer)
  const sock = ws
  ws = null
  sock?.close()
}

/**
 * Back to the login card, to come back under another name or car. The server
 * frees a booking that was never used; a parked car stays under its plate.
 */
export function logout() {
  disconnect()
  remote.clear()
  live.carVisible = true
  shutterTarget[0] = 0
  shutterTarget[1] = 0
  useGame.getState().set({
    status: 'login', error: null, me: null, world: null, players: {}, mode: 'foot', car: 'world',
    phone: false, map: false, board: false, menu: false, hasBooked: false, toast: null,
  })
}
