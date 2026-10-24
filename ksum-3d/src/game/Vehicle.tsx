/*
 * The player's car with real physics: Rapier's raycast vehicle (the Bullet
 * model) on a 1,300 kg body with a low centre of mass. Four sprung wheels,
 * rear-wheel drive, brakes and a handbrake; front wheels steer, and steering
 * lock tightens with speed. The visible tyres take their steer angle, spin
 * and suspension travel from the physics every frame.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, useAfterPhysicsStep, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { DynamicRayCastVehicleController } from '@dimforge/rapier3d-compat'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { buildHeroCar } from '../film/heroCar'
import { CARS, type CarKind } from '../scene/carModels'
import { axes } from './input'
import { live } from './store'

const MASS = 1300
const ENGINE = 2900          // N per driven wheel
const REVERSE = 1700
const BRAKE = 42
const ROLLING = 3
const HANDBRAKE = 70
const TOP_SPEED = 25          // m/s, 90 km/h
const TOP_REVERSE = 7
const STEER_LOCK = 0.58       // rad at walking pace
const STEER_RATE = 2.6        // rad/s
const REST = 0.3              // suspension rest length
const UP = { x: 0, y: -1, z: 0 }
const AXLE = { x: -1, y: 0, z: 0 }

export interface VehicleProps {
  kind: CarKind
  color: string
  plate: string
  spawn: { x: number; z: number; yaw: number }
  /** Only the driver's inputs move it; otherwise the parking brake holds it. */
  driving: boolean
  onBody?: (b: RapierRigidBody | null) => void
}

export function Vehicle({ kind, color, plate, spawn, driving, onBody }: VehicleProps) {
  const { scene } = useGLTF(CARS[kind].url)
  const hero = useMemo(() => buildHeroCar(scene, kind, color, plate), [scene, kind, color, plate])
  const body = useRef<RapierRigidBody>(null)
  const vc = useRef<DynamicRayCastVehicleController | null>(null)
  const steer = useRef(0)
  const drivingRef = useRef(driving)
  useEffect(() => { drivingRef.current = driving }, [driving])
  const { world } = useRapier()
  // wheel centres in car space, and where each spring hangs from the body
  const wheels = useMemo(() => hero.wheels.map((w) => ({ w, at: w.steer.position.clone(), top: w.steer.position.y + REST })), [hero])

  useEffect(() => {
    const b = body.current
    if (!b) return
    onBody?.(b)
    // mass, a centre of mass just above the axles, and a car-shaped inertia, so it grips and resists rolling
    b.setAdditionalMassProperties(MASS, { x: 0, y: hero.radius + 0.12, z: 0 }, { x: 2400, y: 2700, z: 520 }, { x: 0, y: 0, z: 0, w: 1 }, true)
    const c = world.createVehicleController(b)
    c.indexUpAxis = 1
    c.setIndexForwardAxis = 2
    wheels.forEach(({ at, top }, i) => {
      c.addWheel({ x: at.x, y: top, z: at.z }, UP, AXLE, REST, hero.radius)
      c.setWheelSuspensionStiffness(i, 32)
      c.setWheelSuspensionCompression(i, 2.6)
      c.setWheelSuspensionRelaxation(i, 3.4)
      c.setWheelMaxSuspensionTravel(i, 0.22)
      c.setWheelMaxSuspensionForce(i, 1e5)
      c.setWheelFrictionSlip(i, 2.6)
      c.setWheelSideFrictionStiffness(i, 1)
    })
    vc.current = c
    return () => { onBody?.(null); vc.current = null; world.removeVehicleController(c) }
  }, [world, wheels, hero, onBody])

  useBeforePhysicsStep((w) => {
    const c = vc.current
    if (!c) return
    const dt = w.timestep
    const speed = c.currentVehicleSpeed()
    const { forward, turn, handbrake } = drivingRef.current ? axes() : { forward: 0, turn: 0, handbrake: true }
    let engine = 0
    let brake = ROLLING
    if (forward > 0) {
      if (speed < -0.4) brake = BRAKE
      else if (speed < TOP_SPEED) { engine = ENGINE; brake = 0 }
    } else if (forward < 0) {
      if (speed > 0.4) brake = BRAKE
      else if (speed > -TOP_REVERSE) { engine = -REVERSE; brake = 0 }
    }
    // steering lock tightens with speed, and the wheel turns at a hand's pace
    const lock = STEER_LOCK / (1 + Math.abs(speed) / 14)
    const target = -turn * lock
    steer.current += THREE.MathUtils.clamp(target - steer.current, -STEER_RATE * dt, STEER_RATE * dt)
    wheels.forEach(({ w }, i) => {
      c.setWheelEngineForce(i, w.front ? 0 : engine)
      c.setWheelSteering(i, w.front ? steer.current : 0)
      c.setWheelBrake(i, handbrake && !w.front ? HANDBRAKE : brake)
    })
    c.updateVehicle(dt)
  })

  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  useAfterPhysicsStep(() => {
    const b = body.current
    if (!b) return
    const p = b.translation()
    const r = b.rotation()
    live.car.set(p.x, p.y, p.z)
    live.carQuat.set(r.x, r.y, r.z, r.w)
    q.copy(live.carQuat)
    live.carYaw = e.setFromQuaternion(q, 'YXZ').y
    live.speed = vc.current?.currentVehicleSpeed() ?? 0
  })

  useFrame(() => {
    const c = vc.current
    if (!c) return
    wheels.forEach(({ w, top }, i) => {
      w.steer.rotation.y = c.wheelSteering(i) ?? 0
      w.spin.rotation.x = c.wheelRotation(i) ?? 0
      w.steer.position.y = top - (c.wheelSuspensionLength(i) ?? REST)
    })
    live.steer = steer.current
    live.spin = c.wheelRotation(0) ?? 0
  })

  return (
    <RigidBody ref={body} colliders={false} position={[spawn.x, 0.4, spawn.z]} rotation={[0, spawn.yaw, 0]}
      linearDamping={0.05} angularDamping={0.6} canSleep={false}>
      <CuboidCollider args={[hero.width / 2 - 0.06, 0.4, hero.length / 2 - 0.12]} position={[0, 0.92, 0]} density={0} friction={0.4} />
      <primitive object={hero.root} />
    </RigidBody>
  )
}
