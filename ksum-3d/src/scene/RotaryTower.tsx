import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSceneStore, type TowerSize } from '../store/useSceneStore'
import { CARS, makeCar, type CarKind } from './carModels'

const TOWER_URL = '/models/rotary.glb'
const TEX = ['/models/tower-atlas.webp', '/models/tower-board.jpg']
const PALLET = /^cheban\d+$/i
/**
 * Scale is calibrated from the model itself: a pallet is sized to 5.4 m, enough
 * for the 4.8 m BYD Seal. (The Kozhikode demo's factor assumed a different
 * loader's units.) Material tuning matches that demo.
 */
const PALLET_LEN = 5.4
const TUNE: Record<string, [number, number]> = {
  zhuti: [0.52, 0.34], yshuang: [0.55, 0.14], ysyin: [0.36, 0.46], ysbai: [0.6, 0.06],
  yshei: [0.58, 0.2], jingzi3: [0.24, 0.5], dingpengjiazi: [0.38, 0.44],
}
const HIDDEN = new Set(['typeMesh1', 'a10xianshiping_3'])
const SPEED = 0.55 // m/s along the chain

interface Prepared { template: THREE.Group; size: TowerSize }
const prepared = new WeakMap<THREE.Object3D, Prepared>()

/** One-time setup of the cached glTF: textures, material tuning, grounding, size. */
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
  raw.traverse((o) => {
    if (HIDDEN.has(o.name)) o.visible = false
    if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true }
  })
  const pallet = raw.getObjectByProperty('name', 'cheban01') ?? raw
  raw.updateMatrixWorld(true)
  const ps = new THREE.Box3().setFromObject(pallet).getSize(new THREE.Vector3())
  raw.scale.multiplyScalar(PALLET_LEN / Math.max(ps.x, ps.z))
  const inner = new THREE.Group()
  inner.add(raw)
  inner.rotation.y = Math.PI // door toward +z
  const template = new THREE.Group()
  template.add(inner)
  template.updateMatrixWorld(true)

  // Grade = the most common low mesh base, so a pit or footing below ground doesn't lift the tower.
  const bb = new THREE.Box3().setFromObject(template)
  const c = bb.getCenter(new THREE.Vector3())
  const mins: number[] = []
  template.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || !o.visible) return
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
  template.updateMatrixWorld(true)

  const frame = new THREE.Box3()
  template.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh || !o.visible) return
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (PALLET.test(p.name)) return
    frame.union(new THREE.Box3().setFromObject(o))
  })
  const s = frame.getSize(new THREE.Vector3())
  const result = { template, size: { w: s.x, d: s.z, h: frame.max.y } }
  prepared.set(scene, result)
  return result
}

interface Pallet { node: THREE.Object3D; s: number; c: THREE.Vector3; home: THREE.Vector3; toLocal: THREE.Matrix3 }

/** Chain loop through the pallet centres: two straight runs joined by semicircles. */
function fitLoop(centers: THREE.Vector3[]) {
  const xs = centers.map((c) => c.x)
  const ys = centers.map((c) => c.y)
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const R = (Math.max(...xs) - Math.min(...xs)) / 2
  const z = centers.reduce((a, c) => a + c.z, 0) / centers.length
  const yBot = Math.min(...ys) + R
  const yTop = Math.max(...ys) - R
  const H = yTop - yBot
  const Q = (Math.PI / 2) * R
  const HALF = Math.PI * R
  const L = 2 * Math.PI * R + 2 * H
  const pointAt = (s: number, out: THREE.Vector3) => {
    let m = ((s % L) + L) % L
    if (m < Q) { const a = m / R; return out.set(cx + R * Math.sin(a), yBot - R * Math.cos(a), z) }
    m -= Q
    if (m < H) return out.set(cx + R, yBot + m, z)
    m -= H
    if (m < HALF) { const a = m / R; return out.set(cx + R * Math.cos(a), yTop + R * Math.sin(a), z) }
    m -= HALF
    if (m < H) return out.set(cx - R, yTop - m, z)
    m -= H
    const a = m / R
    return out.set(cx - R * Math.cos(a), yBot - R * Math.sin(a), z)
  }
  return { pointAt, L }
}

