// Generates the narration with ElevenLabs, one file per script line, and the word timings the
// scenes are timed against.
//   node --env-file=../.env scripts/voiceover.mjs [--script film-script.json] [lineId ...]   (no ids: every line)
// Writes <dir>/<id>.mp3 and <dir>/timing.json (dir from the script, assets/voice/ by default). Lines
// already on disk are kept unless named, so a retake costs only that line. A line with `at` starts at
// that second of the film, or after the line before it if that one runs long.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'

const key = process.env.ELEVENLABS_API_KEY
if (!key) throw new Error('ELEVENLABS_API_KEY missing: add it to ../.env')

const args = process.argv.slice(2)
const scriptAt = args.indexOf('--script')
const scriptFile = scriptAt >= 0 ? args.splice(scriptAt, 2)[1] : 'script.json'
const script = JSON.parse(await readFile(new URL(`../${scriptFile}`, import.meta.url), 'utf8'))
const dir = new URL(`../${script.dir ?? 'assets/voice/'}`, import.meta.url)
await mkdir(dir, { recursive: true })
const timingFile = new URL('timing.json', dir)
const exists = (u) => access(u).then(() => true, () => false)
const timing = (await exists(timingFile)) ? JSON.parse(await readFile(timingFile, 'utf8')) : { lines: {} }
const only = args

/** Characters with start/end times -> words with start/end times. */
function words(alignment) {
  const out = []
  let cur = null
  alignment.characters.forEach((ch, i) => {
    const s = alignment.character_start_times_seconds[i]
    const e = alignment.character_end_times_seconds[i]
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = null } return }
    if (!cur) cur = { text: '', start: s, end: e }
    cur.text += ch
    cur.end = e
  })
  if (cur) out.push(cur)
  return out.map((w) => ({ ...w, start: +w.start.toFixed(3), end: +w.end.toFixed(3) }))
}

const lines = script.lines
for (const [i, line] of lines.entries()) {
  const file = new URL(`${line.id}.mp3`, dir)
  if (only.length ? !only.includes(line.id) : await exists(file)) continue
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${script.voice.id}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: line.text,
      model_id: script.voice.model,
      previous_text: lines[i - 1]?.text,
      next_text: lines[i + 1]?.text,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
  })
  if (!res.ok) throw new Error(`${line.id}: HTTP ${res.status} ${await res.text()}`)
  const body = await res.json()
  await writeFile(file, Buffer.from(body.audio_base64, 'base64'))
  const w = words(body.alignment)
  timing.lines[line.id] = { duration: w.at(-1).end, words: w }
  console.log(`${line.id}: ${w.length} words, ${w.at(-1).end.toFixed(2)} s`)
}

// Lay the lines end to end with a gap: absolute start of each line in the film.
let t = script.leadInSec ?? 0.8
timing.order = lines.map((l) => {
  const start = +Math.max(t, l.at ?? 0).toFixed(3)
  t = start
  t += (timing.lines[l.id]?.duration ?? 0) + script.gapSec
  return { id: l.id, start }
})
timing.total = +t.toFixed(3)
await writeFile(timingFile, JSON.stringify(timing, null, 2))
console.log(`total narration span ${timing.total.toFixed(2)} s`)
