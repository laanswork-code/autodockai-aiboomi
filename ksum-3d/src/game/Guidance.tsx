/*
 * GTA-style guidance: a glowing route line on the road to your tower, a pink
 * circle at its door where the car is handed over, and a marker bobbing over
 * whatever you should go to next (your car, or the circle).
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { polylineRibbon } from '../lib/geo'
import { objective, PINK, ROUTE } from './guide'
import { DROP_RADIUS, dropSpot, routeTo } from './layout'
import { live, myBooking, useGame } from './store'

function Circle({ tower }: { tower: 0 | 1 }) {
  const d = dropSpot(tower)
  const ring = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3)
    if (ring.current) ring.current.scale.setScalar(1 + p * 0.05)
    if (glow.current) (glow.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + p * 0.14
  })
  return (
    <group position={[d.x, 0.12, d.z]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[DROP_RADIUS - 0.28, DROP_RADIUS, 64]} />
        <meshBasicMaterial color={PINK} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[DROP_RADIUS - 0.28, 64]} />
        <meshBasicMaterial color={PINK} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={glow} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[DROP_RADIUS, DROP_RADIUS, 1.8, 48, 1, true]} />
        <meshBasicMaterial color={PINK} transparent opacity={0.25} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

/** A downward chevron that bobs over the target. */
function Marker() {
  const g = useRef<THREE.Group>(null)
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-0.6, 0.5); s.lineTo(0, -0.4); s.lineTo(0.6, 0.5); s.lineTo(0.3, 0.5); s.lineTo(0, 0.05); s.lineTo(-0.3, 0.5); s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false }).translate(0, 0, -0.09)
  }, [])
  useFrame(({ clock, camera }) => {
    const o = objective()
    if (!g.current) return
    g.current.visible = !!o
    if (!o) return
    const y = (o.kind === 'car' ? 3.2 : 4) + Math.sin(clock.elapsedTime * 2.4) * 0.25
    g.current.position.set(o.x, y, o.z)
    g.current.rotation.y = Math.atan2(camera.position.x - o.x, camera.position.z - o.z)
  })
  return (
    <group ref={g}>
      <mesh geometry={shape}>
        <meshBasicMaterial color={PINK} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** The route line, rebuilt a few times a second from wherever you are. */
function Route() {
  const mesh = useRef<THREE.Mesh>(null)
  const last = useRef(0)
  useFrame(({ clock }) => {
    if (!mesh.current || clock.elapsedTime - last.current < 0.25) return
    last.current = clock.elapsedTime
    const o = objective()
    const s = useGame.getState()
    const show = o && o.kind !== 'car'
    mesh.current.visible = !!show
    if (!show) return
    const from = s.mode === 'car' ? live.car : live.foot
    const pts = routeTo(o.tower, from.x, from.z)
    mesh.current.geometry.dispose()
    mesh.current.geometry = polylineRibbon(pts.map((p) => [p.x, p.z] as const), 0.9, 0.11)
  })
  return (
    <mesh ref={mesh}>
      <bufferGeometry />
      <meshBasicMaterial color={ROUTE} transparent opacity={0.85} toneMapped={false} depthWrite={false} />
    </mesh>
  )
}

export function Guidance() {
  const tower = useGame((s) => myBooking(s)?.tower ?? null)
  const status = useGame((s) => myBooking(s)?.status ?? null)
  return (
    <>
      {tower !== null && status !== 'parked' && <Circle tower={tower} />}
      <Route />
      <Marker />
    </>
  )
}
