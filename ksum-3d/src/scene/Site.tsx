import { Text } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  ATRIUM_T0, BAY_COUNT, FACADE, FACADE_T_EAST, FACADE_T_WEST, LAWN, ROAD, STRIP, STRIP_T_EAST, STRIP_T_WEST, bayTheta,
} from '../config/site'
import { arcPoint, arcRibbon, rng, yawOutward } from '../lib/geo'
import { asphaltTexture, lawnTexture, paverTexture } from '../lib/textures'
import { FONT } from '../config/font'

const ROAD_T0 = FACADE_T_EAST - 0.35
const ROAD_T1 = FACADE_T_WEST + 0.3

/** Ground plane of the KSUM plot: lawn, paver strip, entrance plaza and the curved road. */
export function Site() {
  const geo = useMemo(() => ({
    plot: arcRibbon(FACADE, ROAD_T0, ROAD_T1, -60, ROAD.offset - ROAD.width / 2, 0.03),
    across: arcRibbon(FACADE, ROAD_T0, ROAD_T1, ROAD.offset + ROAD.width / 2, ROAD.offset + 45, 0.03),
    lawn: arcRibbon(FACADE, FACADE_T_EAST, FACADE_T_WEST, LAWN[0], LAWN[1], 0.08),
    strip: arcRibbon(FACADE, STRIP_T_EAST, STRIP_T_WEST, STRIP[0], STRIP[1], 0.07),
    plaza: arcRibbon(FACADE, FACADE_T_EAST + 0.05, STRIP_T_EAST, 0, STRIP[1], 0.075),
    road: arcRibbon(FACADE, ROAD_T0, ROAD_T1, ROAD.offset - ROAD.width / 2, ROAD.offset + ROAD.width / 2, 0.065),
    curb: arcRibbon(FACADE, ROAD_T0, ROAD_T1, ROAD.offset - ROAD.width / 2 - 0.25, ROAD.offset - ROAD.width / 2, 0.12),
  }), [])

  return (
    <group>
      <mesh geometry={geo.plot} receiveShadow>
        <meshStandardMaterial map={lawnTexture()} color="#b9c4a6" roughness={1} />
      </mesh>
      <mesh geometry={geo.across} receiveShadow>
        <meshStandardMaterial map={lawnTexture()} color="#c9cbb0" roughness={1} />
      </mesh>
      <mesh geometry={geo.lawn} receiveShadow>
        <meshStandardMaterial map={lawnTexture()} roughness={1} />
      </mesh>
      <mesh geometry={geo.strip} receiveShadow>
        <meshStandardMaterial map={paverTexture()} roughness={0.95} />
      </mesh>
      <mesh geometry={geo.plaza} receiveShadow>
        <meshStandardMaterial map={paverTexture()} color="#d8d4ce" roughness={0.95} />
      </mesh>
      <mesh geometry={geo.road} receiveShadow>
        <meshStandardMaterial map={asphaltTexture()} roughness={0.92} />
      </mesh>
      <mesh geometry={geo.curb} receiveShadow>
        <meshStandardMaterial color="#b9b6ae" roughness={0.9} />
      </mesh>
      <BayLines />
      <LaneDashes />
      <KsumLetters />
      <Palms />
      <LawnShrubs />
      <LampPosts />
      <Trees />
      <TwoWheelers />
    </group>
  )
}

/** Faded yellow bay separators on the paver strip. */
function BayLines() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const depth = STRIP[1] - STRIP[0]
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    for (let i = 0; i <= BAY_COUNT; i++) {
      const t = bayTheta(i - 0.5)
      const [x, z] = arcPoint(FACADE, t, (STRIP[0] + STRIP[1]) / 2)
      o.position.set(x, 0.09, z)
      o.rotation.set(0, yawOutward(t), 0)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    }
    ref.current!.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, BAY_COUNT + 1]} receiveShadow>
      <boxGeometry args={[0.1, 0.01, depth - 0.4]} />
      <meshStandardMaterial color="#d6b74a" roughness={0.8} />
    </instancedMesh>
  )
}

function LaneDashes() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const len = Math.abs(ROAD_T1 - ROAD_T0) * (FACADE.r + ROAD.offset)
  const count = Math.floor(len / 6)
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const t = ROAD_T0 + ((ROAD_T1 - ROAD_T0) * (i + 0.5)) / count
      const [x, z] = arcPoint(FACADE, t, ROAD.offset)
      o.position.set(x, 0.075, z)
      o.rotation.set(0, yawOutward(t) + Math.PI / 2, 0)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    }
    ref.current!.instanceMatrix.needsUpdate = true
  }, [count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.15, 0.01, 3]} />
      <meshStandardMaterial color="#e9e7df" roughness={0.7} />
    </instancedMesh>
  )
}

/** The free-standing KSUM letters and blue cube logo on the lawn, as in the photos. */
function KsumLetters() {
  const t = bayTheta(10.5)
  const [x, z] = arcPoint(FACADE, t, 2.2)
  const cubes: [number, number, number][] = [[-2.6, 0.4, 0], [-2.2, 0.85, 0.1], [-1.8, 0.4, 0], [-2.2, 0.05 + 0.35, -0.3], [-1.75, 1.25, 0]]
  return (
    <group position={[x, 0, z]} rotation={[0, yawOutward(t), 0]}>
      {cubes.map(([cx, cy, cz]) => (
        <mesh key={`${cx},${cy},${cz}`} position={[cx, cy, cz]} rotation={[0.3, 0.6, 0.2]} castShadow>
          <boxGeometry args={[0.42, 0.42, 0.42]} />
          <meshStandardMaterial color="#3d8fd6" roughness={0.4} />
        </mesh>
      ))}
      <Text font={FONT} position={[0.6, 0.62, 0]} fontSize={1.05} color="#f2f2ef" anchorX="center" anchorY="middle" outlineWidth={0.01} outlineColor="#c8c8c4">
        KSUM
      </Text>
    </group>
  )
}

