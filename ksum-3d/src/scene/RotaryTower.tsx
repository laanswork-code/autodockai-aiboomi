import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { useSceneStore, type TowerSize } from '../store/useSceneStore'
import { CARS, makeCar, type CarKind } from './carModels'

const TOWER_URL = '/models/rotary.glb'
const TEX = ['/models/tower-atlas.webp', '/models/tower-board.jpg']
const PALLET = /^cheban\d+$/i
/**
 * Scale is calibrated from the model itself. The pallet's flat deck is about
 * 70% of its overall length (ramps and hanger arms take the rest), so a 6.2 m
 * pallet gives a ~4.4 m deck plus ramps that carry the 4.8 m BYD Seal without
 * overhang. (The Kozhikode demo's factor assumed a different loader's units.)
 * Material tuning matches that demo.
 */
const PALLET_LEN = 6.4
const TUNE: Record<string, [number, number]> = {
  zhuti: [0.52, 0.34], yshuang: [0.55, 0.14], ysyin: [0.36, 0.46], ysbai: [0.6, 0.06],
  yshei: [0.58, 0.2], jingzi3: [0.24, 0.5], dingpengjiazi: [0.38, 0.44],
}
const HIDDEN = new Set(['typeMesh1', 'a10xianshiping_3'])
const SPEED = 0.55 // m/s along the chain
/** Chain speed when the control room sends a pallet to the door: demo-quick, so a tower answers within a few seconds. */
export const SEEK_SPEED = 5

/** Pallets per tower. The model has 12; the chain loop is stretched to fit 20. */
export const PALLETS = 20
/**
 * Footprint target: two parking bays (2 x 2.6 m by 5.5 m) with a little margin.
 * The model's frame, fences and roof overhang reach well past its pallets, so
 * they are drawn in tight around the pallets; the flat deck keeps its length.
 */
const FIT_W = 5.0
const FIT_D = 5.4
/** The flat deck is about 70% of the pallet's overall length (ramps take the rest). */
const DECK_FRACTION = 0.7
/** Cars on the pallets are drawn a little under life size so they read with clearance, not jammed in. */
const CAR_ON_PALLET = 0.85

interface Part { geo: THREE.BufferGeometry; mat: THREE.Material }
interface Prepared {
  frame: Part[]
  /** The roller shutter at the door, kept apart so it can roll up; `top` is its upper edge. */
  shutter: { parts: Part[]; top: number }
  pallet: Part[]
  /** Deck height relative to a pallet's centre. */
  deck: number
  pitch: number
  pointAt: (s: number, out: THREE.Vector3) => THREE.Vector3
  size: TowerSize
}
const prepared = new WeakMap<THREE.Object3D, Prepared>()

/** Plain float attributes (the model uses quantized ones), so geometry can be baked and stretched. */
export function toFloat(src: THREE.BufferGeometry) {
  const g = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'uv']) {
    const a = src.getAttribute(name) as THREE.BufferAttribute | undefined
    if (!a) continue
    const out = new Float32Array(a.count * a.itemSize)
    for (let i = 0; i < a.count; i++) {
      out[i * a.itemSize] = a.getX(i)
      if (a.itemSize > 1) out[i * a.itemSize + 1] = a.getY(i)
      if (a.itemSize > 2) out[i * a.itemSize + 2] = a.getZ(i)
    }
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize))
  }
  if (src.index) g.setIndex(Array.from(src.index.array))
  return g
}

/** Merge baked geometries that share a material and attribute layout. */
function mergeByMaterial(list: { geo: THREE.BufferGeometry; mat: THREE.Material }[]): Part[] {
  const groups = new Map<string, Part & { geos: THREE.BufferGeometry[] }>()
  for (const { geo, mat } of list) {
    const key = `${mat.uuid}|${Object.keys(geo.attributes).sort().join(',')}|${geo.index ? 1 : 0}`
    const g = groups.get(key) ?? { geo, mat, geos: [] }
    g.geos.push(geo)
    groups.set(key, g)
  }
  return [...groups.values()].flatMap((g) => {
    const geo = mergeGeometries(g.geos)
    return geo ? [{ geo, mat: g.mat }] : []
  })
}

