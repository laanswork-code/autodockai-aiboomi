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
check(s.mode === 'foot' && s.car === 'world', `joined on foot next to the car (${JSON.stringify(s.foot)})`)
await shot(a, '01-joined')

await hold(a, 'w', 1500)
let s2 = await state(a)
const walked = Math.hypot(s2.foot[0] - s.foot[0], s2.foot[2] - s.foot[2])
check(walked > 1.8, `W walks forward (${walked.toFixed(2)} m in 1.5 s)`)
await hold(a, 's', 1500)

// walk back toward the car and get in
await a.keyboard.press('e')
await wait(500)
s = await state(a)
check(s.mode === 'car', `E gets in the car (mode ${s.mode})`)
await shot(a, '02-in-car')

const before = await state(a)
await hold(a, 'w', 3000)
s = await state(a)
check(s.speed > 4, `W accelerates (${s.speed} m/s, ${(s.speed * 3.6).toFixed(0)} km/h)`)
check(Math.abs(s.spin - before.spin) > 3, `wheels spin with distance (${before.spin} to ${s.spin} rad)`)
const fast = s.speed
await hold(a, 's', 900)
s = await state(a)
check(fast - s.speed > 4, `S brakes (${fast} to ${s.speed} m/s in 0.9 s)`)
await hold(a, 'w', 1500)
await a.keyboard.down('w'); await a.keyboard.down('d'); await wait(700)
s = await state(a)
check(s.steer < -0.1, `D steers the front wheels right (${s.steer} rad)`)
await shot(a, '03-driving-steer')
await wait(1200)
await a.keyboard.up('d'); await a.keyboard.up('w')
s2 = await state(a)
check(Math.abs(s2.carYaw - s.carYaw) > 0.1, `the car turns (${s.carYaw} to ${s2.carYaw})`)
await hold(a, 's', 1500)
s = await state(a)
check(s.speed < -0.5, `holding S after stopping reverses (${s.speed} m/s)`)
await hold(a, 'w', 700)

// phone: book a slot
await a.keyboard.press('p')
await wait(500)
await shot(a, '04-phone')
await a.evaluate(() => [...document.querySelectorAll('.gm-phone button')].find((b) => b.textContent === 'Book a slot')?.click())
await wait(800)
s = await state(a)
check(s.booking?.status === 'booked', `booking made: tower ${s.booking?.tower + 1}, pallet ${s.booking?.pallet + 1}`)
await shot(a, '05-booked')
await a.keyboard.press('p')
await wait(1200)
check(!(await a.evaluate(() => window.__game.useGame.getState().phone)), 'P closes the phone again')
await shot(a, '06-route')
await a.keyboard.press('m')
await wait(600)
await shot(a, '06b-full-map')
await a.keyboard.press('m')

// a second player joins the same world
const b = await join('Ben', 'KL 01 CD 5678', '#1747a6')
await wait(1500)
s = await state(b)
check(s.players === 1, `B sees the other player (${s.players})`)
check((await b.$eval('.gm-online', (e) => e.textContent)).startsWith('2 online'), 'the HUD counts 2 online')
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

await Promise.all(browsers.map((x) => x.close()))
log(failed ? `${failed} failed` : 'all passed')
process.exit(failed ? 1 : 0)
