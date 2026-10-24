// Records the product demo (docs/demo/demo.mp4): a tour of the running app, no narration.
// Needs the app (ksum-3d: `npm run dev` on :5179) and the decision server (`npm run server` on :8788).
//   node scripts/record-demo.mjs
// Runs a visible Chrome window so the 3D scene renders on the GPU.
import puppeteer from 'puppeteer-core'
import { execFileSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'

const BASE = process.env.APP_URL ?? 'http://localhost:5179'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = new URL('../renders/', import.meta.url).pathname
const FINAL = new URL('../../docs/demo/demo.mp4', import.meta.url).pathname
await mkdir(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, defaultViewport: null,
  args: ['--window-size=1600,940', '--hide-scrollbars', '--disable-infobars'],
})
const p = (await browser.pages())[0] ?? await browser.newPage()
await p.setViewport({ width: 1600, height: 900 })

// Retries once if a dev-server reload swaps the page under us.
const click = async (label) => {
  for (let i = 0; i < 3; i++) {
    try {
      return await p.evaluate((l) => {
        const el = [...document.querySelectorAll('button, a')].find((x) => x.textContent.trim() === l)
        el?.click()
        return Boolean(el)
      }, label)
    } catch { await wait(3000) }
  }
  return false
}
// Smooth scroll of the page's scroller, in small steps so the recording reads as a person scrolling.
const scroll = async (to, ms) => {
  const steps = Math.round(ms / 40)
  const from = await p.evaluate(() => (document.querySelector('.page') ?? document.scrollingElement).scrollTop)
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const y = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2)
    await p.evaluate((yy) => (document.querySelector('.page') ?? document.scrollingElement).scrollTo(0, yy), y)
    await wait(40)
  }
}
const height = () => p.evaluate(() => { const s = document.querySelector('.page') ?? document.scrollingElement; return s.scrollHeight - s.clientHeight })

// Load the twin before recording so the first seconds are not a loading screen.
await p.goto(BASE + '/', { waitUntil: 'load', timeout: 120000 })
await wait(8000)
await click('Today'); await wait(2000)

const rec = await p.screencast({ path: OUT + 'demo-raw.webm' })

// 1. The site today, then with two towers on four bays.
await wait(4500)
await click('With AutoDock'); await wait(4500)
await click('Towers'); await wait(5000)

// 2. Rush hour: live Jev decisions, an operator approves the flagged plate.
await click('Rush hour')
for (let i = 0; i < 20; i++) {
  await wait(1000)
  if (await p.evaluate(() => document.querySelectorAll('.qitem').length > 0) && i >= 8) break
}
await wait(3000)
await click('Approve'); await wait(3500)

// 3. The driver's phone: connect the car, book, arrive, dock, charge, pay.
await click('Driver phone'); await wait(2500)
await p.evaluate(() => document.querySelector('.ph-device .ph-primary')?.click()); await wait(4000)
await p.evaluate(() => document.querySelector('.ph-device .ph-primary')?.click()); await wait(2500)
await wait(12000) // drive skipped, gate recognises the car, pallet turns
await click('I have parked'); await wait(4500)
await click('Collect car and pay'); await wait(4000)
await click('Close'); await wait(1500)

// 4. How it works, including why Jev and not a chat model.
await p.goto(BASE + '/how', { waitUntil: 'load' }); await wait(3000)
await scroll((await height()) * 0.5, 9000); await wait(1500)
await scroll(await height(), 9000); await wait(2000)

// 5. The operator dashboard.
await p.goto(BASE + '/dashboard', { waitUntil: 'load' }); await wait(4000)
await scroll(await height(), 9000); await wait(2000)

// 6. The problems page: 474 real complaints, each linked to the source.
await p.goto(BASE + '/problems', { waitUntil: 'load' }); await wait(3500)
await scroll(1600, 7000); await wait(2500)

await rec.stop()
await browser.close()

// Constant 30 fps H.264 for the README.
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', OUT + 'demo-raw.webm', '-vf', 'fps=30,scale=1600:-2',
  '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', FINAL])
console.log('wrote', FINAL)