const visibleChain = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false; return true }
/** Door nodes in the model ("men" is door). */
const SHUTTER = /^(men|menzi|men2521)$/
const inShutter = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (SHUTTER.test(p.name)) return true; return false }
const underPallet = (o: THREE.Object3D) => { for (let p: THREE.Object3D | null = o; p; p = p.parent) if (PALLET.test(p.name)) return p; return null }

/**
 * One-time setup of the cached glTF: textures and material tuning, scale and
 * grading, then the frame is baked into tower space with its straight runs
 * stretched so the chain loop carries PALLETS pallets at the original pitch
 * (the same approach as the AutoDock Kozhikode Beach demo).
 */
function prepare(scene: THREE.Object3D, materials: Record<string, THREE.Material>, atlas: THREE.Texture, board: THREE.Texture): Prepared {
  const hit = prepared.get(scene)
  if (hit) return hit
  for (const tex of [atlas, board]) { tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8 }
  for (const m of Object.values(materials) as THREE.MeshStandardMaterial[]) {
    if (m.name === 'blinn35') { m.map = atlas; m.needsUpdate = true }
    if (m.name === 'blinn36') { m.map = board; m.needsUpdate = true }
    const t = TUNE[m.name]
    if (t) { m.roughness = t[0]; m.metalness = t[1] }
  }

  const raw = scene.clone(true)
  raw.traverse((o) => { if (HIDDEN.has(o.name)) o.visible = false })
  const first = raw.getObjectByProperty('name', 'cheban01') ?? raw
  raw.updateMatrixWorld(true)
  const ps = new THREE.Box3().setFromObject(first).getSize(new THREE.Vector3())
  raw.scale.multiplyScalar(PALLET_LEN / Math.max(ps.x, ps.z))
  const inner = new THREE.Group()
  inner.add(raw)
  inner.rotation.y = Math.PI // door toward +z
  const root = new THREE.Group()
  root.add(inner)
  root.updateMatrixWorld(true)

  // Grade = the most common low mesh base, so a pit or footing below ground doesn't lift the tower.
  const bb = new THREE.Box3().setFromObject(root)
  const c = bb.getCenter(new THREE.Vector3())
  const mins: number[] = []
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || !visibleChain(o)) return
    const b = new THREE.Box3().setFromObject(o)
    if (Number.isFinite(b.min.y)) mins.push(Math.round(b.min.y * 50) / 50)
  })
  mins.sort((a, b) => a - b)
  const counts = new Map<number, number>()
  for (const v of mins.slice(0, Math.max(1, Math.ceil(mins.length / 2)))) counts.set(v, (counts.get(v) ?? 0) + 1)
  let grade = bb.min.y
  let best = 0
  for (const [v, n] of counts) if (n > best || (n === best && v < grade)) { best = n; grade = v }
  if (grade - bb.min.y > 1.5) grade = bb.min.y
  inner.position.set(-c.x, -grade, -c.z)
  root.updateMatrixWorld(true)

  // The original loop through the 12 pallet centres, and its stretch to PALLETS.
  const recs: { node: THREE.Object3D; c: THREE.Vector3 }[] = []
  root.traverse((o) => { if (PALLET.test(o.name)) recs.push({ node: o, c: new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()) }) })
  const xs = recs.map((r) => r.c.x)
  const ys = recs.map((r) => r.c.y)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const R = (Math.max(...xs) - Math.min(...xs)) / 2
  const z = recs.reduce((a, r) => a + r.c.z, 0) / recs.length
  const yBot = Math.min(...ys) + R
  const yTop = Math.max(...ys) - R
  const H = yTop - yBot
  const L = 2 * Math.PI * R + 2 * H
  const pitch = L / recs.length
  const dH = (PALLETS * pitch - L) / 2
  const kS = (H + dH) / H
  const yMap = (y: number) => (y <= yBot ? y : y >= yTop ? y + dH : yBot + (y - yBot) * kS)

  const H2 = H + dH
  const Q = (Math.PI / 2) * R
  const HALF = Math.PI * R
  const L2 = PALLETS * pitch
  const pointAt = (s: number, out: THREE.Vector3) => {
    let m = ((s % L2) + L2) % L2
    if (m < Q) { const a = m / R; return out.set(cx + R * Math.sin(a), yBot - R * Math.cos(a), z) }
    m -= Q
    if (m < H2) return out.set(cx + R, yBot + m, z)
    m -= H2
    if (m < HALF) { const a = m / R; return out.set(cx + R * Math.cos(a), yTop + dH + R * Math.sin(a), z) }
    m -= HALF
    if (m < H2) return out.set(cx - R, yTop + dH - m, z)
    m -= H2
    const a = m / R
    return out.set(cx - R * Math.cos(a), yBot - R * Math.sin(a), z)
  }

  // Fit maps. x: everything inside the pallets' outer edge scales by sIn, the
  // overhang beyond it squeezes into the margin. z: the deck keeps its length,
  // ramps, frame ends, fences and roof squeeze into what is left of FIT_D.
  const first2 = recs.reduce((a, r) => (r.c.y < a.c.y ? r : a))
  const pb = new THREE.Box3().setFromObject(first2.node)
  const palletHalfW = (pb.max.x - pb.min.x) / 2
  const xIn = R + palletHalfW
  const sIn = Math.min(1, (FIT_W / 2 - 0.05) / xIn)
  const deckHalf = (PALLET_LEN * DECK_FRACTION) / 2
  let xMax = 0
  let zMax = 0
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !visibleChain(mesh)) return
    const b = new THREE.Box3().setFromObject(mesh)
    xMax = Math.max(xMax, Math.abs(b.min.x - cx), Math.abs(b.max.x - cx))
    zMax = Math.max(zMax, Math.abs(b.min.z - z), Math.abs(b.max.z - z))
  })
  const kx = xMax > xIn ? (FIT_W / 2 - xIn * sIn) / (xMax - xIn) : 1
  const kz = zMax > deckHalf ? (FIT_D / 2 - deckHalf) / (zMax - deckHalf) : 1
  const fitX = (u: number) => { const a = Math.abs(u); return Math.sign(u) * (a <= xIn ? a * sIn : xIn * sIn + (a - xIn) * kx) }
  const fitZ = (u: number) => { const a = Math.abs(u); return Math.sign(u) * (a <= deckHalf ? a : deckHalf + (a - deckHalf) * kz) }
  const fitGeometry = (g: THREE.BufferGeometry, ox: number, oz: number, linearX: boolean) => {
    const P = g.attributes.position
    for (let i = 0; i < P.count; i++) {
      P.setX(i, ox + (linearX ? (P.getX(i) - ox) * sIn : fitX(P.getX(i) - ox)))
      P.setZ(i, oz + fitZ(P.getZ(i) - oz))
    }
    g.computeVertexNormals()
    return g
  }
  const loopAt = pointAt
  const fittedPointAt = (s: number, out: THREE.Vector3) => { loopAt(s, out); out.x = cx + (out.x - cx) * sIn; return out }

  // Frame: bake into tower space; long members stretch, small parts and signage ride rigidly.
  const frameList: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []
  const shutterList: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material) || !visibleChain(mesh) || underPallet(mesh)) return
    const g = toFloat(mesh.geometry).applyMatrix4(mesh.matrixWorld)
    g.computeBoundingBox()
    const b = g.boundingBox!
    if (b.max.y - b.min.y < 1.6 || /blinn35|blinn36/.test(mesh.material.name)) {
      const cy = (b.min.y + b.max.y) / 2
      g.translate(0, yMap(cy) - cy, 0)
    } else {
      const P = g.attributes.position
      const N = g.attributes.normal
      const n = new THREE.Vector3()
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i)
        P.setY(i, yMap(y))
        if (N && y > yBot && y < yTop) { n.set(N.getX(i), N.getY(i) / kS, N.getZ(i)).normalize(); N.setXYZ(i, n.x, n.y, n.z) }
      }
    }
    ;(inShutter(mesh) ? shutterList : frameList).push({ geo: fitGeometry(g, cx, z, false), mat: mesh.material })
  })

  // Pallet template: the ground pallet, centred on its own origin.
  const bottom = recs.reduce((a, r) => (r.c.y < a.c.y ? r : a))
  const palletList: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = []
  bottom.node.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || Array.isArray(mesh.material) || !visibleChain(mesh)) return
    const g = toFloat(mesh.geometry).applyMatrix4(mesh.matrixWorld).translate(-bottom.c.x, -bottom.c.y, -bottom.c.z)
    palletList.push({ geo: fitGeometry(g, 0, 0, true), mat: mesh.material })
  })
  const frame = mergeByMaterial(frameList)
  const shutterParts = mergeByMaterial(shutterList)
  const sb = new THREE.Box3()
  for (const p of shutterParts) { p.geo.computeBoundingBox(); sb.union(p.geo.boundingBox!) }
  const pallet = mergeByMaterial(palletList)

  // Deck: lowest up-facing pallet surface under the wheel lines.
  const probe = new THREE.Group()
  for (const p of pallet) probe.add(new THREE.Mesh(p.geo, p.mat))
  probe.updateMatrixWorld(true)
  const rc = new THREE.Raycaster()
  rc.far = 3
  let deck = Infinity
  for (const dz of [-1.3, 1.3]) for (const dx of [-0.75, 0.75]) {
    rc.set(new THREE.Vector3(dx, 1.2, dz), new THREE.Vector3(0, -1, 0))
    for (const h of rc.intersectObject(probe, true)) if (h.face && h.face.normal.y > 0.7 && h.point.y > -1.8 && h.point.y < deck) deck = h.point.y
  }

  const fb = new THREE.Box3()
  for (const p of frame) { p.geo.computeBoundingBox(); fb.union(p.geo.boundingBox!) }
  const sz = fb.getSize(new THREE.Vector3())
  const result: Prepared = {
    frame, pallet, pitch, pointAt: fittedPointAt,
    shutter: { parts: shutterParts, top: shutterParts.length ? sb.max.y : 0 },
    deck: Number.isFinite(deck) ? deck : -0.6,
    size: { w: sz.x, d: sz.z, h: fb.max.y, front: fb.max.z },
  }
  prepared.set(scene, result)
  return result
}

