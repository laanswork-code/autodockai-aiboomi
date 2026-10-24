// Plays /play end to end in a real Chrome window and saves screenshots:
// log in, walk, get in, drive (speed, steering, wheel spin), book on the phone,
// stop in the pink circle, watch the tower park it, retrieve it, and see a
// second player in the same world.
//   node scripts/play-test.mjs [outDir]   (needs npm run dev and npm run game)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire(new URL('../../video/package.json', import.meta.url))
const puppeteer = require('puppeteer-core')
const BASE = process.env.APP_URL ?? 'http://localhost:5179'
const OUT = process.argv[2] ?? 'play-test'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.log(...a)
let failed = 0
const check = (ok, what) => { log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++ }

// one window per player, unthrottled, so both keep simulating while the other is in front
const launch = (x) => puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, defaultViewport: null,
  args: ['--window-size=1440,900', `--window-position=${x},0`, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
})
const browsers = []

async function join(name, plate, paint) {
  const browser = await launch(browsers.length * 60)
  browsers.push(browser)
  const p = (await browser.pages())[0] ?? await browser.newPage()
  await p.setViewport({ width: 1440, height: 860 })
  p.on('pageerror', (e) => log(`[${name}] page error:`, e.message))
  await p.goto(BASE + '/play', { waitUntil: 'load' })
  await p.waitForSelector('.gm-card input')
  const inputs = await p.$$('.gm-card input')
  await inputs[0].type(name)
  await inputs[1].type(plate)
  if (paint) await p.click(`button[aria-label="Paint ${paint}"]`)
  await p.click('.gm-primary')
  await p.waitForFunction(() => window.__game?.useGame.getState().status === 'playing', { timeout: 20000 })
  await wait(6000) // models and physics settle
  return p
}
const state = (p) => p.evaluate(() => {
  const { live, useGame } = window.__game
  const s = useGame.getState()
  return {
    mode: s.mode, car: s.car, booking: s.world?.bookings[s.me.plate] ?? null, players: Object.keys(s.players).length,
    foot: live.foot.toArray().map((v) => +v.toFixed(2)), carPos: live.car.toArray().map((v) => +v.toFixed(2)),
    speed: +live.speed.toFixed(2), steer: +live.steer.toFixed(3), spin: +live.spin.toFixed(2), carYaw: +live.carYaw.toFixed(3),
  }
})
const hold = async (p, key, ms) => { await p.keyboard.down(key); await wait(ms); await p.keyboard.up(key) }
const shot = (p, name) => p.screenshot({ path: `${OUT}/${name}.png` })

const a = await join('Asha', 'KL 07 AB 1234', '#c0392b')
let s = await state(a)
const spawnA = s.carPos
check(s.mode === 'foot' && s.car === 'world', `joined on foot next to the car (${JSON.stringify(s.foot)})`)
await shot(a, '01-joined')

// random spawns: 300 samples, none inside a building, all within reach of the towers
const spawns = await a.evaluate(async () => {
  const L = await import('/src/game/layout.ts')
  const C = await import('/src/config/site.ts')
  const { site } = await import('/src/data/site.ts')
  const polys = [C.mainFootprint(), C.MIDDLE_BLOCK.bottom, C.WEST_BLOCK.bottom, C.ledgeFootprint(), ...site.buildings.map((b) => b.pts)]
  const inside = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i]; const [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c } return c }
  const t = L.dropSpot(0)
  let bad = 0; let far = 0
  for (let i = 0; i < 300; i++) {
    const sp = L.randomSpawn()
    if (polys.some((p) => inside(sp.car.x, sp.car.z, p) || inside(sp.foot.x, sp.foot.z, p))) bad++
    if (Math.hypot(sp.car.x - t.x, sp.car.z - t.z) > 200) far++
  }
  return { bad, far }
})
check(spawns.bad === 0 && spawns.far === 0, `300 random spawns: ${spawns.bad} inside buildings, ${spawns.far} out of reach`)

await hold(a, 'w', 1500)
let s2 = await state(a)
const walked = Math.hypot(s2.foot[0] - s.foot[0], s2.foot[2] - s.foot[2])
check(walked > 1.8, `W walks forward (${walked.toFixed(2)} m in 1.5 s)`)
await hold(a, 's', 1500)

