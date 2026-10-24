// Builds the film's HyperFrames compositions (index.html + compositions/*.html) from the
// narration's word timings, so every title lands on the word that says it and a voice
// retake re-times the whole film.
//   node build.mjs        (after scripts/voiceover.mjs and scripts/capture.mjs)
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

/** Real length of an audio file in seconds (ffprobe). */
const lengthOf = (file) => +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString()).toFixed(3)

const timing = JSON.parse(await readFile(new URL('./assets/voice/timing.json', import.meta.url), 'utf8'))
const start = Object.fromEntries(timing.order.map((o) => [o.id, o.start]))
// Case-sensitive on purpose: "The operator" must not match "the grid", nor "More" match "more".
const norm = (w) => w.replace(/[^A-Za-z0-9']/g, '')

/** Absolute time of the nth word in `line` starting with `word`. */
function at(line, word, nth = 0) {
  const hits = timing.lines[line].words.filter((w) => norm(w.text).startsWith(norm(word)))
  if (!hits[nth]) throw new Error(`no word "${word}" #${nth} in ${line}`)
  return +(start[line] + hits[nth].start).toFixed(3)
}
const lineEnd = (line) => +(start[line] + timing.lines[line].duration).toFixed(3)

const END_HOLD = 4.6
const TOTAL = +(lineEnd('claim') + END_HOLD).toFixed(2)
const W = 1920
const H = 1080

// Scene windows: each scene owns its narration line, from just before it starts to the next.
const ORDER = ['hook', 'problem', 'solution', 'reveal', 'you', 'why', 'jev', 'how', 'proof', 'claim']
const windows = ORDER.map((id, i) => {
  const from = i === 0 ? 0 : +(start[id] - 0.12).toFixed(3)
  const to = i === ORDER.length - 1 ? TOTAL : +(start[ORDER[i + 1]] - 0.12).toFixed(3)
  return { id, from, to }
})
const win = Object.fromEntries(windows.map((w) => [w.id, w]))

/* ---------- element builders: each returns { html, js } with times local to its scene ---------- */

let uid = 0
const nextId = (p) => `${p}${++uid}`
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Words with *accent* markup -> spans; words blur in one by one at `t`, blur out at `until`. */
function title({ text, t, until, size = 84, weight = 800, color = '#16181b', style = '' }) {
  const id = nextId('t')
  const words = text.split(' ')
  let accent = false
  const spans = words.map((w) => {
    const open = w.startsWith('*')
    const close = w.endsWith('*')
    if (open) accent = true
    const word = w.replace(/\*/g, '')
    const span = `<span class="w${accent ? ' acc' : ''}">${esc(word)}</span>`
    if (close) accent = false
    return span
  }).join(' ')
  const html = `<div id="${id}" class="title" style="font-size:${size}px;font-weight:${weight};color:${color};${style}">${spans}</div>`
  let js = `tl.fromTo("#${id} .w",{opacity:0,filter:"blur(8px)"},{opacity:1,filter:"blur(0px)",duration:0.16,ease:"power2.out",stagger:0.07},${t});`
  if (until != null) js += `tl.to("#${id}",{opacity:0,filter:"blur(6px)",duration:0.25,ease:"power3.in"},${until});`
  return { html, js }
}

/** A real product capture in a card frame. `rect` highlights a region (percent of the card). */
function card({ src, t, until, x, y, w, highlight = [], style = '', instant = false, drift = { s: 1.035, y: 0 }, end }) {
  const id = nextId('c')
  const marks = highlight.map((h, i) =>
    `<div id="${id}h${i}" class="mark" style="left:${h.left}%;top:${h.top}%;width:${h.width}%;height:${h.height}%"></div>`).join('')
  const html = `<div id="${id}" class="card" data-layout-allow-overflow style="left:${x}px;top:${y}px;width:${w}px;${style}"><div class="inner"><img src="${src}" alt="">${marks}</div></div>`
  let js = instant
    ? `tl.set("#${id}",{opacity:1},0);`
    : `tl.fromTo("#${id}",{opacity:0,scale:0.92,filter:"blur(10px)"},{opacity:1,scale:1,filter:"blur(0px)",duration:0.6,ease:"expo.out"},${t});`
  // the UI keeps living while it is on screen: a slow, steady drift of the capture (and its marks) inside its frame
  const driftEnd = until ?? end
  if (drift && driftEnd != null) js += `tl.fromTo("#${id} .inner",{scale:1,y:0},{scale:${drift.s},y:${drift.y},duration:${(driftEnd - t).toFixed(3)},ease:"none"},${t});`
  highlight.forEach((h, i) => {
    js += `tl.fromTo("#${id}h${i}",{opacity:0,scale:1.06},{opacity:1,scale:1,duration:0.35,ease:"expo.out"},${h.t});`
    if (h.until != null) js += `tl.to("#${id}h${i}",{opacity:0,duration:0.2},${h.until});`
  })
  if (until != null) js += `tl.to("#${id}",{opacity:0,scale:0.97,filter:"blur(6px)",duration:0.35,ease:"power3.in"},${until});`
  return { html, js }
}

/** A full-frame capture with camera keys [{t, s, x, y, d}] (x/y in px at 1080p, d = move length). */
function shot({ src, t = 0, until, cam = [], cut = true }) {
  const id = nextId('s')
  const html = `<div id="${id}" class="shot"><div class="cam"><img src="${src}" alt=""></div></div>`
  const k0 = cam[0] ?? { s: 1, x: 0, y: 0 }
  let js = `tl.set("#${id} .cam",{scale:${k0.s},x:${k0.x ?? 0},y:${k0.y ?? 0}},0);`
  js += cut
    ? `tl.fromTo("#${id}",{opacity:0},{opacity:1,duration:0.01},${t});`
    : `tl.fromTo("#${id}",{opacity:0,scale:1.04},{opacity:1,scale:1,duration:0.5,ease:"expo.out"},${t});`
  cam.slice(1).forEach((k) => {
    js += `tl.to("#${id} .cam",{scale:${k.s},x:${k.x ?? 0},y:${k.y ?? 0},duration:${k.d ?? 1.4},ease:"${k.ease ?? 'power2.inOut'}"},${k.t});`
  })
  if (until != null) js += `tl.to("#${id}",{opacity:0,duration:0.01},${until});`
  return { html, js }
}

/** A label plate over a 3D shot, holding several titles stacked. */
function plate({ x, y, w, t, until, items }) {
  const id = nextId('p')
  // later lines open their own room as they land, so the plate never shows empty rows
  const inner = items.map((it, i) => {
    if (i === 0) return title(it)
    const ti = title({ ...it, style: `${it.style ?? ''}height:0;overflow:hidden;` })
    const tid = ti.html.match(/id="([^"]+)"/)[1]
    ti.js = `tl.fromTo("#${tid}",{height:0},{height:"auto",duration:0.35,ease:"expo.out"},${(it.t - 0.05).toFixed(3)});tl.set("#${tid}",{overflow:"visible"},${(it.t + 0.31).toFixed(3)});` + ti.js
    return ti
  })
  const html = `<div id="${id}" class="plate" style="left:${x}px;top:${y}px;width:${w}px">${inner.map((i) => i.html).join('')}</div>`
  let js = `tl.fromTo("#${id}",{opacity:0,y:16,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.5,ease:"expo.out"},${t});`
  js += inner.map((i) => i.js).join('')
  if (until != null) js += `tl.to("#${id}",{opacity:0,filter:"blur(6px)",duration:0.3,ease:"power3.in"},${until});`
  return { html, js }
}

/** A number counting up to `to` from t, then still. */
function counter({ to, t, until, size, x, y, suffix = '', color = '#16181b' }) {
  const id = nextId('n')
  const html = `<div id="${id}" class="num" style="left:${x}px;top:${y}px;font-size:${size}px;color:${color}">0${suffix}</div>`
  let js = `tl.fromTo("#${id}",{opacity:0},{opacity:1,duration:0.15},${t});`
  js += `(function(){const o={v:0};const el=document.querySelector("#${id}");tl.fromTo(o,{v:0},{v:${to},duration:0.9,ease:"expo.out",onUpdate(){el.textContent=Math.round(o.v)+"${suffix}"}},${t});})();`
  if (until != null) js += `tl.to("#${id}",{opacity:0,filter:"blur(6px)",duration:0.25,ease:"power3.in"},${until});`
  return { html, js }
}

/** A column of titles in normal flow (no overlaps), placed at x/y. */
function column({ x, y, w, gap = 16, items }) {
  const inner = items.map(title)
  return {
    html: `<div class="col" style="left:${x}px;top:${y}px;width:${w}px;gap:${gap}px">${inner.map((i) => i.html).join('')}</div>`,
    js: inner.map((i) => i.js).join(''),
  }
}

/** A labelled comparison panel; `stream` types text out token by token (the chat model side). */
function panel({ id, x, y, w, t, label, note, accent = false, dimAt, stream }) {
  const html = `<div id="${id}" class="panel${accent ? ' panel-acc' : ''}" style="left:${x}px;top:${y}px;width:${w}px">
      <div class="panel-label">${esc(label)}</div><div class="panel-note">${esc(note)}</div>
      ${stream ? `<div id="${id}-stream" class="stream"><span></span><i class="caret"></i></div>` : ''}
    </div>`
  let js = `tl.fromTo("#${id}",{opacity:0,y:16,filter:"blur(8px)"},{opacity:1,y:0,filter:"blur(0px)",duration:0.5,ease:"expo.out"},${t});`
  if (stream) {
    // about four characters per token, one token every 0.12 s: slow on purpose, the way it feels
    const n = stream.text.length
    js += `(function(){const o={v:0};const el=document.querySelector("#${id}-stream span");const s=${JSON.stringify(stream.text)};tl.fromTo(o,{v:0},{v:${n},duration:${Math.min(stream.until - stream.t, n / 4 * 0.12).toFixed(3)},ease:"none",onUpdate(){el.textContent=s.slice(0,Math.floor(o.v/4)*4)}},${stream.t});})();`
  }
  if (dimAt != null) js += `tl.to("#${id}",{opacity:0.45,duration:0.4,ease:"power2.out"},${dimAt});`
  return { html, js }
}

/* ---------- the scenes ---------- */

const L = (scene, abs) => +(abs - win[scene].from).toFixed(3)
const S = 'assets/shots/'

const scenes = {
  hook: () => {
    const s = 'hook'
    return [
      card({ src: S + 'problem-cards.png', t: 0, instant: true, end: win.hook.to - win.hook.from, x: 960, y: 200, w: 860, style: 'height:640px', drift: { s: 1.06, y: -50 } }),
      column({ x: 120, y: 190, w: 760, gap: 10, items: [
        { text: 'Every morning,', t: L(s, at(s, 'Every')), size: 92 },
        { text: 'across *Kerala* *and* *India*', t: L(s, at(s, 'across')), size: 92 },
      ] }),
      column({ x: 120, y: 560, w: 760, gap: 14, items: [
        { text: 'Parking: full.', t: L(s, at(s, 'parking')), size: 54, weight: 600 },
        { text: 'The road becomes the car park.', t: L(s, at(s, 'road')), size: 54, weight: 600 },
        { text: 'Chargers: a queue.', t: L(s, at(s, 'chargers')), size: 54, weight: 600 },
      ] }),
    ]
  },
  problem: () => {
    const s = 'problem'
    const pageAt = L(s, at(s, 'Every'))
    return [
      column({ x: 124, y: 60, w: 600, items: [
        { text: 'The problem', t: 0.1, until: pageAt - 0.3, size: 34, weight: 600, color: '#7b7f86' },
      ] }),
      counter({ to: 474, t: L(s, at(s, 'Four')), until: pageAt - 0.3, size: 230, x: 116, y: 120 }),
      column({ x: 124, y: 380, w: 780, gap: 10, items: [
        { text: 'real parking complaints', t: L(s, at(s, 'Four')) + 0.4, until: pageAt - 0.3, size: 50, weight: 600 },
        { text: 'via SerpAPI: Google, Google News, Reddit', t: L(s, at(s, 'Four')) + 0.9, until: pageAt - 0.3, size: 30, weight: 500, color: '#7b7f86' },
      ] }),
      column({ x: 124, y: 540, w: 780, gap: 6, items: [
        { text: 'Kochi · Kozhikode · Trivandrum', t: L(s, at(s, 'Kochi')), until: pageAt - 0.3, size: 44, weight: 600, color: '#1747a6' },
        { text: 'Delhi · Mumbai · Bengaluru', t: L(s, at(s, 'Delhi')), until: pageAt - 0.3, size: 44, weight: 600, color: '#1747a6' },
      ] }),
      card({ src: S + 'cat-panel.png', t: L(s, at(s, 'fights')), until: pageAt - 0.3, x: 940, y: 300, w: 880,
        highlight: [
          { left: 2.5, top: 19.8, width: 95.5, height: 6, t: L(s, at(s, 'fights')) + 0.3, until: L(s, at(s, 'overcharging')) },
          { left: 2.5, top: 43.8, width: 95.5, height: 6, t: L(s, at(s, 'overcharging')), until: L(s, at(s, 'apartments')) },
          { left: 2.5, top: 31.8, width: 95.5, height: 6, t: L(s, at(s, 'apartments')) },
        ] }),
      column({ x: 120, y: 80, w: 1680, items: [
        { text: 'Every one, on our *problems* page, linked to the original post', t: pageAt, size: 48, weight: 700 },
      ] }),
      card({ src: S + 'problems-top.png', t: pageAt + 0.2, end: win.problem.to - win.problem.from, x: 250, y: 190, w: 1420, drift: { s: 1.06, y: 20 } }),
    ]
  },
  solution: () => {
    const s = 'solution'
    return [
      column({ x: 120, y: 70, w: 1680, gap: 4, items: [
        { text: 'Our solution', t: 0.1, size: 34, weight: 600, color: '#7b7f86' },
        { text: '*Space*, and *intelligence*', t: L(s, at(s, 'space')), size: 84 },
      ] }),
      card({ src: S + 'twin-towers.png', t: L(s, at(s, 'AutoDock')), end: win.solution.to - win.solution.from, x: 120, y: 290, w: 820 }),
      column({ x: 120, y: 790, w: 820, gap: 10, items: [
        { text: 'Rotary towers', t: L(s, at(s, 'AutoDock')), size: 52 },
        { text: '20 cars on the footprint of 2, a charger in each', t: L(s, at(s, 'twenty')), size: 36, weight: 600 },
      ] }),
      card({ src: S + 'rush-full.png', t: L(s, at(s, 'And')), end: win.solution.to - win.solution.from, x: 980, y: 290, w: 820, highlight: [] }),
      column({ x: 980, y: 790, w: 820, gap: 10, items: [
        { text: 'Our *AI* *layer* runs them', t: L(s, at(s, 'And')), size: 52 },
        { text: 'Every decision, in under a second', t: L(s, at(s, 'every')), size: 36, weight: 600 },
        { text: 'Unsure? It asks a person.', t: L(s, at(s, 'asking')), size: 36, weight: 600 },
      ] }),
    ]
  },
  reveal: () => {
    const s = 'reveal'
    const cut = L(s, at(s, 'Two'))
    return [
      shot({ src: S + 'twin-today.png', t: 0, until: cut, cam: [
        { s: 1.0, x: 0, y: 0 },
        { t: 0.4, s: 1.32, x: -40, y: -60, d: 6.5 },
      ] }),
      plate({ x: 96, y: 770, w: 1000, t: L(s, at(s, 'Take')), until: cut - 0.25, items: [
        { text: 'One example: KSUM, Kalamassery', t: L(s, at(s, 'Take')) + 0.2, size: 50 },
        { text: 'a live *digital* *twin*', t: L(s, at(s, 'digital')), size: 40, weight: 600 },
        { text: '15 bays, full by mid-morning', t: L(s, at(s, 'fifteen')), size: 40, weight: 600 },
        { text: 'No charging at all', t: L(s, at(s, 'no')), size: 40, weight: 600 },
      ] }),
      shot({ src: S + 'twin-towers.png', t: cut, cam: [
        { s: 1.18, x: 120, y: 40 },
        { t: cut + 0.05, s: 1.0, x: 0, y: 0, d: 4.5, ease: 'power2.out' },
      ] }),
      plate({ x: 96, y: 800, w: 980, t: L(s, at(s, 'four')), items: [
        { text: '4 bays. *40* *cars.*', t: L(s, at(s, 'four')) + 0.1, size: 56 },
        { text: 'A charger in every bay.', t: L(s, at(s, 'each')), size: 40, weight: 600 },
      ] }),
    ]
  },
  you: () => {
    const s = 'you'
    const no = L(s, at(s, 'No', 1))
    const end = win.you.to - win.you.from
    return [
      column({ x: 120, y: 60, w: 1680, gap: 4, items: [
        { text: 'From your side', t: 0.1, size: 34, weight: 600, color: '#7b7f86' },
      ] }),
      column({ x: 120, y: 112, w: 1680, items: [
        { text: 'Tell it your day, in *plain* *words*', t: L(s, at(s, 'type')), until: no - 0.3, size: 66 },
      ] }),
      column({ x: 120, y: 112, w: 1680, items: [
        { text: 'No circling. No queue. *No* *argument.*', t: no, size: 66 },
      ] }),
      card({ src: S + 'phone-arrive.png', t: L(s, at(s, 'arrive')), end, x: 250, y: 240, w: 380, drift: { s: 1.02, y: 0 },
        highlight: [{ left: 7, top: 48, width: 86, height: 12, t: L(s, at(s, 'plain')) }] }),
      card({ src: S + 'phone-dock.png', t: L(s, at(s, 'door')) - 0.6, end, x: 770, y: 240, w: 380, drift: { s: 1.02, y: 0 } }),
      card({ src: S + 'phone-charge.png', t: L(s, at(s, 'Your')), end, x: 1290, y: 240, w: 380, drift: { s: 1.02, y: 0 },
        highlight: [{ left: 7, top: 33, width: 86, height: 26, t: L(s, at(s, 'full')) }] }),
    ]
  },
  why: () => {
    const s = 'why'
    const layer = L(s, at(s, "That's"))
    return [
      shot({ src: S + 'rush-full.png', t: 0, cam: [
        { s: 1.0, x: 0, y: 0 },
        { t: 0.3, s: 1.55, x: 600, y: 120, d: 1.4 },
      ] }),
      plate({ x: 1010, y: 150, w: 810, t: L(s, at(s, 'But')), until: layer - 0.25, items: [
        { text: 'Every car needs decisions', t: L(s, at(s, 'tower')), size: 46 },
        { text: 'Which pallet?', t: L(s, at(s, 'Which')), size: 62 },
        { text: 'Charge now, or wait for the sun?', t: L(s, at(s, 'Charge')), size: 62 },
        { text: 'What price?', t: L(s, at(s, 'What')), size: 62 },
        { text: 'Is it the right car?', t: L(s, at(s, 'Is')), size: 62 },
      ] }),
      plate({ x: 1010, y: 150, w: 810, t: layer, items: [
        { text: 'What we are building', t: layer + 0.1, size: 36, weight: 600, color: '#7b7f86' },
        { text: 'The AI *intelligence* *layer*', t: L(s, at(s, 'AI')), size: 60 },
        { text: 'for smart parking today', t: L(s, at(s, 'smart')), size: 40, weight: 600 },
        { text: 'and the autonomous parking that comes next', t: L(s, at(s, 'autonomous')), size: 40, weight: 600 },
      ] }),
    ]
  },
  jev: () => {
    const s = 'jev'
    const jevAt = L(s, at(s, 'Jev', 1))
    const allAt = L(s, at(s, 'All'))
    const end = win.jev.to - win.jev.from
    return [
      column({ x: 120, y: 80, w: 1680, items: [
        { text: 'Why *Jev*, not a chat model', t: L(s, at(s, 'To')) + 0.1, size: 72 },
      ] }),
      panel({ id: 'pn-llm', x: 120, y: 230, w: 800, t: L(s, at(s, 'latest')), dimAt: jevAt,
        label: 'Chat model (autoregressive)', note: 'e.g. the latest OpenAI or Anthropic models',
        stream: { text: '{"bay": "Tower 1, pallet 18", "charge": "wait for solar", "price": "standa', t: L(s, at(s, 'one')), until: jevAt } }),
      column({ x: 160, y: 640, w: 740, gap: 14, items: [
        { text: 'One token at a time', t: L(s, at(s, 'one')), size: 44, weight: 700 },
        { text: 'Text to parse, and hope it is valid', t: L(s, at(s, 'parse')), size: 44, weight: 700 },
      ] }),
      panel({ id: 'pn-jev', x: 1000, y: 230, w: 800, t: jevAt, accent: true,
        label: 'Jev (System One model)', note: 'TypeSafe' }),
      card({ src: S + 'rush-card-top.png', t: allAt, end, x: 1040, y: 350, w: 720, drift: { s: 1.02, y: 0 } }),
      column({ x: 1040, y: 710, w: 740, gap: 14, items: [
        { text: '*All* *five* *answers* at once', t: allAt, size: 44, weight: 700 },
        { text: 'Typed values, calibrated confidence', t: L(s, at(s, 'typed')), size: 40, weight: 700 },
        { text: 'About 0.5 s and $0.00008 a car', t: L(s, at(s, 'About')), size: 44, weight: 700 },
      ] }),
    ]
  },
  how: () => {
    const s = 'how'
    const review = L(s, at(s, 'When', 1))
    const fallback = L(s, at(s, 'And'))
    return [
      card({ src: S + 'how-pipe.png', t: 0.1, until: review - 0.3, x: 140, y: 200, w: 1640,
        highlight: [{ left: 40.4, top: 5, width: 20.2, height: 39, t: 0.5 }] }),
      column({ x: 140, y: 760, w: 1640, items: [
        { text: 'Sure? The tower simply acts.', t: L(s, at(s, 'sure')), until: review - 0.3, size: 60 },
      ] }),
      card({ src: S + 'rush-review.png', t: review, until: fallback - 0.3, x: 380, y: 170, w: 1160,
        highlight: [{ left: 4, top: 37, width: 62, height: 10.5, t: L(s, at(s, 'misread')) }] }),
      column({ x: 380, y: 780, w: 1160, items: [
        { text: 'Not sure? It *asks* *a* *person.*', t: review + 0.5, until: fallback - 0.3, size: 64 },
      ] }),
      card({ src: S + 'how-fallback.png', t: fallback, end: win.how.to - win.how.from, x: 140, y: 300, w: 1640,
        highlight: [{ left: 2.6, top: 3, width: 47.4, height: 90, t: fallback + 0.4 }] }),
      column({ x: 140, y: 760, w: 1640, gap: 8, items: [
        { text: 'Jev down? *Rules* take over.', t: L(s, at(s, 'rules')), size: 60 },
        { text: 'Every decision is logged.', t: L(s, at(s, 'every')), size: 44, weight: 600 },
      ] }),
    ]
  },
  proof: () => {
    const s = 'proof'
    const dash = L(s, at(s, 'The'))
    return [
      card({ src: S + 'sim-panel.png', t: 0.1, until: dash - 0.3, x: 100, y: 190, w: 1100,
        highlight: [
          { left: 2.5, top: 76.4, width: 95.5, height: 8.4, t: L(s, at(s, 'twenty')) },
          { left: 2.5, top: 59.4, width: 95.5, height: 8.4, t: L(s, at(s, 'energy')) },
        ] }),
      column({ x: 1270, y: 200, w: 560, gap: 22, items: [
        { text: 'Simulated rush hour', t: L(s, at(s, 'simulated')), until: dash - 0.3, size: 36, weight: 600, color: '#7b7f86' },
        { text: '*-29%* grid peak', t: L(s, at(s, 'twenty')), until: dash - 0.3, size: 60 },
        { text: '*-24%* energy cost', t: L(s, at(s, 'quarter')) - 0.3, until: dash - 0.3, size: 60 },
        { text: '0 real problems missed', t: L(s, at(s, 'every')), until: dash - 0.3, size: 52 },
      ] }),
      shot({ src: S + 'dashboard-top.png', t: dash, cam: [
        { s: 1.0, x: 0, y: 0 },
        { t: dash + 0.1, s: 1.16, x: 0, y: 60, d: 4.2 },
      ] }),
      plate({ x: 96, y: 860, w: 860, t: L(s, at(s, 'live')), items: [
        { text: 'Live, on one *dashboard*', t: L(s, at(s, 'live')) + 0.1, size: 52 },
      ] }),
    ]
  },
  claim: () => {
    const s = 'claim'
    const think = L(s, at(s, 'The'))
    const mark = L(s, at(s, 'AutoDock'))
    return [
      column({ x: 150, y: 200, w: 1600, gap: 6, items: [
        { text: 'More cars.', t: L(s, at(s, 'More')), until: think - 0.3, size: 140 },
        { text: 'More chargers.', t: L(s, at(s, 'more')), until: think - 0.3, size: 140 },
        { text: 'Same *ground.*', t: L(s, at(s, 'same')), until: think - 0.3, size: 140 },
      ] }),
      column({ x: 150, y: 320, w: 1600, gap: 18, items: [
        { text: 'The *intelligence* *layer*', t: think, until: mark + 0.6, size: 130 },
        { text: 'for smart parking, and the autonomous parking that comes next', t: L(s, at(s, 'smart')), until: mark + 0.6, size: 52, weight: 600 },
      ] }),
      endCard(mark + 0.75),
    ]
  },
}

function endCard(t) {
  const html = `<div id="end" class="end">
    <div id="end-mark" class="sign"><span>P</span></div>
    <div class="end-words">
      <div id="end-name" class="end-name">AutoDock <span class="x">×</span> <span class="acc">Jev</span></div>
      <div id="end-sub" class="end-sub">The AI intelligence layer for smart parking</div>
      <div id="end-url" class="end-url">github.com/laanswork-code/autodockai-aiboomi</div>
    </div>
  </div>`
  let js = `tl.fromTo("#end-mark",{opacity:0,scale:0.55,rotate:-8,filter:"blur(10px)"},{opacity:1,scale:1,rotate:0,filter:"blur(0px)",duration:0.7,ease:"back.out(1.6)"},${t});`
  js += `tl.fromTo("#end-name",{clipPath:"inset(0 100% 0 0)"},{clipPath:"inset(0 0% 0 0)",duration:0.6,ease:"power3.out"},${t + 0.35});`
  js += `tl.fromTo("#end-sub",{opacity:0,filter:"blur(8px)"},{opacity:1,filter:"blur(0px)",duration:0.3},${t + 1.0});`
  js += `tl.fromTo("#end-url",{opacity:0,filter:"blur(8px)"},{opacity:1,filter:"blur(0px)",duration:0.3},${t + 1.4});`
  return { html, js }
}

/* ---------- writing files ---------- */

const SCENE_CSS = `
#root { position:absolute; inset:0; background:#f3efe6; overflow:hidden; font-family:Inter, sans-serif; color:#16181b; }
.stripe { position:absolute; left:0; right:0; top:0; height:12px; background:repeating-linear-gradient(90deg,#f0b91c 0 46px,transparent 46px 74px),#16181b; z-index:20; }
.title { line-height:1.06; letter-spacing:-0.02em; }
.plate .title + .title { margin-top:10px; }
.title .w { display:inline-block; }
.title .acc { color:#1747a6; }
.col { position:absolute; display:flex; flex-direction:column; z-index:5; }
.card { position:absolute; border-radius:18px; overflow:hidden; background:#fbf9f4; border:1px solid #d4ccbb; box-shadow:0 30px 60px -30px rgba(22,24,27,.45); z-index:4; }
.card .inner { position:relative; transform-origin:50% 50%; }
.card img { display:block; width:100%; }
.mark { position:absolute; border:4px solid #1747a6; border-radius:10px; background:rgba(23,71,166,.06); }
.shot { position:absolute; inset:0; overflow:hidden; z-index:1; }
.shot .cam { position:absolute; inset:0; transform-origin:50% 50%; }
.shot img { width:100%; height:100%; object-fit:cover; display:block; }
.plate { position:absolute; display:flex; flex-direction:column; gap:0; row-gap:0; padding:26px 32px; background:rgba(251,249,244,.97); border:1px solid #d4ccbb; border-radius:18px; box-shadow:0 30px 60px -30px rgba(22,24,27,.5); z-index:6; }
.num { position:absolute; padding-right:0.06em; font-weight:800; letter-spacing:-0.04em; line-height:1; font-variant-numeric:tabular-nums; z-index:5; }
.panel { position:absolute; height:760px; padding:30px 36px; background:#fbf9f4; border:1px solid #d4ccbb; border-radius:18px; box-shadow:0 30px 60px -30px rgba(22,24,27,.45); z-index:3; }
.panel-acc { border:2px solid #1747a6; }
.panel-label { font-size:40px; font-weight:800; letter-spacing:-0.02em; }
.panel-acc .panel-label { color:#1747a6; }
.panel-note { font-size:26px; font-weight:500; color:#7b7f86; margin-top:6px; }
.stream { margin-top:34px; min-height:250px; padding:24px 26px; border-radius:12px; background:#16181b; color:#e9e4d8; font:500 30px/1.45 'JetBrains Mono', ui-monospace, Menlo, monospace; word-break:break-all; }
.caret { display:inline-block; width:14px; height:30px; margin-left:2px; vertical-align:-4px; background:#f0b91c; }
.end { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:56px; z-index:7; }
.sign { width:250px; height:250px; border-radius:40px; background:#1747a6; color:#fff; display:grid; place-items:center; font:800 200px/1 Inter, sans-serif; box-shadow:inset 0 0 0 10px #1747a6, inset 0 0 0 18px #fff; }
.end-words { display:flex; flex-direction:column; gap:14px; }
.end-name { font-size:110px; font-weight:800; letter-spacing:-0.03em; line-height:1; }
.end-name .x { color:#7b7f86; font-weight:600; }
.end-name .acc { color:#1747a6; }
.end-sub { font-size:38px; font-weight:600; color:#4a4e55; }
.end-url { font-size:30px; font-weight:500; color:#7b7f86; }
`

const compDir = new URL('./compositions/', import.meta.url)
await mkdir(compDir, { recursive: true })

for (const w of windows) {
  uid = 0
  const parts = scenes[w.id]()
  const dur = +(w.to - w.from).toFixed(3)
  const file = `<template>
  <style>${SCENE_CSS.replace(/\n/g, '\n  ')}</style>
  <div id="root" data-composition-id="${w.id}" data-width="${W}" data-height="${H}" data-layout-allow-overlap>
    <div class="stripe"></div>
    ${parts.map((p) => p.html).join('\n    ')}
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    ${parts.map((p) => p.js).join('\n    ')}
    tl.set({}, {}, ${dur});
    window.__timelines["${w.id}"] = tl;
  </script>
</template>
`
  await writeFile(new URL(`${w.id}.html`, compDir), file)
}

// Sounds: whooshes on world changes (two takes, alternating), pops on numbers landing,
// a soft click on highlights in the review queue, one impact on the mark.
const sfx = [
  ['whoosh-short', win.solution.from], ['whoosh', win.reveal.from], ['whoosh-short', at('reveal', 'Two')], ['whoosh-short', win.you.from], ['whoosh', win.why.from], ['whoosh-short', win.jev.from], ['pop', at('jev', 'All')],
  ['whoosh-short', win.how.from], ['whoosh', win.proof.from], ['whoosh-short', win.claim.from],
  ['pop', at('problem', 'Four')], ['pop', at('proof', 'twenty')], ['pop', at('proof', 'quarter') - 0.3],
  ['click-soft', at('how', 'misread')], ['impact-bass-1', at('claim', 'AutoDock') + 0.75],
]

const hosts = windows.map((w, i) => `      <div id="${w.id}" data-composition-id="${w.id}" data-composition-src="compositions/${w.id}.html" data-start="${w.from}" data-duration="${+(w.to - w.from).toFixed(3)}" data-track-index="1" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`).join('\n')
const voice = timing.order.map((o) => `      <audio id="vo-${o.id}" src="assets/voice/${o.id}.mp3" data-start="${o.start}" data-duration="${lengthOf(`assets/voice/${o.id}.mp3`)}" data-track-index="2" data-volume="1"></audio>`).join('\n')
const effects = sfx.map(([name, t], i) => `      <audio id="sfx-${i}" src="assets/sfx/${name}.mp3" data-start="${(+t - 0.03).toFixed(3)}" data-duration="${lengthOf(`assets/sfx/${name}.mp3`)}" data-track-index="4" data-volume="${name === 'impact-bass-1' ? 0.45 : 0.35}"></audio>`).join('\n')

const index = `<!doctype html>
<html lang="en" data-resolution="landscape">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>AutoDock × Jev</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #f3efe6; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
${hosts}
${voice}
      <audio id="music" src="assets/music/bed.mp3" data-start="0" data-duration="${TOTAL}" data-track-index="3" data-volume="0.55" data-fade-out="3"></audio>
${effects}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      tl.set({}, {}, ${TOTAL});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`
await writeFile(new URL('./index.html', import.meta.url), index)
console.log(`built ${windows.length} scenes, ${TOTAL} s`)
for (const w of windows) console.log(`  ${w.id.padEnd(8)} ${w.from.toFixed(2)} to ${w.to.toFixed(2)}`)
