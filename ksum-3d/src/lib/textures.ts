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
