import * as THREE from 'three'
import { rng } from './geo'

type Painter = (g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void

const cache = new Map<string, THREE.CanvasTexture>()

/**
 * Procedural canvas texture, built once per key. `metres` is the real-world size
 * of one tile, so geometry with UVs in metres can use repeat = 1 / metres.
 */
function canvasTexture(key: string, px: [number, number], metres: [number, number], paint: Painter, srgb = true) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = px[0]
  c.height = px[1]
  const g = c.getContext('2d')!
  paint(g, c.width, c.height, rng(key.length * 7919 + 13))
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1 / metres[0], 1 / metres[1])
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  cache.set(key, t)
  return t
}

const speckle = (g: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, n: number, colors: string[], size = 2) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(rnd() * colors.length)]
    g.fillRect(rnd() * w, rnd() * h, size, size)
  }
}

/** Interlocking pavers in grey and terracotta, as in front of the KSUM building. 2 m tile. */
export const paverTexture = () => canvasTexture('pavers', [512, 512], [2, 2], (g, w, h, rnd) => {
  g.fillStyle = '#6d6a66'
  g.fillRect(0, 0, w, h)
  const cell = w / 8
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const v = rnd()
      g.fillStyle = v < 0.18 ? '#8a5a48' : v < 0.3 ? '#9a9690' : v < 0.65 ? '#7a7672' : '#83807b'
      const ox = (y % 2) * cell * 0.5
      g.fillRect(x * cell + ox + 2, y * cell + 2, cell - 4, cell - 4)
    }
  }
  speckle(g, w, h, rnd, 6000, ['rgba(40,38,36,.35)', 'rgba(200,196,190,.25)'])
})

/** Asphalt with a little grit. 4 m tile. */
export const asphaltTexture = () => canvasTexture('asphalt', [256, 256], [4, 4], (g, w, h, rnd) => {
  g.fillStyle = '#4a4c4f'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 5000, ['rgba(25,25,27,.45)', 'rgba(120,120,122,.35)', 'rgba(80,80,84,.4)'], 1.5)
})

/**
 * Grey-brown granite with thin panel joints and the thick pale bands seen on
 * the photos. The bands break and step up in places rather than running
 * straight. 16 m x 8 m tile, a band row every 4 m.
 */
