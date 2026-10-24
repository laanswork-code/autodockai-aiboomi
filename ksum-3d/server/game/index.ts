/*
 * Multiplayer server for the parking game (/play). uWebSockets.js, one socket
 * per player. Run: npm run game (Node 24: uWS ships binaries for even Node
 * versions only). Vite proxies /game here in development.
 *
 * Players send their pose about 15 times a second; the server keeps the last
 * one and publishes everyone's in one batch per tick. Bookings, pallets and
 * tower doors live in ./state.ts and are pushed whenever they change.
 */
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import type { ClientMsg, PlayerInfo, Pose, ServerMsg } from '../../src/game/protocol.ts'
import { book, collected, createWorld, normalisePlate, park, release, retrieve } from './state.ts'

// uWS.js 20.71's ESM wrapper points at a missing index.js; its CommonJS entry is fine.
const uWS = createRequire(import.meta.url)('uWebSockets.js') as typeof import('uWebSockets.js')

const port = Number(process.env.GAME_PORT) || 8790
const TICK_MS = 66
const WORLD = 'world'

interface Conn { id: string; info: PlayerInfo | null }
const world = createWorld()
const players = new Map<string, PlayerInfo>()
const poses = new Map<string, Pose>()
const plates = new Set<string>()
let posesDirty = false

const enc = (m: ServerMsg) => JSON.stringify(m)
const name = (raw: unknown) => String(raw ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 18) || 'Driver'
const color = (raw: unknown) => (/^#[0-9a-f]{6}$/i.test(String(raw)) ? String(raw) : '#f2f2f0')

const app = uWS.App()
const publish = (m: ServerMsg) => app.publish(WORLD, enc(m))
const pushWorld = () => publish({ t: 'world', world })

app.ws<Conn>('/game', {
  compression: uWS.SHARED_COMPRESSOR,
  maxPayloadLength: 16 * 1024,
  idleTimeout: 60,
  upgrade: (res, req, ctx) => {
    res.upgrade<Conn>({ id: randomUUID().slice(0, 8), info: null },
      req.getHeader('sec-websocket-key'), req.getHeader('sec-websocket-protocol'), req.getHeader('sec-websocket-extensions'), ctx)
  },
  message: (ws, data) => {
    let msg: ClientMsg
    try { msg = JSON.parse(Buffer.from(data).toString()) } catch { return }
    const me = ws.getUserData()
    const fail = (message: string) => { ws.send(enc({ t: 'error', message })) }

    if (msg.t === 'hello') {
      if (me.info) return
      const plate = normalisePlate(String(msg.plate ?? ''))
      if (!plate) return fail('Enter a number plate, like KL 07 AB 1234')
      if (plates.has(plate)) return fail('That number plate is already in the game')
      me.info = { id: me.id, name: name(msg.name), plate, kind: msg.kind === 'atto' ? 'atto' : 'seal', color: color(msg.color) }
      plates.add(plate)
      ws.send(enc({ t: 'welcome', id: me.id, plate, world, players: [...players.values()] }))
      players.set(me.id, me.info)
      ws.subscribe(WORLD)
      publish({ t: 'join', player: me.info })
      console.log(`[game] ${me.info.name} (${plate}) joined, ${players.size} playing`)
      return
    }
    const info = me.info
    if (!info) return
    if (msg.t === 'pose') { poses.set(me.id, msg.pose); posesDirty = true; return }
    const r = msg.t === 'book' ? book(world, info.plate)
      : msg.t === 'park' ? park(world, info.plate, { kind: info.kind, color: info.color })
        : msg.t === 'retrieve' ? retrieve(world, info.plate)
          : msg.t === 'collected' ? collected(world, info.plate)
            : null
    if (r && 'error' in r) return fail(r.error)
    if (r) { console.log(`[game] ${info.plate} ${msg.t}`); pushWorld() }
  },
  close: (ws) => {
    const me = ws.getUserData()
    if (!me.info) return
    players.delete(me.id)
    poses.delete(me.id)
    plates.delete(me.info.plate)
    release(world, me.info.plate)
    publish({ t: 'leave', id: me.id })
    pushWorld()
    console.log(`[game] ${me.info.name} left, ${players.size} playing`)
  },
})

app.get('/health', (res) => {
  res.writeHeader('content-type', 'application/json').end(JSON.stringify({ ok: true, players: players.size, bookings: Object.keys(world.bookings).length }))
})

setInterval(() => {
  if (!posesDirty) return
  posesDirty = false
  publish({ t: 'poses', poses: Object.fromEntries(poses) })
}, TICK_MS)

app.listen(port, (token) => {
  if (!token) { console.error(`[game] could not listen on ${port}`); process.exit(1) }
  console.log(`[game] multiplayer server on ws://localhost:${port}/game`)
})
