import * as THREE from 'three'

export type XZ = readonly [number, number]
export interface Circle { cx: number; cz: number; r: number }

/** Circle through three points in the ground plane. */
export function circleFrom3(a: XZ, b: XZ, c: XZ): Circle {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
  const s = (p: XZ) => p[0] * p[0] + p[1] * p[1]
  const cx = (s(a) * (b[1] - c[1]) + s(b) * (c[1] - a[1]) + s(c) * (a[1] - b[1])) / d
  const cz = (s(a) * (c[0] - b[0]) + s(b) * (a[0] - c[0]) + s(c) * (b[0] - a[0])) / d
  return { cx, cz, r: Math.hypot(a[0] - cx, a[1] - cz) }
}

/** Point on the arc at angle θ, pushed `offset` metres outward (away from the centre). */
export function arcPoint(c: Circle, theta: number, offset = 0): [number, number] {
  const r = c.r + offset
  return [c.cx + r * Math.cos(theta), c.cz + r * Math.sin(theta)]
}

/** Angle on the south-facing branch of the arc for a given x. */
export const thetaAtX = (c: Circle, x: number) => Math.acos((x - c.cx) / c.r)

/** Yaw that turns a model's local +z toward the outward normal at θ. */
export const yawOutward = (theta: number) => Math.atan2(Math.cos(theta), Math.sin(theta))
export const yawInward = (theta: number) => yawOutward(theta) + Math.PI

/**
 * Flat ribbon following the arc between two radial offsets.
 * UVs are in metres: u along the arc (at the inner edge), v across.
 */
export function arcRibbon(c: Circle, t0: number, t1: number, in0: number, in1: number, y = 0.02): THREE.BufferGeometry {
  const n = Math.max(2, Math.ceil(Math.abs(t1 - t0) * (c.r + in1) / 1.5))
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const [ax, az] = arcPoint(c, t, in0)
    const [bx, bz] = arcPoint(c, t, in1)
    const u = Math.abs(t - t0) * (c.r + in0)
    pos.push(ax, y, az, bx, y, bz)
    uv.push(u, 0, u, in1 - in0)
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  }
  return finishFlat(pos, uv, idx)
}

/** Vertical wall following the arc, facing outward. UVs in metres (u along, v up). */
export function arcWall(c: Circle, t0: number, t1: number, offset: number, y0: number, y1: number): THREE.BufferGeometry {
  const n = Math.max(2, Math.ceil(Math.abs(t1 - t0) * (c.r + offset) / 1.2))
  const pos: number[] = []
  const uv: number[] = []
  const nrm: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n
    const [x, z] = arcPoint(c, t, offset)
    const u = Math.abs(t - t0) * (c.r + offset)
    pos.push(x, y0, z, x, y1, z)
    uv.push(u, y0, u, y1)
    nrm.push(Math.cos(t), 0, Math.sin(t), Math.cos(t), 0, Math.sin(t))
    // Counter-clockwise seen from outside, whichever way the angles run.
    if (i) { const k = (i - 1) * 2; idx.push(...(t1 > t0 ? [k, k + 1, k + 2, k + 1, k + 3, k + 2] : [k, k + 2, k + 1, k + 1, k + 2, k + 3])) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

/** Flat ribbon of width w along a polyline. UVs in metres (u along, v across). */
export function polylineRibbon(pts: readonly XZ[], w: number, y = 0.02): THREE.BufferGeometry {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let u = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz) || 1
    const nx = (-dz / l) * (w / 2)
    const nz = (dx / l) * (w / 2)
    if (i) u += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    pos.push(pts[i][0] - nx, y, pts[i][1] - nz, pts[i][0] + nx, y, pts[i][1] + nz)
    uv.push(u, 0, u, w)
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  }
  return finishFlat(pos, uv, idx)
}

function finishFlat(pos: number[], uv: number[], idx: number[]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // Winding depends on travel direction; make sure the ribbon faces up.
  if (g.attributes.normal.getY(0) < 0) {
    const ix = g.index!.array as Uint32Array | Uint16Array
    for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t }
    g.computeVertexNormals()
  }
  return g
}

/** Ground-plane polygon to a THREE.Shape (shape y = -z so rotateX(-π/2) maps it back). */
export function toShape(pts: readonly XZ[]): THREE.Shape {
  return new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)))
}