/** Coconut-style palms on the front lawn. */
function Palms() {
  const spots = useMemo(() => {
    // none in front of the signed east pylon, as in the photos
    const ts = [bayTheta(1.5), bayTheta(6.5), bayTheta(12.5), FACADE_T_EAST + 0.06]
    return ts.map((t, i) => ({ t, p: arcPoint(FACADE, t, 2.4), h: 7 + (i % 3) * 1.2 }))
  }, [])
  return (
    <group>
      {spots.map(({ t, p, h }) => (
        <group key={t} position={[p[0], 0, p[1]]}>
          <mesh position={[0, h / 2, 0]} rotation={[0, 0, 0.05]} castShadow>
            <cylinderGeometry args={[0.16, 0.24, h, 8]} />
            <meshStandardMaterial color="#8a7a63" roughness={0.9} />
          </mesh>
          {Array.from({ length: 10 }, (_, k) => (
            <group key={k} position={[0, h, 0]} rotation={[0, (k / 10) * Math.PI * 2, 0]}>
              {/* frond: arches out, then droops */}
              <mesh position={[0, 0.15, 1.1]} rotation={[-0.35, 0, 0]} castShadow>
                <boxGeometry args={[0.55, 0.04, 2.2]} />
                <meshStandardMaterial color="#456f2f" roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.35, 2.75]} rotation={[0.55, 0, 0]} castShadow>
                <boxGeometry args={[0.45, 0.04, 1.6]} />
                <meshStandardMaterial color="#3b6229" roughness={0.8} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Broadleaf trees along the road (the large tree over the two-wheelers, and others). */
function Trees() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => {
    const rnd = rng(42)
    const out: { x: number; z: number; s: number }[] = []
    for (let i = 0; i < 26; i++) {
      const t = ROAD_T0 + rnd() * (ROAD_T1 - ROAD_T0)
      const off = ROAD.offset + ROAD.width / 2 + 3 + rnd() * 10
      const [x, z] = arcPoint(FACADE, t, off)
      out.push({ x, z, s: 2.6 + rnd() * 2.4 })
    }
    return out
  }, [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    spots.forEach(({ x, z, s }, i) => {
      o.position.set(x, 3 + s * 0.9, z)
      o.scale.set(s, s * 0.8, s)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
      o.position.set(x, 1.7, z)
      o.scale.set(1, 1, 1)
      o.updateMatrix()
      trunks.current!.setMatrixAt(i, o.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    trunks.current!.instanceMatrix.needsUpdate = true
  }, [spots])
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#3d5f2e" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, spots.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 3.4, 6]} />
        <meshStandardMaterial color="#5b4a3a" roughness={0.9} />
      </instancedMesh>
    </group>
  )
}

/** Row of parked scooters and motorbikes across the road, east of the entrance. */
function TwoWheelers() {
  const body = useRef<THREE.InstancedMesh>(null)
  const count = 14
  useLayoutEffect(() => {
    const rnd = rng(7)
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const colors = ['#1d1f22', '#8c1d1d', '#d9d9d6', '#2a3f6a', '#5a5d61']
    for (let i = 0; i < count; i++) {
      const t = ATRIUM_T0 - (6 + i * 1.0) / (FACADE.r + 20)
      const [x, z] = arcPoint(FACADE, t, ROAD.offset + ROAD.width / 2 + 1.3)
      o.position.set(x, 0.55, z)
      o.rotation.set(0, yawOutward(t) + (rnd() - 0.5) * 0.3, 0.08)
      o.updateMatrix()
      body.current!.setMatrixAt(i, o.matrix)
      body.current!.setColorAt(i, c.set(colors[Math.floor(rnd() * colors.length)]))
    }
    body.current!.instanceMatrix.needsUpdate = true
    body.current!.instanceColor!.needsUpdate = true
  }, [])
  return (
    <instancedMesh ref={body} args={[undefined, undefined, count]} castShadow>
      <boxGeometry args={[0.35, 1.0, 1.8]} />
      <meshStandardMaterial roughness={0.5} />
    </instancedMesh>
  )
}

/** Frangipani bushes on the front lawn, as in the photos. */
function LawnShrubs() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const spots = useMemo(() => {
    const rnd = rng(11)
    return [bayTheta(0.5), bayTheta(4), bayTheta(8.5), bayTheta(13), bayTheta(14.5)].map((t) => ({
      p: arcPoint(FACADE, t + (rnd() - 0.5) * 0.01, 2.2), s: 1.1 + rnd() * 0.5,
    }))
  }, [])
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    spots.forEach(({ p, s }, i) => {
      o.position.set(p[0], s * 0.8, p[1])
      o.scale.set(s * 1.3, s, s * 1.3)
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [spots])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#48683a" roughness={0.9} flatShading />
    </instancedMesh>
  )
}

/** Tall slim lamp posts along the lawn. */
function LampPosts() {
  const ts = [bayTheta(2.5), bayTheta(7.5), bayTheta(12), ATRIUM_T0 - 0.02]
  return (
    <group>
      {ts.map((t) => {
        const [x, z] = arcPoint(FACADE, t, 3.6)
        return (
          <group key={t} position={[x, 0, z]}>
            <mesh position={[0, 3, 0]} castShadow>
              <cylinderGeometry args={[0.05, 0.07, 6, 8]} />
              <meshStandardMaterial color="#2b2d30" roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[0, 6.05, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.1, 16]} />
              <meshStandardMaterial color="#2b2d30" emissive="#fff3d6" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