// get in: with no booking yet the phone opens and the car will not drive
await a.keyboard.press('e')
await wait(500)
s = await state(a)
check(s.mode === 'car', `E gets in the car (mode ${s.mode})`)
check(await a.evaluate(() => window.__game.useGame.getState().phone), 'getting in without a booking opens the phone')
const parkedAt = await state(a)
await hold(a, 'w', 1500)
s = await state(a)
const crept = Math.hypot(s.carPos[0] - parkedAt.carPos[0], s.carPos[2] - parkedAt.carPos[2])
check(crept < 0.3, `the car will not drive before a booking (moved ${crept.toFixed(2)} m)`)
await shot(a, '02-book-first')

// phone: book a slot
await a.evaluate(() => [...document.querySelectorAll('.gm-phone button')].find((b) => b.textContent === 'Book a slot')?.click())
await wait(800)
s = await state(a)
check(s.booking?.status === 'booked', `booking made: tower ${s.booking?.tower + 1}, pallet ${s.booking?.pallet + 1}`)
await shot(a, '04-booked')
await a.keyboard.press('p')
await wait(600)
check(!(await a.evaluate(() => window.__game.useGame.getState().phone)), 'P closes the phone')

// drive tests on a known stretch of the front road, facing the towers
const toRoad = () => a.evaluate(async () => {
  const C = await import('/src/config/site.ts')
  const { arcPoint } = await import('/src/lib/geo.ts')
  const t = C.STRIP_T_EAST - 60 / (C.FACADE.r + C.ROAD.offset)
  const [x, z] = arcPoint(C.FACADE, t, C.ROAD.offset + 1.8)
  const yaw = Math.atan2(-Math.sin(t), Math.cos(t))
  const h = window.__game.handles.car
  h.setTranslation({ x, y: 0.4, z }, true)
  h.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true)
  h.setLinvel({ x: 0, y: 0, z: 0 }, true); h.setAngvel({ x: 0, y: 0, z: 0 }, true)
})
await toRoad()
await wait(1200)
const before = await state(a)
await hold(a, 'w', 3000)
s = await state(a)
check(s.speed > 4, `W accelerates (${s.speed} m/s, ${(s.speed * 3.6).toFixed(0)} km/h)`)
check(Math.abs(s.spin - before.spin) > 3, `wheels spin with distance (${before.spin} to ${s.spin} rad)`)
const fast = s.speed
await hold(a, 's', 900)
s = await state(a)
check(fast - s.speed > 4, `S brakes (${fast} to ${s.speed} m/s in 0.9 s)`)
await toRoad()
await wait(800)
await hold(a, 'w', 1000)
await a.keyboard.down('w'); await a.keyboard.down('d'); await wait(700)
s = await state(a)
check(s.steer < -0.1, `D steers the front wheels right (${s.steer} rad)`)
await shot(a, '03-driving-steer')
await wait(900)
await a.keyboard.up('d'); await a.keyboard.up('w')
s2 = await state(a)
check(Math.abs(s2.carYaw - s.carYaw) > 0.1, `the car turns (${s.carYaw} to ${s2.carYaw})`)
await hold(a, 's', 1800)
s = await state(a)
check(s.speed < -0.5, `holding S after stopping reverses (${s.speed} m/s)`)
await hold(a, 'w', 600)
await shot(a, '06-route')
await a.keyboard.press('m')
await wait(600)
await shot(a, '06b-full-map')
await a.keyboard.press('m')

// a second player joins the same world
const b = await join('Ben', 'KL 01 CD 5678', '#1747a6')
await wait(1500)
s = await state(b)
// other people may be playing too, so count relative to what B sees
check(s.players >= 1, `B sees the other players (${s.players})`)
check((await b.$eval('.gm-online', (e) => e.textContent)).startsWith(`${s.players + 1} online`), `the HUD counts everyone, B included (${s.players + 1})`)
const spawnB = (await state(b)).carPos
const apart = Math.hypot(spawnA[0] - spawnB[0], spawnA[2] - spawnB[2])
check(apart > 4, `the two players spawned apart (${apart.toFixed(1)} m)`)
const tags = await b.$$eval('.gm-tag', (els) => els.map((e) => e.textContent))
check(tags.some((t) => t.includes('Asha') && t.includes('KL 07 AB 1234')), `B sees a name tag for Asha (${JSON.stringify(tags)})`)
await shot(b, '07-second-player')

