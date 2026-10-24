/*
 * The two towers as the server sees them: every pallet's car, and the pallet
 * each tower is turning to its door. Plus the automated part of parking: a
 * car stopped in the pink circle turns to face the road, the shutter rolls up
 * and it reverses onto its pallet; a retrieved car rides its pallet down and
 * drives out through the door to the circle.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildHeroCar, rollWheels } from '../film/heroCar'
import { CARS, type CarKind } from '../scene/carModels'
import { RotaryTower, SHUTTERS, useTowerLayout, type TowerLoad } from '../scene/RotaryTower'
import { useSceneStore } from '../store/useSceneStore'
import { dropSpot, towerPlaces } from './layout'
import { live, shutterTarget, useGame } from './store'

export function GameTowers() {
  const world = useGame((s) => s.world)
  const size = useSceneStore((s) => s.towerSize)
  // while my car is driving out, it is the moving car, not the one on the pallet
  const hide = useGame((s) => (s.car === 'undocking' ? s.me?.plate ?? null : null))
  const places = towerPlaces(size)
  // the world object only changes when the server pushes a change, so this rebuilds rarely
  const loads = useMemo<(TowerLoad | null)[][]>(
    () => (world?.towers ?? []).map((t) => t.pallets.map((p) => (p && p.plate !== hide ? { kind: p.kind, color: p.color } : null))),
    [world, hide],
  )
  useFrame((_, dt) => {
    for (const k of [0, 1] as const) SHUTTERS[k] += (shutterTarget[k] - SHUTTERS[k]) * Math.min(1, dt * 2.5)
  })
  if (!world) return null
  return (
    <>
      {places.map((p) => (
        <RotaryTower key={p.k} load={loads[p.k]} controlled doorPallet={world.towers[p.k].door} shutterOf={p.k} hideUntilDocked={false}
          reportSize={p.k === 0} position={[p.x, 0.08, p.z]} rotation={[0, p.yaw, 0]} />
      ))}
    </>
  )
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
/** Shortest signed angle from a to b. */
const angleTo = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/** Where a car sits on the pallet at tower k's door, in world space. */
function useDoorPallet(k: 0 | 1) {
  const layout = useTowerLayout()
  const size = useSceneStore((s) => s.towerSize)
  return useMemo(() => {
    const place = towerPlaces(size)[k]
    const local = layout.pointAt(0, new THREE.Vector3())
    local.y += layout.deck
    const world = local.applyAxisAngle(new THREE.Vector3(0, 1, 0), place.yaw).add(new THREE.Vector3(place.x, 0.08, place.z))
    return { pos: world, yaw: place.yaw, scale: layout.carScale }
  }, [layout, size, k])
}

interface Move { kind: CarKind; color: string; plate: string; tower: 0 | 1; onDone: () => void }

/** My car going in: from where it stopped, turn to face the road at the circle, then reverse onto the pallet. */
export function DockingCar({ kind, color, plate, tower, from, onDone }: Move & { from: { x: number; z: number; yaw: number } }) {
  const { scene } = useGLTF(CARS[kind].url)
  const hero = useMemo(() => buildHeroCar(scene, kind, color, plate), [scene, kind, color, plate])
  const pallet = useDoorPallet(tower)
  const drop = dropSpot(tower)
  const t = useRef(0)
  const done = useRef(false)
  const TURN = 1.6
  const IN = 3.4
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.05)
    const a = clamp01(t.current / TURN)
    const b = clamp01((t.current - TURN) / IN)
    const r = hero.root
    if (b === 0) {
      // the turntable at the circle: slide to its centre and swing round to face the road
      const k = ease(a)
      r.position.set(THREE.MathUtils.lerp(from.x, drop.x, k), 0, THREE.MathUtils.lerp(from.z, drop.z, k))
      r.rotation.y = from.yaw + angleTo(from.yaw, drop.yaw) * k
      rollWheels(hero, 0, 0, 1)
    } else {
      const k = ease(b)
      r.position.set(THREE.MathUtils.lerp(drop.x, pallet.pos.x, k), THREE.MathUtils.lerp(0, pallet.pos.y, k), THREE.MathUtils.lerp(drop.z, pallet.pos.z, k))
      r.rotation.y = drop.yaw
      r.scale.setScalar(THREE.MathUtils.lerp(1, pallet.scale, clamp01((b - 0.6) / 0.4)))
      rollWheels(hero, -k * new THREE.Vector2(drop.x - pallet.pos.x, drop.z - pallet.pos.z).length(), 0, 1)
    }
    shutterTarget[tower] = t.current > TURN * 0.6 && b < 1 ? 1 : 0
    live.car.copy(r.position)
    live.carQuat.setFromEuler(new THREE.Euler(0, r.rotation.y, 0))
    if (b >= 1 && !done.current) { done.current = true; onDone() }
  })
  return <primitive object={hero.root} />
}

/** My car coming out: off the pallet at the door, forward through the shutter to the circle. */
export function UndockingCar({ kind, color, plate, tower, onDone }: Move) {
  const { scene } = useGLTF(CARS[kind].url)
  const hero = useMemo(() => buildHeroCar(scene, kind, color, plate), [scene, kind, color, plate])
  const pallet = useDoorPallet(tower)
  const drop = dropSpot(tower)
  const t = useRef(0)
  const done = useRef(false)
  const OPEN = 0.9
  const OUT = 3
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.05)
    shutterTarget[tower] = t.current < OPEN + OUT + 0.3 ? 1 : 0
    const b = clamp01((t.current - OPEN) / OUT)
    const k = ease(b)
    const r = hero.root
    r.position.set(THREE.MathUtils.lerp(pallet.pos.x, drop.x, k), THREE.MathUtils.lerp(pallet.pos.y, 0, k), THREE.MathUtils.lerp(pallet.pos.z, drop.z, k))
    r.rotation.y = drop.yaw
    r.scale.setScalar(THREE.MathUtils.lerp(pallet.scale, 1, clamp01(b / 0.4)))
    rollWheels(hero, k * new THREE.Vector2(drop.x - pallet.pos.x, drop.z - pallet.pos.z).length(), 0, 1)
    live.car.copy(r.position)
    live.carQuat.setFromEuler(new THREE.Euler(0, drop.yaw, 0))
    if (b >= 1 && !done.current) { done.current = true; onDone() }
  })
  return <primitive object={hero.root} />
}
