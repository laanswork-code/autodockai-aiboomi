// Renders the driver-journey film (docs/demo/driver-journey.mp4) from the app's /film page, frame by frame.
// Needs the app running (ksum-3d: `npm run dev` on :5179). No decision server needed: the film is scripted.
//   node scripts/record-film.mjs                 the whole film at 30 fps, with the music bed
//   node scripts/record-film.mjs --stills 20,31  single frames at those seconds, for checking shots
//   node scripts/record-film.mjs --mux           redo only the sound on the last render (no app needed)
// Narration comes from assets/voice-film/ (scripts/voiceover.mjs --script film-script.json), laid at
// each line's start time, with the music ducked under it.
// Runs a visible Chrome window so the 3D scene renders on the GPU.
import puppeteer from 'puppeteer-core'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const BASE = process.env.APP_URL ?? 'http://localhost:5179'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = new URL('../renders/', import.meta.url).pathname
const FINAL = new URL('../../docs/demo/driver-journey.mp4', import.meta.url).pathname
const MUSIC = new URL('../assets/music/bed.mp3', import.meta.url).pathname
const VOICE = new URL('../assets/voice-film/', import.meta.url).pathname
const DURATION = 77
const FPS = 30
const W = 1920
const H = 1080
await mkdir(OUT, { recursive: true })

const raw = OUT + 'film-raw.mp4'

/** Music bed under the narration lines, ducked while the voice speaks; final encode small enough for the repo. */
async function mux(duration) {
  const timing = JSON.parse(await readFile(VOICE + 'timing.json', 'utf8'))
  const lines = timing.order
  const inputs = ['-i', raw, '-i', MUSIC, ...lines.flatMap((l) => ['-i', `${VOICE}${l.id}.mp3`])]
  const placed = lines.map((l, i) => `[${i + 2}:a]adelay=${Math.round(l.start * 1000)}:all=1[v${i}]`).join(';')
  const graph = [
    placed,
    `${lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad,atrim=0:${duration},asplit=2[voice][key]`,
    `[1:a]atrim=0:${duration},afade=t=in:d=1.5,afade=t=out:st=${duration - 3}:d=3,volume=0.55[bed]`,
    `[bed][key]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=450[ducked]`,
    `[ducked][voice]amix=inputs=2:normalize=0,volume=1.35,alimiter=limit=0.95[a]`,
  ].join(';')
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph,
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', FINAL])
  console.log('wrote', FINAL)
}

if (process.argv.includes('--mux')) { await mux(DURATION); process.exit(0) }

const stillsArg = process.argv.indexOf('--stills')
const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: false, defaultViewport: null,
  args: [`--window-size=${W},${H + 140}`, '--hide-scrollbars', '--disable-infobars', '--force-device-scale-factor=1'],
})
const p = (await browser.pages())[0] ?? await browser.newPage()
await p.setViewport({ width: W, height: H })
p.on('pageerror', (e) => console.error('page error:', e.message))
await p.goto(BASE + '/film?record', { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => window.__film?.ready(), { timeout: 180000, polling: 500 })
// let textures upload and shadows settle before the first frame
await p.evaluate(() => window.__film.seek(0))
await new Promise((r) => setTimeout(r, 2000))

const frame = async (t) => {
  await p.evaluate((tt) => window.__film.seek(tt), t)
  return p.screenshot({ type: 'jpeg', quality: 92 })
}

if (stills) {
  // the tower and the film clock integrate time, so step up to each still in order
  const sorted = [...stills].sort((a, b) => a - b)
  let t = 0
  for (const s of sorted) {
    for (; t < s; t += 1 / FPS) await p.evaluate((tt) => window.__film.seek(tt), t)
    await writeFile(`${OUT}film-${s}.jpg`, await frame(s))
    console.log('still', s, await p.evaluate(() => document.querySelector('.film-clock')?.outerHTML))
  }
  await browser.close()
  process.exit(0)
}

const duration = await p.evaluate(() => window.__film.duration)
const enc = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', raw], { stdio: ['pipe', 'inherit', 'inherit'] })
const frames = Math.round(duration * FPS)
for (let i = 0; i < frames; i++) {
  const img = await frame(i / FPS)
  if (!enc.stdin.write(img)) await new Promise((r) => enc.stdin.once('drain', r))
  if (i % (FPS * 5) === 0) console.log(`frame ${i} / ${frames}`)
}
enc.stdin.end()
await new Promise((r) => enc.on('close', r))
await browser.close()

await mux(duration)