/** The chain loop in tower space, for scenes that drive a car onto a pallet and ride it. */
export function useTowerLayout() {
  const { scene, materials } = useGLTF(TOWER_URL)
  const [atlas, board] = useTexture(TEX)
  const t = prepare(scene, materials, atlas, board)
  return useMemo(() => ({ pointAt: t.pointAt, deck: t.deck, pitch: t.pitch, carScale: CAR_ON_PALLET, size: t.size }), [t])
}

export interface TowerLoad { kind: CarKind; color: string }

/** How far each tower's roller shutter is open, 0 to 1. Written by the film every frame; read here without re-rendering. */
export const SHUTTERS: [number, number] = [0, 0]
/** Whether each tower's `doorPallet` has reached the door. Written every frame; the game reads it to start a car's exit. */
export const DOCKED: [boolean, boolean] = [false, false]

type RotaryTowerProps = {
  /** One entry per pallet, starting from the ground pallet; null = empty pallet. */
  load: (TowerLoad | null)[]
  reportSize?: boolean
  /** Driven by the control room: ignore the idle spin and turn only to bring `doorPallet` to the door. */
  controlled?: boolean
  /** Pallet to bring to the door; its car stays hidden until the pallet gets there. */
  doorPallet?: number | null
  /** Which entry of SHUTTERS opens this tower's door (and of DOCKED it reports to). */
  shutterOf?: 0 | 1
  /** Hide the door pallet's car until the pallet arrives (it is about to be driven on). Off in the game, where it rides down to be collected. */
  hideUntilDocked?: boolean
} & Omit<React.ComponentProps<'group'>, 'children'>

