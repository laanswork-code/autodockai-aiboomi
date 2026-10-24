/*
 * The driver as a stick figure: a head, a spine and four two-part limbs. It
 * walks along a timed path (legs and arms swing with distance, not time, so
 * feet do not slide) and can reach one hand out to a point.
 */
import * as THREE from 'three'
import { clamp01, smooth } from './timeline'

const LIMB = 0.035
const THIGH = 0.46
const SHIN = 0.46
const UPPER = 0.31
const FORE = 0.29
const HIP_Y = THIGH + SHIN
const SPINE = 0.56
const STRIDE = 1.5 // metres per full walk cycle

export interface Figure { root: THREE.Group; hand: THREE.Object3D; set: (pose: Pose) => void }
export interface Pose { x: number; z: number; y: number; yaw: number; walked: number; moving: number; reach: number }

function bone(len: number, mat: THREE.Material) {
  const pivot = new THREE.Group()
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(LIMB, len - 2 * LIMB, 4, 8), mat)
  m.position.y = -len / 2
  m.castShadow = true
  pivot.add(m)
  const end = new THREE.Group()
  end.position.y = -len
  pivot.add(end)
  return { pivot, end }
}

export function buildFigure(color: string): Figure {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 })
  const root = new THREE.Group()
  root.scale.setScalar(0.92)
  const hips = new THREE.Group()
  hips.position.y = HIP_Y
  root.add(hips)
  const spine = new THREE.Mesh(new THREE.CapsuleGeometry(LIMB * 1.3, SPINE, 4, 8), mat)
  spine.position.y = SPINE / 2
  spine.castShadow = true
  hips.add(spine)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), mat)
  head.position.y = SPINE + 0.2
  head.castShadow = true
  hips.add(head)

  const leg = (side: number) => {
    const thigh = bone(THIGH, mat)
    thigh.pivot.position.x = side * 0.09
    hips.add(thigh.pivot)
    const shin = bone(SHIN, mat)
    thigh.end.add(shin.pivot)
    return { thigh: thigh.pivot, shin: shin.pivot }
  }
  const arm = (side: number) => {
    const upper = bone(UPPER, mat)
    upper.pivot.position.set(side * 0.17, SPINE - 0.04, 0)
    hips.add(upper.pivot)
    const fore = bone(FORE, mat)
    upper.end.add(fore.pivot)
    return { upper: upper.pivot, fore: fore.pivot, hand: fore.end }
  }
  const legs = [leg(-1), leg(1)]
  const arms = [arm(-1), arm(1)]
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(LIMB, 0.3, 4, 8), mat)
  shoulders.rotation.z = Math.PI / 2
  shoulders.position.y = SPINE - 0.04
  hips.add(shoulders)

  const set = (p: Pose) => {
    root.position.set(p.x, p.y, p.z)
    root.rotation.y = p.yaw
    const phase = (p.walked / STRIDE) * Math.PI * 2
    const swing = 0.42 * p.moving
    legs.forEach((l, i) => {
      const s = Math.sin(phase + i * Math.PI)
      l.thigh.rotation.x = -s * swing
      // the knee bends while the leg swings forward
      l.shin.rotation.x = Math.max(0, Math.cos(phase + i * Math.PI)) * 0.7 * p.moving
    })
    hips.position.y = HIP_Y - Math.abs(Math.cos(phase)) * 0.025 * p.moving
    arms.forEach((a, i) => {
      const s = Math.sin(phase + i * Math.PI)
      // right arm (i = 1) reaches forward to the charger or the car
      const reach = i === 1 ? p.reach : 0
      a.upper.rotation.x = s * swing * 0.8 * (1 - reach) - reach * 1.35
      a.upper.rotation.z = (i === 0 ? -1 : 1) * 0.08
      a.fore.rotation.x = -0.25 * p.moving * (1 - reach) - reach * 0.15
    })
  }
  set({ x: 0, y: 0, z: 0, yaw: 0, walked: 0, moving: 0, reach: 0 })
  return { root, hand: arms[1].hand, set }
}

/** A timed walk: stand at points, walk straight between them, optionally reach while standing. */
export interface Leg { t0: number; t1: number; to: THREE.Vector2; reach?: boolean; face?: THREE.Vector2 }

/** Pose along a route of legs that starts at `start`. Yaw faces the walking direction, or `face` while standing. */
export function poseOnRoute(t: number, start: THREE.Vector2, legs: Leg[]): Omit<Pose, 'y'> {
  let at = start.clone()
  let walked = 0
  let yaw = 0
  for (const l of legs) {
    const d = l.to.clone().sub(at)
    const len = d.length()
    const dirYaw = len > 1e-6 ? Math.atan2(d.x, d.y) : yaw
    if (t < l.t0) break
    if (len > 1e-6) yaw = dirYaw
    if (l.face) yaw = Math.atan2(l.face.x - l.to.x, l.face.y - l.to.y)
    if (t < l.t1) {
      const k = (t - l.t0) / (l.t1 - l.t0)
      if (len > 1e-6) {
        const p = at.clone().addScaledVector(d, k)
        return { x: p.x, z: p.y, yaw: dirYaw, walked: walked + len * k, moving: Math.min(1, Math.min(k, 1 - k) * 8), reach: 0 }
      }
      const reach = l.reach ? smooth(Math.min(k, 1 - k) * 4) : 0
      return { x: l.to.x, z: l.to.y, yaw, walked, moving: 0, reach }
    }
    walked += len
    at = l.to.clone()
  }
  return { x: at.x, z: at.y, yaw, walked, moving: 0, reach: 0 }
}

export const fade = (t: number, t0: number, t1: number) => clamp01((t - t0) / (t1 - t0))
