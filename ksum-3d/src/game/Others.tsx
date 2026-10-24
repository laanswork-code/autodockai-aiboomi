/*
 * Everyone else: their walking figure and their car, smoothed toward the
 * latest pose from the server. Their cars are solid (kinematic bodies), so
 * you can bump into them. The body stays mounted for as long as the player
 * is here; while their car is inside a tower it waits below the ground.
 */
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildHeroCar } from '../film/heroCar'
import { buildFigure } from '../film/walker'
import { CARS } from '../scene/carModels'
import type { PlayerInfo } from './protocol'
import { remote, useGame } from './store'

const SMOOTH = 12
const AWAY = { x: 0, y: -50, z: 0 }
const angleLerp = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k

function Other({ info }: { info: PlayerInfo }) {
  const { scene } = useGLTF(CARS[info.kind].url)
  const hero = useMemo(() => buildHeroCar(scene, info.kind, info.color, info.plate), [scene, info])
  const figure = useMemo(() => buildFigure(info.color), [info.color])
  const body = useRef<RapierRigidBody>(null)
  const [hasCar, setHasCar] = useState(false)
  const [onFoot, setOnFoot] = useState(true)
  const s = useRef({ x: 0, y: 0, z: 0, yaw: 0, walked: 0, moving: 0, seen: false })
  const car = useRef({ p: new THREE.Vector3(), q: new THREE.Quaternion(), seen: false })
  const target = useMemo(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }), [])

  useFrame((_, dt) => {
    const pose = remote.get(info.id)
    if (!pose) return
    const k = 1 - Math.exp(-dt * SMOOTH)
    const f = s.current
    if (!f.seen) Object.assign(f, { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, seen: true })
    f.x += (pose.x - f.x) * k
    f.y += (pose.y - f.y) * k
    f.z += (pose.z - f.z) * k
    f.yaw = angleLerp(f.yaw, pose.yaw, k)
    f.walked += (pose.walked - f.walked) * k
    f.moving += (pose.moving - f.moving) * k
    figure.set({ ...f, reach: 0 })
    if ((pose.mode === 'foot') !== onFoot) setOnFoot(pose.mode === 'foot')
    if (!!pose.car !== hasCar) setHasCar(!!pose.car)
    if (pose.car) {
      target.p.set(pose.car.x, pose.car.y, pose.car.z)
      target.q.set(pose.car.qx, pose.car.qy, pose.car.qz, pose.car.qw).normalize()
      const c = car.current
      if (!c.seen) { c.p.copy(target.p); c.q.copy(target.q); c.seen = true }
      c.p.lerp(target.p, k)
      c.q.slerp(target.q, k)
      body.current?.setNextKinematicTranslation(c.p)
      body.current?.setNextKinematicRotation(c.q)
      for (const w of hero.wheels) {
        w.steer.rotation.y = w.front ? pose.car.steer : 0
        w.spin.rotation.x = pose.car.spin
      }
    } else if (car.current.seen) {
      car.current.seen = false
      body.current?.setNextKinematicTranslation(AWAY)
    }
  })

  return (
    <>
      <primitive object={figure.root} visible={onFoot} />
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[AWAY.x, AWAY.y, AWAY.z]}>
        <CuboidCollider args={[hero.width / 2 - 0.06, 0.4, hero.length / 2 - 0.12]} position={[0, 0.92, 0]} />
        <primitive object={hero.root} visible={hasCar} />
      </RigidBody>
    </>
  )
}

export function Others() {
  const players = useGame((s) => s.players)
  const me = useGame((s) => s.me?.id)
  return <>{Object.values(players).filter((p) => p.id !== me).map((p) => <Other key={p.id} info={p} />)}</>
}
