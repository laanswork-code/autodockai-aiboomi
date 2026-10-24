/*
 * The player on foot: a capsule moved by Rapier's character controller
 * (slides along walls, steps up kerbs, sticks to the ground), drawn as the
 * film's walking figure. Keyboard only: A/D turn, W/S walk, Shift runs.
 */
import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat'
import { useEffect, useMemo, useRef } from 'react'
import { buildFigure } from '../film/walker'
import { axes } from './input'
import { live } from './store'

const WALK = 2
const RUN = 5.2
const TURN = 2.6     // rad/s
const GRAVITY = -18
const HALF = 0.55    // capsule half height (cylinder part)
const RADIUS = 0.3
const FOOT = HALF + RADIUS

export function Foot({ color, spawn }: { color: string; spawn: { x: number; z: number; yaw: number } }) {
  const figure = useMemo(() => buildFigure(color), [color])
  const body = useRef<RapierRigidBody>(null)
  const cc = useRef<KinematicCharacterController | null>(null)
  const yaw = useRef(spawn.yaw)
  const vy = useRef(0)
  const speed = useRef(0)
  const { world } = useRapier()

  useEffect(() => {
    const c = world.createCharacterController(0.03)
    c.enableAutostep(0.45, 0.25, true)
    c.enableSnapToGround(0.4)
    c.setApplyImpulsesToDynamicBodies(true)
    c.setCharacterMass(75)
    cc.current = c
    yaw.current = spawn.yaw
    return () => { cc.current = null; world.removeCharacterController(c) }
  }, [world, spawn])

  useFrame((_, delta) => {
    const b = body.current
    const c = cc.current
    if (!b || !c) return
    const dt = Math.min(delta, 0.05)
    const { forward, turn, run } = axes()
    yaw.current -= turn * TURN * dt
    const want = forward * (run && forward > 0 ? RUN : WALK)
    speed.current += (want - speed.current) * Math.min(1, dt * 8)
    vy.current = c.computedGrounded() ? -1 : vy.current + GRAVITY * dt
    const s = speed.current * dt
    c.computeColliderMovement(b.collider(0), { x: Math.sin(yaw.current) * s, y: vy.current * dt, z: Math.cos(yaw.current) * s })
    const m = c.computedMovement()
    const p = b.translation()
    const next = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z }
    b.setNextKinematicTranslation(next)
    const moved = Math.hypot(m.x, m.z)
    live.walked += moved * Math.sign(speed.current || 1)
    live.moving = Math.min(1, Math.abs(speed.current) / WALK)
    live.foot.set(next.x, next.y - FOOT, next.z)
    live.footYaw = yaw.current
    figure.set({ x: next.x, y: next.y - FOOT, z: next.z, yaw: yaw.current, walked: live.walked, moving: live.moving, reach: 0 })
  })

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[spawn.x, FOOT + 0.05, spawn.z]} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[HALF, RADIUS]} />
      </RigidBody>
      <primitive object={figure.root} />
    </>
  )
}
