import { Text } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  ATRIUM_T0, ATRIUM_T1, FACADE, MAIN_HEIGHT, WEST_WING, WEST_WING_HEIGHT, mainFootprint,
} from '../config/site'
import { arcPoint, arcWall, extrudeFootprint, yawOutward } from '../lib/geo'
import { claddingTexture, glazingTexture, wingTexture } from '../lib/textures'

const PLINTH = 3.5
const CANOPY_OUT = 7
const CANOPY_RISE = 3.2

/**
 * The Kerala Technology Innovation Zone building (home of KSUM), modelled from
 * the site photos: curved granite-clad mass with pale bands, a recessed blue
 * glass atrium framed by two tan pylons under a slanted louvered canopy, and a
 * taller stepped wing at the west end.
 */
export function KtizBuilding() {
  const geo = useMemo(() => {
    const atriumMid = (ATRIUM_T0 + ATRIUM_T1) / 2
    const doorHalf = 4 / FACADE.r
    return {
      main: extrudeFootprint(mainFootprint(), MAIN_HEIGHT),
      wing: extrudeFootprint(WEST_WING, WEST_WING_HEIGHT),
      wingStep: extrudeFootprint(WEST_WING.map(([x, z]) => [x - 4, z - 6] as const), WEST_WING_HEIGHT + 3.4),
      glass: arcWall(FACADE, ATRIUM_T0, ATRIUM_T1, 0.25, PLINTH, MAIN_HEIGHT - 0.6),
      plinth: arcWall(FACADE, ATRIUM_T0, ATRIUM_T1, 0.2, 0, PLINTH),
      door: arcWall(FACADE, atriumMid - doorHalf, atriumMid + doorHalf, 0.3, 0, 2.8),
      canopyGlass: canopyGeometry(),
    }
  }, [])

  const mats = useMemo(() => ({
    clad: new THREE.MeshStandardMaterial({ map: claddingTexture(), roughness: 0.82 }),
    roof: new THREE.MeshStandardMaterial({ color: '#8c8780', roughness: 0.95 }),
    wing: new THREE.MeshStandardMaterial({ map: wingTexture(), roughness: 0.82 }),
    glass: new THREE.MeshPhysicalMaterial({ map: glazingTexture(), metalness: 0.35, roughness: 0.08, envMapIntensity: 1.4, clearcoat: 1 }),
  }), [])

  return (
    <group>
      {/* ExtrudeGeometry groups: 0 = roof and floor caps, 1 = walls */}
      <mesh geometry={geo.main} material={[mats.roof, mats.clad]} castShadow receiveShadow />
      <mesh geometry={geo.wing} material={[mats.roof, mats.wing]} castShadow receiveShadow />
      <mesh geometry={geo.wingStep} material={[mats.roof, mats.wing]} castShadow receiveShadow />
      <mesh geometry={geo.glass} material={mats.glass} />
      <mesh geometry={geo.plinth}>
        <meshStandardMaterial color="#3a3530" roughness={0.7} />
      </mesh>
      <mesh geometry={geo.door}>
        <meshStandardMaterial color="#d8c9a4" emissive="#f4dca0" emissiveIntensity={0.6} />
      </mesh>
      <Pylon theta={ATRIUM_T0 + 1.2 / FACADE.r} />
      <Pylon theta={ATRIUM_T1 - 1.2 / FACADE.r} />
      <Canopy />
      <mesh geometry={geo.canopyGlass}>
        <meshStandardMaterial color="#cfe0ea" transparent opacity={0.35} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <EntranceSteps />
      <RoofKit />
    </group>
  )
}

/** Tan granite pylon flanking the atrium, leaning slightly outward like the real ones. */
function Pylon({ theta }: { theta: number }) {
  const [x, z] = arcPoint(FACADE, theta, 0.9)
  return (
    <mesh position={[x, MAIN_HEIGHT / 2 + 1.5, z]} rotation={[0, yawOutward(theta), 0]} castShadow>
      <boxGeometry args={[3, MAIN_HEIGHT + 3, 2.2]} />
      <meshStandardMaterial color="#b49a78" roughness={0.75} />
    </mesh>
  )
}