// put A's car in the pink circle, stopped: the hand-over starts
const k = s.booking?.tower
await a.evaluate(() => {
  const { useGame, handles } = window.__game
  const st = useGame.getState()
  const bk = st.world.bookings[st.me.plate]
  // the drop circle sits on the road in front of the booked tower's door
  window.__drop = bk.tower
  handles.car.setLinvel({ x: 0, y: 0, z: 0 }, true)
})
const drop = await a.evaluate(async () => {
  const m = await import('/src/game/layout.ts')
  const st = window.__game.useGame.getState()
  const d = m.dropSpot(st.world.bookings[st.me.plate].tower)
  const h = window.__game.handles.car
  h.setTranslation({ x: d.x + 0.6, y: 0.5, z: d.z + 0.4 }, true)
  h.setLinvel({ x: 0, y: 0, z: 0 }, true)
  h.setAngvel({ x: 0, y: 0, z: 0 }, true)
  return d
})
await wait(1500)
s = await state(a)
check(s.car === 'docking' && s.mode === 'foot', `stopping in the pink circle starts the hand-over (car ${s.car}, ${s.mode})`)
await shot(a, '08-handover')
await wait(2500)
await shot(a, '09-reversing-in')
await wait(4000)
s = await state(a)
check(s.car === 'stored' && s.booking?.status === 'parked', `the tower parks it (car ${s.car}, booking ${s.booking?.status})`)
await shot(a, '10-parked')
await shot(b, '11-parked-seen-by-B')
await a.keyboard.press('l')
await wait(500)
const board = await a.$$eval('.gm-board-list li', (els) => els.map((e) => e.textContent))
check(board.some((t) => t.includes('Asha') && t.includes('KL 07 AB 1234')), `the leaderboard lists Asha (${board[0]})`)
await shot(a, '11b-leaderboard')
await a.keyboard.press('l')
const served = await a.evaluate(() => fetch('/game/board').then((r) => r.json()))
check(served.some((e) => e.plate === 'KL 07 AB 1234' && e.parks >= 1), 'the server serves the leaderboard at /game/board')

// retrieve
await a.keyboard.press('p')
await wait(400)
await a.evaluate(() => [...document.querySelectorAll('.gm-phone button')].find((b) => b.textContent === 'Retrieve my car')?.click())
await wait(1500)
await shot(a, '12-retrieving')
let out = false
for (let i = 0; i < 30 && !out; i++) { await wait(1000); s = await state(a); out = s.car === 'world' }
check(out && !s.booking, `the car comes back out and the booking closes (car ${s.car})`)
await shot(a, '13-collected')
log('drop spot', JSON.stringify(drop), 'tower', k)

// Esc: pause menu, then log out and come back under another name and car
await a.keyboard.press('Escape')
await wait(400)
check(!!(await a.$('.gm-menu')), 'Esc opens the pause menu')
await shot(a, '14-pause-menu')
await a.evaluate(() => [...document.querySelectorAll('.gm-menu button')].find((b) => b.textContent === 'Change name or car')?.click())
await a.waitForSelector('.gm-card input')
const prefilled = await a.$$eval('.gm-card input', (els) => els.map((e) => e.value))
check(prefilled[0] === 'Asha' && prefilled[1] === 'KL 07 AB 1234', `logging out brings back the card filled in (${prefilled.join(', ')})`)
const nameBox = (await a.$$('.gm-card input'))[0]
await nameBox.click({ clickCount: 3 })
await nameBox.type('Asha 2')
await a.evaluate(() => [...document.querySelectorAll('.gm-seg button')].find((b) => b.textContent === 'BYD Atto 3')?.click())
await a.click('.gm-primary')
await a.waitForFunction(() => window.__game?.useGame.getState().status === 'playing', { timeout: 20000 })
const again = await a.evaluate(() => { const m = window.__game.useGame.getState().me; return `${m.name} ${m.kind}` })
check(again === 'Asha 2 atto', `rejoined as a new name and car (${again})`)

await Promise.all(browsers.map((x) => x.close()))
log(failed ? `${failed} failed` : 'all passed')
process.exit(failed ? 1 : 0)
