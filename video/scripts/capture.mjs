// Captures the real product screens the film shows, from the app running locally
// (ksum-3d: `npm run dev` on :5179 and `npm run server` on :8788 for live Jev decisions).
//   node scripts/capture.mjs [shotName ...]   (no names: every shot)
// Writes assets/shots/<name>.png at 2x (3840x2160 for full frames) so punch-ins stay sharp.
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.APP_URL ?? 'http://localhost:5179'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = new URL('../assets/shots/', import.meta.url).pathname
await mkdir(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
})

async function page(url, scale = 2) {
  const p = await browser.newPage()
  await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: scale })
  await p.goto(BASE + url, { waitUntil: 'load', timeout: 120000 })
  return p
}
const click = (p, label) => p.evaluate((l) => {
  const el = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === l)
  el?.click()
  return Boolean(el)
}, label)
const scrollPage = (p, y) => p.evaluate((yy) => document.querySelector('.page')?.scrollTo({ top: yy, behavior: 'instant' }), y)
const shot = (p, name) => p.screenshot({ path: `${OUT}${name}.png` }).then(() => console.log('shot', name))
const crop = async (p, name, selector, pad = 16) => {
  const el = await p.$(selector)
  if (!el) return console.log('missing', name, selector)
  // bring it into view inside whatever scrolls (control room, .page), then let entrance motion settle
  await el.evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await wait(1400)
  const b = await el.boundingBox()
  await p.screenshot({ path: `${OUT}${name}.png`, clip: { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad } })
  console.log('crop', name)
}

const SHOTS = {
  // The full scene (trees, shadows) for the two establishing shots; software WebGL makes these slow.
  async twin() {
    const p = await page('/', 1)
    await wait(20000)
    await click(p, 'Today'); await wait(12000); await shot(p, 'twin-today')
    await click(p, 'With AutoDock'); await click(p, 'Hide'); await click(p, 'Towers'); await wait(15000); await shot(p, 'twin-towers')
    await p.close()
  },
  // Rush hour with live Jev decisions; lite mode so the page's network work is not starved.
  async rush() {
    const p = await page('/?lite')
    await wait(10000)
    await click(p, 'With AutoDock'); await wait(1500)
    await click(p, 'Rush hour')
    for (let i = 0; i < 40; i++) {
      await wait(1500)
      const misread = await p.evaluate(() => [...document.querySelectorAll('.qitem')].some((q) => q.textContent.includes('DE 5501')))
      if (misread) break
    }
    await wait(2500)
    await shot(p, 'rush-full')
    await crop(p, 'rush-review', '.qitem')
    await crop(p, 'rush-card', '.feed .dcard')
    await crop(p, 'rush-cost', '.cost')
    await crop(p, 'rush-energy', '.energy')
    await click(p, 'Approve'); await wait(2500)
    await crop(p, 'rush-log', '.evlog')
    await p.close()
  },
  // The driver's side: the phone a visitor uses, at arrival, docking and charging.
  async phone() {
    const p = await page('/?lite')
    await wait(10000)
    await click(p, 'With AutoDock'); await wait(1500)
    await click(p, 'Driver phone'); await wait(4000)
    await crop(p, 'phone-arrive', '.ph-device', 0)
    await click(p, 'I have arrived'); await wait(9000)
    await crop(p, 'phone-dock', '.ph-device', 0)
    await click(p, 'I have parked'); await wait(6000)
    await crop(p, 'phone-charge', '.ph-device', 0)
    await p.close()
  },
  async problems() {
    const p = await page('/problems')
    await wait(3000)
    await shot(p, 'problems-top')
    await scrollPage(p, 700); await wait(1200); await shot(p, 'problems-cards')
    await p.close()
  },
  async how() {
    const p = await page('/how')
    await wait(3000)
    await shot(p, 'how-top')
    await crop(p, 'how-pipe', '.how-pipe', 24)
    await crop(p, 'how-why', '.how-why', 24)
    await p.close()
  },
  async dashboard() {
    const p = await page('/dashboard')
    await wait(5000)
    await shot(p, 'dashboard-top')
    await scrollPage(p, 1350); await wait(1500); await shot(p, 'dashboard-sim')
    await p.close()
  },
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS)
for (const n of names) await SHOTS[n]()
await browser.close()