/** Nearest loop position to a point, by sampling. */
function project(pointAt: (s: number, o: THREE.Vector3) => THREE.Vector3, L: number, p: THREE.Vector3) {
  const v = new THREE.Vector3()
  let best = 0
  let bd = Infinity
  for (let s = 0; s < L; s += L / 720) {
    const d = pointAt(s, v).distanceToSquared(p)
    if (d < bd) { bd = d; best = s }
  }
  return best
}

/** Deck height on a pallet: lowest up-facing surface under the wheel lines. */
function deckHeight(node: THREE.Object3D, c: THREE.Vector3) {
  const rc = new THREE.Raycaster()
  rc.far = 3
  let deck = Infinity
  for (const dz of [-1.3, 1.3]) for (const dx of [-0.75, 0.75]) {
    rc.set(new THREE.Vector3(c.x + dx, c.y + 1.2, c.z + dz), new THREE.Vector3(0, -1, 0))
    for (const h of rc.intersectObject(node, true)) {
      if (h.face && h.face.normal.y > 0.7 && h.point.y > c.y - 1.8 && h.point.y < deck) deck = h.point.y
    }
  }
  return Number.isFinite(deck) ? deck : c.y - 0.6
}

export interface TowerLoad { kind: CarKind; color: string }

type RotaryTowerProps = {
  /** One entry per pallet, starting from the ground pallet; null = empty pallet. */
  load: (TowerLoad | null)[]
  reportSize?: boolean
} & Omit<React.ComponentProps<'group'>, 'children'>

/** An AutoDock rotary tower with its pallets moving on the chain loop. */
export function RotaryTower({ load, reportSize, ...props }: RotaryTowerProps) {
  const { scene, materials } = useGLTF(TOWER_URL)
  const [atlas, board] = useTexture(TEX)
  const seal = useGLTF(CARS.seal.url).scene
  const atto = useGLTF(CARS.atto.url).scene
  const { template, size } = prepare(scene, materials, atlas, board)
  const setTowerSize = useSceneStore((s) => s.setTowerSize)

  useEffect(() => { if (reportSize) setTowerSize(size) }, [reportSize, size, setTowerSize])

  const rig = useMemo(() => {
    const obj = template.clone(true)
    obj.updateMatrixWorld(true)
    const nodes: THREE.Object3D[] = []
    obj.traverse((o) => { if (PALLET.test(o.name)) nodes.push(o) })
    const centers = nodes.map((n) => new THREE.Box3().setFromObject(n).getCenter(new THREE.Vector3()))
    const { pointAt, L } = fitLoop(centers)
    const pallets: Pallet[] = nodes.map((node, i) => ({
      node,
      c: centers[i],
      s: project(pointAt, L, centers[i]),
      home: node.position.clone(),
      toLocal: new THREE.Matrix3().setFromMatrix4(node.parent!.matrixWorld.clone().invert()),
    }))
    // Ground pallet first, then around the loop.
    pallets.sort((a, b) => a.c.y - b.c.y)
    const ground = pallets[0].s
    pallets.sort((a, b) => ((a.s - ground + L) % L) - ((b.s - ground + L) % L))

    // Cars ride as children of their pallet, placed in tower space then converted.
    pallets.forEach((p, i) => {
      const spec = load[i]
      if (!spec) return
      const car = makeCar(spec.kind === 'seal' ? seal : atto, spec.kind, spec.color)
      const deck = deckHeight(p.node, p.c)
      const world = new THREE.Matrix4().makeTranslation(p.c.x, deck, p.c.z)
      car.applyMatrix4(p.node.matrixWorld.clone().invert().multiply(world))
      p.node.add(car)
    })
    return { obj, pallets, pointAt }
  }, [template, load, seal, atto])

  const spinning = useSceneStore((s) => s.spinning)
  const offset = useRef(0)
  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    if (!spinning) return
    offset.current += Math.min(dt, 0.05) * SPEED
    for (const p of rig.pallets) {
      rig.pointAt(p.s + offset.current, tmp).sub(p.c).applyMatrix3(p.toLocal)
      p.node.position.copy(p.home).add(tmp)
    }
  })

  return (
    <group {...props}>
      <primitive object={rig.obj} />
    </group>
  )
}

useGLTF.preload(TOWER_URL)
