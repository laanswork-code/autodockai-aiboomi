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
 * Brown granite cladding with the pale horizontal bands seen on the facade.
 * 8 m × 8 m tile: 1.6 m panels, a band every 4 m.
 */
export const claddingTexture = () => canvasTexture('cladding', [512, 512], [8, 8], (g, w, h, rnd) => {
  g.fillStyle = '#5d4f45'
  g.fillRect(0, 0, w, h)
  const p = w / 5
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const k = 0.85 + rnd() * 0.25
      g.fillStyle = `rgb(${Math.round(98 * k)},${Math.round(84 * k)},${Math.round(74 * k)})`
      g.fillRect(x * p + 1, y * p + 1, p - 2, p - 2)
    }
  }
  speckle(g, w, h, rnd, 9000, ['rgba(30,24,20,.35)', 'rgba(160,140,120,.25)'])
  g.fillStyle = '#9b9a95'
  for (const y of [0.0, 0.5]) g.fillRect(0, y * h, w, h * 0.022)
  // rain streaks
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(30,26,22,${0.05 + rnd() * 0.12})`
    g.fillRect(rnd() * w, 0, 2 + rnd() * 6, h)
  }
})

/** The west wing: same cladding with windows, a few of them lit. 6 m × 3.4 m tile. */
export const wingTexture = () => canvasTexture('wing', [384, 256], [6, 3.4], (g, w, h, rnd) => {
  g.fillStyle = '#54473e'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 4000, ['rgba(30,24,20,.35)', 'rgba(150,130,110,.2)'])
  g.fillStyle = '#8f8e89'
  g.fillRect(0, h * 0.94, w, h * 0.06)
  // one narrow window per bay, a few of them lit
  g.fillStyle = rnd() < 0.25 ? '#f2d9a0' : '#2e3438'
  g.fillRect(w * 0.44, h * 0.38, w * 0.12, h * 0.3)
  g.strokeStyle = '#9b9a95'
  g.lineWidth = 3
  g.strokeRect(w * 0.44, h * 0.38, w * 0.12, h * 0.3)
})

/** Blue curtain-wall glazing with mullions. 1.5 m × 1.2 m tile. */
export const glazingTexture = () => canvasTexture('glazing', [256, 256], [1.5, 1.2], (g, w, h, rnd) => {
  const grd = g.createLinearGradient(0, 0, w, h)
  grd.addColorStop(0, '#5f86a6')
  grd.addColorStop(1, '#3d5f7c')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  g.fillStyle = `rgba(255,255,255,${0.04 + rnd() * 0.06})`
  g.fillRect(0, 0, w, h * 0.5)
  g.fillStyle = '#2a3036'
  g.fillRect(0, 0, w, 6)
  g.fillRect(0, 0, 6, h)
})

/** Mown lawn. 3 m tile. */
export const lawnTexture = () => canvasTexture('lawn', [256, 256], [3, 3], (g, w, h, rnd) => {
  g.fillStyle = '#5f7f3e'
  g.fillRect(0, 0, w, h)
  speckle(g, w, h, rnd, 9000, ['rgba(70,98,40,.6)', 'rgba(120,150,70,.5)', 'rgba(90,110,50,.5)'], 2)
})