/** Radial beams of the slanted canopy plus the curved edge beam. */
function Canopy() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const span = Math.abs(ATRIUM_T1 - ATRIUM_T0) * FACADE.r
  const count = Math.floor(span / 2.2) + 1
  const len = Math.hypot(CANOPY_OUT + 2, CANOPY_RISE)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const t = ATRIUM_T0 + ((ATRIUM_T1 - ATRIUM_T0) * i) / (count - 1)
      const [x, z] = arcPoint(FACADE, t, CANOPY_OUT / 2 - 1)
      o.position.set(x, MAIN_HEIGHT + CANOPY_RISE / 2, z)
      o.rotation.set(0, yawOutward(t), 0)
      o.rotateX(-Math.atan2(CANOPY_RISE, CANOPY_OUT + 2))
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  }, [count])
  const edge = useMemo(() => {
    const g = arcWall(FACADE, ATRIUM_T0 - 0.01, ATRIUM_T1 + 0.01, CANOPY_OUT, MAIN_HEIGHT + CANOPY_RISE - 0.5, MAIN_HEIGHT + CANOPY_RISE + 0.3)
    return g
  }, [])
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[0.35, 0.6, len]} />
        <meshStandardMaterial color="#77736c" roughness={0.6} metalness={0.3} />
      </instancedMesh>
      <mesh geometry={edge}>
        <meshStandardMaterial color="#6f6b64" roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Sloped glass sheet under the canopy beams. */
function canopyGeometry() {
  const n = 24
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = ATRIUM_T0 + ((ATRIUM_T1 - ATRIUM_T0) * i) / n
    const [ax, az] = arcPoint(FACADE, t, -2)
    const [bx, bz] = arcPoint(FACADE, t, CANOPY_OUT)
    pos.push(ax, MAIN_HEIGHT + 0.2, az, bx, MAIN_HEIGHT + CANOPY_RISE - 0.2, bz)
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Granite steps up to the entrance and the Kerala Startup Mission board beside them. */
function EntranceSteps() {
  const mid = (ATRIUM_T0 + ATRIUM_T1) / 2
  const yaw = yawOutward(mid)
  const steps = [0, 1, 2, 3, 4]
  const signT = mid + 7 / FACADE.r
  const [sx, sz] = arcPoint(FACADE, signT, 3.2)
  return (
    <group>
      {steps.map((i) => {
        const [x, z] = arcPoint(FACADE, mid, 3.6 - i * 0.55)
        return (
          <mesh key={i} position={[x, 0.09 + i * 0.18, z]} rotation={[0, yaw, 0]} receiveShadow castShadow>
            <boxGeometry args={[9, 0.18 + i * 0.36, 0.55 + 0.01]} />
            <meshStandardMaterial color="#2f2e2c" roughness={0.6} />
          </mesh>
        )
      })}
      <group position={[sx, 0, sz]} rotation={[0, yawOutward(signT), 0]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <boxGeometry args={[3.4, 1.5, 0.2]} />
          <meshStandardMaterial color="#f4f4f2" roughness={0.4} />
        </mesh>
        <Text position={[0, 0.72, 0.11]} fontSize={0.2} color="#14303f" anchorX="center" anchorY="middle">
          KERALA STARTUP MISSION
        </Text>
        <mesh position={[0, 1.18, 0.11]}>
          <coneGeometry args={[0.28, 0.4, 4]} />
          <meshStandardMaterial color="#2b6fb0" />
        </mesh>
      </group>
    </group>
  )
}

/** Rooftop plant and the mast frames visible on the photos. */
function RoofKit() {
  const items: [number, number, number, number][] = [
    [-20, -40, 6, 3], [10, -45, 8, 4], [35, -30, 5, 3], [-50, -30, 4, 4],
  ]
  return (
    <group>
      {items.map(([x, z, w, d]) => (
        <mesh key={`${x},${z}`} position={[x, MAIN_HEIGHT + 1, z]} castShadow>
          <boxGeometry args={[w, 2, d]} />
          <meshStandardMaterial color="#8d8a84" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}