/** An AutoDock rotary tower with its pallets moving on the chain loop. */
export function RotaryTower({ load, reportSize, controlled = false, doorPallet = null, shutterOf, hideUntilDocked = true, ...props }: RotaryTowerProps) {
  const { scene, materials } = useGLTF(TOWER_URL)
  const [atlas, board] = useTexture(TEX)
  const seal = useGLTF(CARS.seal.url).scene
  const atto = useGLTF(CARS.atto.url).scene
  const tower = prepare(scene, materials, atlas, board)
  const setTowerSize = useSceneStore((s) => s.setTowerSize)

  useEffect(() => { if (reportSize) setTowerSize(tower.size) }, [reportSize, tower.size, setTowerSize])

  // Cars for the loaded pallets, built once per load.
  const cars = useMemo(
    () => load.map((spec) => (spec ? makeCar(spec.kind === 'seal' ? seal : atto, spec.kind, spec.color) : null)),
    [load, seal, atto],
  )

  const pallets = useRef<(THREE.Group | null)[]>([])
  const offset = useRef(0)
  const spinning = useSceneStore((s) => s.spinning)
  const mode = useSceneStore((s) => s.mode)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const waiting = useRef<THREE.Object3D | null>(null)
  const carObjs = useRef<(THREE.Object3D | null)[]>([])
  const shutter = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (mode !== 'autodock') return // towers are hidden in Today mode
    // the shutter rolls up into its box: squash it toward its top edge
    if (shutter.current) shutter.current.scale.y = 1 - 0.97 * (shutterOf === undefined ? 0 : SHUTTERS[shutterOf])
    const step = Math.min(dt, 0.05)
    let docked = true
    if (controlled && doorPallet !== null) {
      // Pallet i sits at the door (s = 0) when offset = -i * pitch; go the shorter way round.
      const loop = PALLETS * tower.pitch
      let d = (((-doorPallet * tower.pitch - offset.current) % loop) + loop) % loop
      if (d > loop / 2) d -= loop
      const move = step * SEEK_SPEED
      if (Math.abs(d) <= move) offset.current += d
      else { offset.current += Math.sign(d) * move; docked = false }
    } else if (!controlled && spinning) offset.current += step * SPEED
    if (shutterOf !== undefined) DOCKED[shutterOf] = controlled && doorPallet !== null && docked
    pallets.current.forEach((g, i) => { if (g) g.position.copy(tower.pointAt(i * tower.pitch + offset.current, tmp)) })
    // The new car drives on once its pallet is at the door; one cut short by a newer target shows at once.
    const arriving = doorPallet === null ? null : carObjs.current[doorPallet] ?? null
    if (waiting.current && waiting.current !== arriving) waiting.current.visible = true
    if (arriving) arriving.visible = docked || !hideUntilDocked
    waiting.current = arriving
  })

  return (
    <group {...props}>
      {tower.frame.map((p) => (
        <mesh key={p.geo.uuid} geometry={p.geo} material={p.mat} castShadow receiveShadow />
      ))}
      <group ref={shutter} position={[0, tower.shutter.top, 0]}>
        {tower.shutter.parts.map((p) => (
          <mesh key={p.geo.uuid} geometry={p.geo} material={p.mat} position={[0, -tower.shutter.top, 0]} castShadow receiveShadow />
        ))}
      </group>
      {Array.from({ length: PALLETS }, (_, i) => (
        <group key={i} ref={(g) => { pallets.current[i] = g }} position={tower.pointAt(i * tower.pitch, new THREE.Vector3()).toArray()}>
          {tower.pallet.map((p) => (
            <mesh key={p.geo.uuid} geometry={p.geo} material={p.mat} castShadow receiveShadow />
          ))}
          {cars[i] && <primitive object={cars[i]} ref={(o: THREE.Object3D | null) => { carObjs.current[i] = o }} position={[0, tower.deck, 0]} scale={CAR_ON_PALLET} />}
        </group>
      ))}
    </group>
  )
}

useGLTF.preload(TOWER_URL)
