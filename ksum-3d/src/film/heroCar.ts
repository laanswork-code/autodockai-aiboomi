/*
 * The film's driving car. The BYD models ship with all four tyres (and rims,
 * discs) merged into one mesh per material, so the wheels are cut out here:
 * triangles inside each wheel's cylinder move to their own pivot, which spins
 * with distance travelled and, at the front, steers. Number plates are drawn
 * on a canvas: green with white characters, as on Indian EVs.
 */
import * as THREE from 'three'
import { toFloat } from '../scene/RotaryTower'
import { CARS, makeCar, type CarKind } from '../scene/carModels'

/** Materials that belong to the wheels in either model; calipers are excluded by name as they do not spin. */
const WHEEL_MATS = /^(tire|rim_map|B_Rim|rim_Badges|phong27breaks|metla_Rim|rim_Black|Rim_Chrome|breaks)$/
const FIXED = /caliper/i

export interface Wheel { steer: THREE.Group; spin: THREE.Group; front: boolean }
export interface HeroCar {
  root: THREE.Group
  wheels: Wheel[]
  /** Unscaled tyre radius, length and width (m). */
  radius: number
  length: number
  width: number
  /** Unscaled front plate centre, for the gate camera's overlay. */
  plateFront: THREE.Vector3
}

interface WheelSpot { c: THREE.Vector3; r: number; halfW: number }

function plateTexture(text: string) {
  const c = document.createElement('canvas')
  c.width = 1040
  c.height = 240
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#1d7f45'
  g.fillRect(10, 10, c.width - 20, c.height - 20)
  g.fillStyle = '#1747a6'
  g.fillRect(10, 10, 90, c.height - 20)
  g.fillStyle = '#ffffff'
  g.font = 'bold 34px Arial, sans-serif'
  g.textAlign = 'center'
  g.fillText('IND', 55, 200)
  g.font = 'bold 150px "Arial Narrow", Arial, sans-serif'
  g.textBaseline = 'middle'
  g.fillText(text, 570, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Triangles of a mesh baked into the car's own space, three vertices per triangle. */
function bake(mesh: THREE.Mesh, toCar: THREE.Matrix4) {
  const g = toFloat(mesh.geometry).applyMatrix4(toCar)
  return g.index ? g.toNonIndexed() : g
}

const centroid = (p: THREE.BufferAttribute, i: number, out: THREE.Vector3) =>
  out.set((p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3)

/** A geometry made of the listed triangles of `src`, shifted by -origin. */
function pick(src: THREE.BufferGeometry, tris: number[], origin: THREE.Vector3) {
  const out = new THREE.BufferGeometry()
  for (const name of Object.keys(src.attributes)) {
    const a = src.getAttribute(name) as THREE.BufferAttribute
    const arr = new Float32Array(tris.length * 3 * a.itemSize)
    let k = 0
    for (const t of tris) for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[k++] = a.array[(t + v) * a.itemSize + c]
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize))
  }
  out.translate(-origin.x, -origin.y, -origin.z)
  return out
}

export function buildHeroCar(scene: THREE.Object3D, kind: CarKind, color: string, plate: string): HeroCar {
  const car = makeCar(scene, kind, color)
  car.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(car.matrixWorld).invert()
  const parts: { mesh: THREE.Mesh; geo: THREE.BufferGeometry }[] = []
  car.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || Array.isArray(m.material) || !WHEEL_MATS.test(m.material.name)) return
    if (FIXED.test(m.name) || FIXED.test(m.parent?.name ?? '')) return
    parts.push({ mesh: m, geo: bake(m, new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)) })
  })

  // Wheel cylinders from the tyre triangles, one per quadrant (left/right, front/back).
  const tyre = parts.find((p) => (p.mesh.material as THREE.Material).name === 'tire')
  if (!tyre) throw new Error('car model has no tire mesh')
  const boxes = Array.from({ length: 4 }, () => new THREE.Box3())
  const c = new THREE.Vector3()
  const quad = (v: THREE.Vector3) => (v.x > 0 ? 1 : 0) + (v.z > 0 ? 2 : 0)
  const tp = tyre.geo.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < tp.count; i += 3) { centroid(tp, i, c); for (let v = 0; v < 3; v++) boxes[quad(c)].expandByPoint(new THREE.Vector3(tp.getX(i + v), tp.getY(i + v), tp.getZ(i + v))) }
  const spots: WheelSpot[] = boxes.map((b) => ({ c: b.getCenter(new THREE.Vector3()), r: (b.max.y - b.min.y) / 2, halfW: (b.max.x - b.min.x) / 2 }))

  const root = new THREE.Group()
  root.add(car)
  const wheels: Wheel[] = spots.map((s) => {
    const steer = new THREE.Group()
    steer.position.copy(s.c)
    const spin = new THREE.Group()
    steer.add(spin)
    root.add(steer)
    return { steer, spin, front: s.c.z > 0 }
  })

  for (const { mesh, geo } of parts) {
    const p = geo.getAttribute('position') as THREE.BufferAttribute
    const per: number[][] = [[], [], [], []]
    const rest: number[] = []
    for (let i = 0; i < p.count; i += 3) {
      centroid(p, i, c)
      const w = spots.findIndex((s) => Math.abs(c.x - s.c.x) <= s.halfW + 0.12 && Math.hypot(c.y - s.c.y, c.z - s.c.z) <= s.r * 1.03)
      ;(w >= 0 ? per[w] : rest).push(i)
    }
    per.forEach((tris, w) => {
      if (!tris.length) return
      const piece = new THREE.Mesh(pick(geo, tris, spots[w].c), mesh.material)
      piece.castShadow = true
      wheels[w].spin.add(piece)
    })
    if (rest.length) {
      const body = new THREE.Mesh(pick(geo, rest, new THREE.Vector3()), mesh.material)
      body.castShadow = true
      root.add(body)
    }
    mesh.visible = false
  }

  // Plates on the bumpers, found by casting along the car's long axis at plate height.
  const size = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3())
  const tex = plateTexture(plate)
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.05 })
  const geo = new THREE.PlaneGeometry(0.52, 0.12)
  const ray = new THREE.Raycaster()
  const bumper = (y: number, dir: 1 | -1) => {
    ray.set(new THREE.Vector3(0, y, dir * (size.z + 1)), new THREE.Vector3(0, 0, -dir))
    const hit = ray.intersectObject(car, true).find((h) => (h.object as THREE.Mesh).visible)
    return hit ? hit.point.z + dir * 0.012 : dir * (size.z / 2 + 0.01)
  }
  const plateFront = new THREE.Vector3(0, 0.46, bumper(0.46, 1))
  const front = new THREE.Mesh(geo, mat)
  front.position.copy(plateFront)
  const back = new THREE.Mesh(geo, mat)
  back.position.set(0, 0.62, bumper(0.62, -1))
  back.rotation.y = Math.PI
  root.add(front, back)

  return { root, wheels, radius: spots[0].r, length: CARS[kind].length, width: size.x, plateFront }
}

/** Pose the wheels: spin from distance rolled, front wheels steered. */
export function rollWheels(car: HeroCar, distance: number, steer: number, scale: number) {
  const angle = distance / (car.radius * scale)
  for (const w of car.wheels) {
    w.spin.rotation.x = angle
    w.steer.rotation.y = w.front ? steer : 0
  }
}