/** Extrude a footprint to a prism standing on the ground. */
export function extrudeFootprint(pts: readonly XZ[], height: number, base = 0): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(toShape(pts), { depth: height, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  g.translate(0, base, 0)
  return g
}

/**
 * Prism between a bottom and a top outline with the same vertex count, so faces
 * can lean (battered walls). Groups: 0 = caps, 1 = walls. Wall UVs are metres
 * (u along the perimeter, v up), matching the cladding textures.
 */
export function prism(bottom: readonly XZ[], top: readonly XZ[], height: number, base = 0): THREE.BufferGeometry {
  const area = bottom.reduce((a, [x, z], i) => {
    const [x2, z2] = bottom[(i + 1) % bottom.length]
    return a + x * z2 - x2 * z
  }, 0)
  const y0 = base
  const y1 = base + height
  const pos: number[] = []
  const uv: number[] = []
  const tri = (a: number[], b: number[], c: number[], ua: number[], ub: number[], uc: number[]) => {
    pos.push(...a, ...b, ...c)
    uv.push(...ua, ...ub, ...uc)
  }
  // caps: triangulate, then wind each triangle to face up (top) or down (bottom)
  const capTris = THREE.ShapeUtils.triangulateShape(bottom.map(([x, z]) => new THREE.Vector2(x, z)), [])
  const up = new THREE.Vector3()
  for (const [y, ring, wantUp] of [[y1, top, true], [y0, bottom, false]] as const) {
    for (const [i, j, k] of capTris) {
      const a = [ring[i][0], y, ring[i][1]]
      const b = [ring[j][0], y, ring[j][1]]
      const c = [ring[k][0], y, ring[k][1]]
      up.set(b[0] - a[0], 0, b[2] - a[2]).cross(new THREE.Vector3(c[0] - a[0], 0, c[2] - a[2]))
      const flip = (up.y > 0) !== wantUp
      const uvs = [a, b, c].map((p) => [p[0], p[2]])
      if (flip) tri(a, c, b, uvs[0], uvs[2], uvs[1])
      else tri(a, b, c, uvs[0], uvs[1], uvs[2])
    }
  }
  const capCount = pos.length / 3
  let u = 0
  for (let i = 0; i < bottom.length; i++) {
    const j = (i + 1) % bottom.length
    const bi = [bottom[i][0], y0, bottom[i][1]]
    const bj = [bottom[j][0], y0, bottom[j][1]]
    const ti = [top[i][0], y1, top[i][1]]
    const tj = [top[j][0], y1, top[j][1]]
    const len = Math.hypot(bottom[j][0] - bottom[i][0], bottom[j][1] - bottom[i][1])
    const [ubi, ubj, uti, utj] = [[u, y0], [u + len, y0], [u, y1], [u + len, y1]]
    // positive area in (x, z): outward is to the right of the edge
    if (area > 0) { tri(bi, tj, bj, ubi, utj, ubj); tri(bi, ti, tj, ubi, uti, utj) }
    else { tri(bi, bj, tj, ubi, ubj, utj); tri(bi, tj, ti, ubi, utj, uti) }
    u += len
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.computeVertexNormals()
  g.addGroup(0, capCount, 0)
  g.addGroup(capCount, pos.length / 3 - capCount, 1)
  return g
}

export interface Rect { x0: number; x1: number; z0: number; z1: number }
export const inRect = (r: Rect, [x, z]: XZ) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1

/** Clip a polyline to a rectangle (Liang-Barsky per segment), returning the pieces inside. */
export function clipPolyline(pts: readonly XZ[], r: Rect): XZ[][] {
  const out: XZ[][] = []
  let cur: XZ[] = []
  for (let i = 1; i < pts.length; i++) {
    const seg = clipSegment(pts[i - 1], pts[i], r)
    if (!seg) { if (cur.length > 1) out.push(cur); cur = []; continue }
    if (!cur.length) cur.push(seg[0])
    cur.push(seg[1])
    if (seg[1] !== pts[i]) { out.push(cur); cur = [] }
  }
  if (cur.length > 1) out.push(cur)
  return out
}

function clipSegment(a: XZ, b: XZ, r: Rect): [XZ, XZ] | null {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  let t0 = 0
  let t1 = 1
  const tests: [number, number][] = [[-dx, a[0] - r.x0], [dx, r.x1 - a[0]], [-dz, a[1] - r.z0], [dz, r.z1 - a[1]]]
  for (const [p, q] of tests) {
    if (p === 0) { if (q < 0) return null; continue }
    const t = q / p
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t }
    else { if (t < t0) return null; if (t < t1) t1 = t }
  }
  const pa: XZ = t0 === 0 ? a : [a[0] + dx * t0, a[1] + dz * t0]
  const pb: XZ = t1 === 1 ? b : [a[0] + dx * t1, a[1] + dz * t1]
  return [pa, pb]
}

/** Small deterministic PRNG so every load lays the scene out the same way. */
export function rng(seed: number) {
  let s = seed % 2147483647
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}
