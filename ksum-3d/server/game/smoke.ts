/*
 * Two players against a running game server: join, see each other move, then
 * book, park, retrieve and collect. Run with the server up: node server/game/smoke.ts
 */
import type { ServerMsg, WorldState } from '../../src/game/protocol.ts'

const URL = process.env.GAME_URL ?? 'ws://localhost:8790/game'

function client(name: string, plate: string) {
  const ws = new WebSocket(URL)
  const inbox: ServerMsg[] = []
  const waiters: { test: (m: ServerMsg) => boolean; done: (m: ServerMsg) => void }[] = []
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data)) as ServerMsg
    const i = waiters.findIndex((w) => w.test(m))
    if (i >= 0) waiters.splice(i, 1)[0].done(m)
    else inbox.push(m)
  }
  const next = <T extends ServerMsg>(test: (m: ServerMsg) => boolean, ms = 3000) => new Promise<T>((done, fail) => {
    const i = inbox.findIndex(test)
    if (i >= 0) return done(inbox.splice(i, 1)[0] as T)
    const timer = setTimeout(() => fail(new Error(`${name}: timed out`)), ms)
    waiters.push({ test, done: (m) => { clearTimeout(timer); done(m as T) } })
  })
  const send = (m: object) => ws.send(JSON.stringify(m))
  const open = new Promise<void>((r) => { ws.onopen = () => { send({ t: 'hello', name, plate, kind: 'seal', color: '#c0392b' }); r() } })
  return { ws, next, send, open }
}

const check = (ok: boolean, what: string) => { if (!ok) throw new Error(`FAIL: ${what}`); console.log(`ok  ${what}`) }
const world = (m: ServerMsg) => (m as { world: WorldState }).world

const a = client('Asha', 'KL 07 SM 0001')
await a.open
const welcome = await a.next<Extract<ServerMsg, { t: 'welcome' }>>((m) => m.t === 'welcome')
check(welcome.plate === 'KL 07 SM 0001', 'A is welcomed with a normalised plate')

const b = client('Ben', 'kl 07 sm 0002')
await b.open
await b.next((m) => m.t === 'welcome')
check((await a.next((m) => m.t === 'join')).t === 'join', 'A hears B join')

const dup = client('Copy', 'KL 07 SM 0001')
await dup.open
check((await dup.next((m) => m.t === 'error')).t === 'error', 'a plate already in play is refused')
dup.ws.close()

b.send({ t: 'pose', pose: { x: 1, y: 0, z: 2, yaw: 0, mode: 'foot', walked: 0, moving: 0 } })
const poses = await a.next<Extract<ServerMsg, { t: 'poses' }>>((m) => m.t === 'poses')
check(Object.values(poses.poses).some((p) => p.x === 1 && p.z === 2), 'A receives B\'s pose')

a.send({ t: 'book' })
let w = world(await a.next((m) => m.t === 'world' && !!world(m).bookings['KL 07 SM 0001']))
const bk = w.bookings['KL 07 SM 0001']
check(bk.status === 'booked' && w.towers[bk.tower].door === bk.pallet, `A books tower ${bk.tower + 1}, pallet ${bk.pallet + 1}, and the tower turns to it`)

a.send({ t: 'park' })
w = world(await a.next((m) => m.t === 'world' && world(m).bookings['KL 07 SM 0001']?.status === 'parked'))
check(w.towers[bk.tower].pallets[bk.pallet]?.plate === 'KL 07 SM 0001', 'A\'s car is on its pallet')

a.send({ t: 'retrieve' })
w = world(await a.next((m) => m.t === 'world' && world(m).bookings['KL 07 SM 0001']?.status === 'retrieving'))
check(w.towers[bk.tower].door === bk.pallet, 'retrieving brings A\'s pallet back to the door')

a.send({ t: 'collected' })
w = world(await a.next((m) => m.t === 'world' && !world(m).bookings['KL 07 SM 0001']))
check(w.towers[bk.tower].pallets[bk.pallet] === null, 'collecting frees the pallet')

b.ws.close()
check((await a.next((m) => m.t === 'leave')).t === 'leave', 'A hears B leave')
a.ws.close()
console.log('smoke passed')