export const claddingTexture = () => canvasTexture('cladding', [1024, 512], [16, 8], (g, w, h, rnd) => {
  const px = w / 16
  g.fillStyle = '#584e47'
  g.fillRect(0, 0, w, h)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 16; x++) {
      const k = 0.88 + rnd() * 0.2
      g.fillStyle = `rgb(${Math.round(92 * k)},${Math.round(82 * k)},${Math.round(75 * k)})`
      g.fillRect(x * px + 1, y * px + 1, px - 2, px - 2)
    }
  }
  speckle(g, w, h, rnd, 26000, ['rgba(28,24,22,.4)', 'rgba(170,155,140,.28)', 'rgba(120,108,98,.3)'])
  // broken bands: segments of varying length, some stepped up by 0.6 m
  for (const row of [0, 4]) {
    let x = 0
    while (x < 16) {
      const len = 2 + rnd() * 5
      const step = rnd() < 0.3 ? 0.6 : 0
      g.fillStyle = '#9a9b98'
      g.fillRect(x * px, (8 - row - 0.35 - step) * px, Math.min(len, 16 - x) * px, 0.35 * px)
      x += len + (rnd() < 0.35 ? 0.6 + rnd() * 1.2 : 0)
    }
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(30,26,22,${0.04 + rnd() * 0.1})`
    g.fillRect(rnd() * w, 0, 2 + rnd() * 5, h)
  }
})

/**
 * The west blocks: same granite, a pale band per floor, and small windows in
 * grey frames, alone or in pairs, a few lit. 12 m x 6.8 m tile (two bays, two floors).
 */
export const wingTexture = () => canvasTexture('wing', [768, 436], [12, 6.8], (g, w, h, rnd) => {
  const px = w / 12
  g.fillStyle = '#544a43'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 16000, ['rgba(28,24,22,.4)', 'rgba(160,145,130,.25)'])
  for (let f = 0; f < 2; f++) {
    const base = h - f * 3.4 * px
    g.fillStyle = '#9a9b98'
    g.fillRect(0, base - 0.3 * px, w, 0.3 * px)
    for (let b = 0; b < 2; b++) {
      const cx = (b * 6 + 1.5 + rnd() * 3) * px
      const pair = rnd() < 0.6
      const n = pair ? 2 : 1
      const frameW = (pair ? 1.7 : 0.9) * px
      const top = base - 2.5 * px
      g.fillStyle = '#8f908d'
      g.fillRect(cx - 0.1 * px, top - 0.1 * px, frameW + 0.2 * px, 1.0 * px)
      for (let k = 0; k < n; k++) {
        g.fillStyle = rnd() < 0.3 ? '#f4d79a' : '#262a2e'
        g.fillRect(cx + k * 0.85 * px, top, 0.7 * px, 0.8 * px)
      }
    }
  }
})

/** Speckled grey-brown granite of the entrance pylons, 1.5 m panels with fine joints. 3 m tile. */
export const pylonTexture = () => canvasTexture('pylon', [512, 512], [3, 3], (g, w, h, rnd) => {
  g.fillStyle = '#7b7064'
  g.fillRect(0, 0, w, h)
  const p = w / 2
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      const k = 0.92 + rnd() * 0.14
      g.fillStyle = `rgb(${Math.round(132 * k)},${Math.round(121 * k)},${Math.round(106 * k)})`
      g.fillRect(x * p + 2, y * p + 2, p - 4, p - 4)
    }
  }
  speckle(g, w, h, rnd, 30000, ['rgba(40,34,28,.45)', 'rgba(200,188,170,.35)', 'rgba(90,80,70,.4)'], 2)
})

/** Dark reflective curtain-wall glazing with thin mullions. 1.5 m x 1.2 m tile. */
export const glazingTexture = () => canvasTexture('glazing', [256, 256], [1.5, 1.2], (g, w, h, rnd) => {
  const grd = g.createLinearGradient(0, 0, w, h)
  grd.addColorStop(0, '#3b5468')
  grd.addColorStop(0.5, '#22323f')
  grd.addColorStop(1, '#2f4658')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  g.fillStyle = `rgba(200,220,235,${0.05 + rnd() * 0.08})`
  g.fillRect(0, 0, w, h * 0.35)
  g.fillStyle = '#15191c'
  g.fillRect(0, 0, w, 4)
  g.fillRect(0, 0, 4, h)
})

/** Mown lawn. 3 m tile. */
export const lawnTexture = () => canvasTexture('lawn', [256, 256], [3, 3], (g, w, h, rnd) => {
  g.fillStyle = '#5f7f3e'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 9000, ['rgba(70,98,40,.6)', 'rgba(120,150,70,.5)', 'rgba(90,110,50,.5)'], 2)
})

/*
 * Context buildings. Plaster textures are near-white so a material colour can
 * tint them into the usual Kerala palette. Floors are 3.4 m.
 */

/** Glass curtain wall of a corporate office: 1.5 m x 3.4 m panels, spandrel at each floor. */
export const officeGlassTexture = () => canvasTexture('officeGlass', [256, 512], [3, 6.8], (g, w, h, rnd) => {
  for (let f = 0; f < 2; f++) {
    for (let p = 0; p < 2; p++) {
      const x = (p * w) / 2
      const y = (f * h) / 2
      const grd = g.createLinearGradient(x, y, x + w / 2, y + h / 2)
      const k = rnd() * 0.12
      grd.addColorStop(0, `rgb(${Math.round(70 + 40 * k)},${Math.round(118 + 30 * k)},${Math.round(138 + 20 * k)})`)
      grd.addColorStop(1, `rgb(${Math.round(36 + 30 * k)},${Math.round(70 + 30 * k)},${Math.round(88 + 30 * k)})`)
      g.fillStyle = grd
      g.fillRect(x, y, w / 2, h / 2)
      g.fillStyle = `rgba(230,240,245,${0.06 + rnd() * 0.1})`
      g.fillRect(x, y, w / 2, h * 0.12)
    }
    g.fillStyle = '#2b3338'
    g.fillRect(0, (f * h) / 2 + h * 0.43, w, h * 0.07) // spandrel
  }
  g.fillStyle = '#c9cfd3'
  for (const x of [0, w / 2]) g.fillRect(x, 0, 4, h)
})

/** Plaster office with continuous ribbon windows on every floor. 6 m x 3.4 m. */
export const ribbonOfficeTexture = () => canvasTexture('ribbonOffice', [384, 216], [6, 3.4], (g, w, h, rnd) => {
  g.fillStyle = '#efece6'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 3000, ['rgba(120,110,100,.12)', 'rgba(255,255,255,.2)'])
  g.fillStyle = '#3a4248'
  g.fillRect(0, h * 0.28, w, h * 0.42)
  g.fillStyle = 'rgba(160,190,205,.35)'
  g.fillRect(0, h * 0.28, w, h * 0.12)
  g.fillStyle = '#d9d6cf'
  for (let x = 0; x < w; x += w / 4) g.fillRect(x, h * 0.28, 3, h * 0.42)
  g.fillStyle = 'rgba(80,70,60,.18)' // monsoon streaks under the sills
  for (let i = 0; i < 6; i++) g.fillRect(rnd() * w, h * 0.7, 2 + rnd() * 4, h * 0.3)
})

/** Plaster walls with punched windows and sunshade lintels. 3 m x 3.4 m. */
export const punchedTexture = () => canvasTexture('punched', [192, 216], [3, 3.4], (g, w, h, rnd) => {
  g.fillStyle = '#f1eee8'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 2000, ['rgba(120,110,100,.14)', 'rgba(255,255,255,.2)'])
  g.fillStyle = '#c9c4ba'
  g.fillRect(w * 0.22, h * 0.22, w * 0.56, h * 0.06) // chajja (sunshade)
  g.fillStyle = '#39424a'
  g.fillRect(w * 0.28, h * 0.3, w * 0.44, h * 0.4)
  g.fillStyle = '#e3dfd7'
  g.fillRect(w * 0.49, h * 0.3, 3, h * 0.4)
  g.fillStyle = 'rgba(80,70,60,.2)'
  g.fillRect(w * 0.3 + rnd() * w * 0.4, h * 0.7, 3, h * 0.3)
})

/** Small houses and sheds: plain plaster with one window and a door band. 4 m x 3.4 m. */
export const houseWallTexture = () => canvasTexture('houseWall', [256, 216], [4, 3.4], (g, w, h, rnd) => {
  g.fillStyle = '#f3efe6'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 2500, ['rgba(120,110,100,.15)'])
  g.fillStyle = '#5a4636'
  g.fillRect(w * 0.6, h * 0.35, w * 0.22, h * 0.38)
  g.fillStyle = '#b9b2a6'
  g.fillRect(0, h * 0.86, w, h * 0.14) // plinth
})

/** Concrete flat roof with stains. 6 m tile. */
export const roofTexture = () => canvasTexture('roof', [256, 256], [6, 6], (g, w, h, rnd) => {
  g.fillStyle = '#a9a69f'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 30; i++) {
    const x = rnd() * w
    const y = rnd() * h
    const r = 10 + rnd() * 50
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(60,62,58,.25)')
    grd.addColorStop(1, 'rgba(60,62,58,0)')
    g.fillStyle = grd
    g.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  speckle(g, w, h, rnd, 4000, ['rgba(70,70,66,.3)', 'rgba(200,198,190,.3)'])
})

/** Red Mangalore clay tiles. 1 m tile. */
export const tileRoofTexture = () => canvasTexture('tiles', [256, 256], [1, 1], (g, w, h, rnd) => {
  g.fillStyle = '#8f3b24'
  g.fillRect(0, 0, w, h)
  const rows = 6
  const cols = 4
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const k = 0.85 + rnd() * 0.3
      g.fillStyle = `rgb(${Math.round(176 * k)},${Math.round(78 * k)},${Math.round(48 * k)})`
      const x = (c + (r % 2) * 0.5) * (w / cols)
      g.fillRect(x % w, (r * h) / rows, w / cols - 3, h / rows - 5)
      g.fillStyle = 'rgba(40,16,8,.35)'
      g.fillRect(x % w, ((r + 1) * h) / rows - 6, w / cols - 3, 4)
    }
  }
})

/** Corrugated metal cladding for the industrial shed. 2 m x 2 m. */
export const corrugatedTexture = () => canvasTexture('corrugated', [256, 256], [2, 2], (g, w, h, rnd) => {
  for (let x = 0; x < w; x += 8) {
    const grd = g.createLinearGradient(x, 0, x + 8, 0)
    grd.addColorStop(0, '#9fb0bb')
    grd.addColorStop(0.5, '#d6dde1')
    grd.addColorStop(1, '#8798a3')
    g.fillStyle = grd
    g.fillRect(x, 0, 8, h)
  }
  speckle(g, w, h, rnd, 1500, ['rgba(90,70,50,.18)'])
})
