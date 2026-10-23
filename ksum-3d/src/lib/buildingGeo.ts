import * as THREE from 'three'
import { prism, type XZ } from './geo'

/** Copy one draw group of a non-indexed geometry into its own geometry. */
function groupGeometry(g: THREE.BufferGeometry, index: number) {
  const { start, count } = g.groups[index]
  const out = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.getAttribute(name) as THREE.BufferAttribute
    out.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize))
  }
  return out
}

/**
 * Straight-sided block split into roof and walls, so many buildings can be
 * merged per material. Wall UVs are metres (u along the perimeter, v up).
 */
export function blockParts(pts: readonly XZ[], height: number) {
  const g = prism(pts, pts, height)
  return { roof: groupGeometry(g, 0), walls: groupGeometry(g, 1) }
}

/** Long axis, centre and half-extents of a footprint (principal axes of its vertices). */
export function orientedBox(pts: readonly XZ[]) {
  const n = pts.length
  const cx = pts.reduce((a, p) => a + p[0], 0) / n
  const cz = pts.reduce((a, p) => a + p[1], 0) / n
  let sxx = 0
  let szz = 0
  let sxz = 0
  for (const [x, z] of pts) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz) }
  const angle = 0.5 * Math.atan2(2 * sxz, sxx - szz)
  const ux = Math.cos(angle)
  const uz = Math.sin(angle)
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity
  for (const [x, z] of pts) {
    const a = (x - cx) * ux + (z - cz) * uz
    const b = -(x - cx) * uz + (z - cz) * ux
    a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b)
  }
  const mid: XZ = [cx + ((a0 + a1) / 2) * ux - ((b0 + b1) / 2) * uz, cz + ((a0 + a1) / 2) * uz + ((b0 + b1) / 2) * ux]
  return { mid, ux, uz, half: [(a1 - a0) / 2, (b1 - b0) / 2] as const }
}

/**
 * Gable roof over a footprint's oriented box: ridge along the long side, small
 * eave overhang, gable ends filled. UVs in metres for a tile texture.
 */
export function gableRoof(pts: readonly XZ[], wallTop: number, rise: number, eave = 0.5) {
  const { mid, ux, uz, half } = orientedBox(pts)
  const ha = half[0] + eave
  const hb = half[1] + eave
  const P = (a: number, b: number, y: number) => [mid[0] + a * ux - b * uz, y, mid[1] + a * uz + b * ux]
  const e0 = wallTop - eave * (rise / hb)
  const ridgeA = P(-ha, 0, wallTop + rise)
  const ridgeB = P(ha, 0, wallTop + rise)
  const pos: number[] = []
  const uv: number[] = []
  const slope = Math.hypot(hb, rise)
  const quad = (p: number[][], u: number[][]) => {
    pos.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3])
    uv.push(...u[0], ...u[1], ...u[2], ...u[0], ...u[2], ...u[3])
  }
  for (const side of [1, -1]) {
    const a = P(-ha, side * hb, e0)
    const b = P(ha, side * hb, e0)
    const q = side > 0 ? [a, b, ridgeB, ridgeA] : [b, a, ridgeA, ridgeB]
    quad(q, [[0, 0], [2 * ha, 0], [2 * ha, slope], [0, slope]])
  }
  for (const end of [-1, 1]) {
    const l = P(end * ha, -hb, e0)
    const r = P(end * ha, hb, e0)
    const top = end < 0 ? ridgeA : ridgeB
    const tri = end < 0 ? [r, l, top] : [l, r, top]
    pos.push(...tri[0], ...tri[1], ...tri[2])
    uv.push(0, 0, 2 * hb, 0, hb, rise)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  return g
}

/** Even-odd point-in-polygon test in the ground plane. */
export function insidePolygon([x, z]: XZ, pts: readonly XZ[]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i]
    const [xj, zj] = pts[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** Distance from a point to a polyline. */
export function distanceToPolyline([x, z]: XZ, pts: readonly XZ[]) {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1]
    const [bx, bz] = pts[i]
    const dx = bx - ax
    const dz = bz - az
    const l2 = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2))
    best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)))
  }
  return best
}
