import { Text } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  ATRIUM_T0, ATRIUM_T1, DIVISION_T, FACADE, FACADE_T_EAST, LEDGE_HEIGHT, MAIN_HEIGHT, MIDDLE_BLOCK, RECESS_DEPTH,
  RECESS_T_EAST, RECESS_T_WEST, RECESS_T_WEST_BACK, WEST_BLOCK, arcPoints, ledgeFootprint, mainFootprint,
} from '../config/site'
import { arcPoint, arcRibbon, arcWall, extrudeFootprint, prism, rng, yawOutward } from '../lib/geo'
import { claddingTexture, glazingTexture, pylonTexture, wingTexture } from '../lib/textures'
import { FONT } from '../config/font'

/** Height of the dark granite base wall with the doors, at the back of the recess. */
const BASE_WALL = 4.6
const PYLON_W = 5
const PYLON_D = 2.5
const CANOPY_BACK = -RECESS_DEPTH
const CANOPY_FRONT = 0.6
const CANOPY_Y_BACK = MAIN_HEIGHT - 3
const CANOPY_Y_FRONT = MAIN_HEIGHT + 0.6
const ATRIUM_MID = (ATRIUM_T0 + ATRIUM_T1) / 2
/** Inner glass face sits just proud of the recess back wall. */
const BACK = -RECESS_DEPTH + 0.1
/** Angle offset for a distance in metres along the facade. */
const along = (m: number) => m / FACADE.r

/**
 * The Kerala Technology Innovation Zone building (home of KSUM), modelled from
 * the site photos: a curved granite mass with broken pale bands and a dark
 * granite plinth; a deep full-height recess glazed at the back, fronted by two
 * tan pylons and roofed by a louvered glass canopy on slim columns; and, past a
 * vertical recess at the west end, two taller angled blocks with framed windows.
 */
export function KtizBuilding() {
  const geo = useMemo(() => ({
    main: extrudeFootprint(mainFootprint(), MAIN_HEIGHT),
    middle: prism(MIDDLE_BLOCK.bottom, MIDDLE_BLOCK.top, MIDDLE_BLOCK.height),
    west: prism(WEST_BLOCK.bottom, WEST_BLOCK.top, WEST_BLOCK.height),
    ledge: extrudeFootprint(ledgeFootprint(), LEDGE_HEIGHT),
    glassWest: arcWall(FACADE, ATRIUM_T1, RECESS_T_WEST_BACK, BACK, LEDGE_HEIGHT, CANOPY_Y_BACK),
    glassMain: arcWall(FACADE, RECESS_T_EAST, ATRIUM_T1, BACK, BASE_WALL, CANOPY_Y_BACK),
    baseWall: arcWall(FACADE, RECESS_T_EAST, ATRIUM_T1, BACK, 0, BASE_WALL),
    plinthEast: arcWall(FACADE, FACADE_T_EAST, ATRIUM_T0, 0.05, 0, 3),
    plinthWest: arcWall(FACADE, ATRIUM_T1, DIVISION_T, 0.05, 0, 3),
    canopyGlass: canopyGeometry(),
  }), [])

  const mats = useMemo(() => ({
    clad: new THREE.MeshStandardMaterial({ map: claddingTexture(), roughness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ color: '#8c8780', roughness: 0.95 }),
    wing: new THREE.MeshStandardMaterial({ map: wingTexture(), roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ map: glazingTexture(), metalness: 0.5, roughness: 0.05, envMapIntensity: 1.8, clearcoat: 1 }),
    darkGranite: new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.55 }),
  }), [])

  return (
    <group>
      {/* geometry groups: 0 = roof and floor caps, 1 = walls */}
      <mesh geometry={geo.main} material={[mats.roof, mats.clad]} castShadow receiveShadow />
      <mesh geometry={geo.middle} material={[mats.roof, mats.wing]} castShadow receiveShadow />
      <mesh geometry={geo.west} material={[mats.roof, mats.wing]} castShadow receiveShadow />
      <mesh geometry={geo.ledge} material={[mats.roof, mats.clad]} castShadow receiveShadow />
      <mesh geometry={geo.plinthEast} material={mats.darkGranite} receiveShadow />
      <mesh geometry={geo.plinthWest} material={mats.darkGranite} receiveShadow />
      <mesh geometry={geo.baseWall} material={mats.darkGranite} receiveShadow />
      <mesh geometry={geo.glassWest} material={mats.glass} />
      <mesh geometry={geo.glassMain} material={mats.glass} />
      <ReturnWall />
      <Pylon theta={ATRIUM_T1 - along(PYLON_W / 2)} inner={1} />
      <Pylon theta={ATRIUM_T0 + along(PYLON_W / 2)} inner={-1} signs />
      <Canopy />
      <mesh geometry={geo.canopyGlass}>
        <meshStandardMaterial color="#cfe0ea" transparent opacity={0.3} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Entrance />
      <RoofLetters />
    </group>
  )
}

/**
 * Tan granite pylon standing in the mouth of the recess, with a slim dark
 * canopy column in front of its inner edge and floodlights on its inner face.
 * `inner` is +1 when the inner (glazing) side is local +x, which points east.
 * The east pylon carries the FabLab, Future Technologies and Maker Village signs.
 */
function Pylon({ theta, inner, signs = false }: { theta: number; inner: 1 | -1; signs?: boolean }) {
  const [x, z] = arcPoint(FACADE, theta, 0.5 - PYLON_D / 2)
  const h = MAIN_HEIGHT - 0.6
  const front = PYLON_D / 2
  // box UVs run 0..1 per face, so size the granite tile to the front face
  const granite = useMemo(() => {
    const t = pylonTexture().clone()
    t.repeat.set(PYLON_W / 3, h / 3)
    t.needsUpdate = true
    return t
  }, [h])
  return (
    <group position={[x, 0, z]} rotation={[0, yawOutward(theta), 0]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[PYLON_W, h, PYLON_D]} />
        <meshStandardMaterial map={granite} roughness={0.8} />
      </mesh>
      {/* pale bands: one above the signs, one between the first two (as in the photo) */}
      {[8.2, 6.6].map((y) => (
        <mesh key={y} position={[0, y, front + 0.01]}>
          <boxGeometry args={[PYLON_W + 0.02, 0.28, 0.03]} />
          <meshStandardMaterial color="#b4b5b2" roughness={0.6} />
        </mesh>
      ))}
      {/* canopy column */}
      <mesh position={[inner * (PYLON_W / 2 - 0.5), CANOPY_Y_FRONT / 2, front + 0.4]} castShadow>
        <boxGeometry args={[0.5, CANOPY_Y_FRONT, 0.5]} />
        <meshStandardMaterial color="#3f3d3a" roughness={0.6} metalness={0.3} />
      </mesh>
      {[15, 9].map((y) => (
        <mesh key={y} position={[inner * (PYLON_W / 2 + 0.15), y, 0]}>
          <sphereGeometry args={[0.25, 12, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fff7e0" emissiveIntensity={3} />
        </mesh>
      ))}
      {signs && (
        <group position={[0, 0, front + 0.02]}>
          <Sign y={7.3} color="#e2582b" accent="#2e9e4f" text="FABLAB KERALA" />
          <Sign y={5.8} color="#2a63c9" accent="#2a63c9" text="FUTURE Technologies" />
          <Sign y={4.6} color="#2e9e4f" accent="#2e7d3f" text="Maker Village" />
        </group>
      )}
    </group>
  )
}

function Sign({ y, color, accent, text }: { y: number; color: string; accent: string; text: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[-1.25, 0, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.05]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <Text font={FONT} position={[0.35, 0, 0.04]} fontSize={0.34} color={color} anchorX="center" anchorY="middle" maxWidth={2.6} textAlign="center">
        {text}
      </Text>
    </group>
  )
}

/** Tan granite face of the splayed west return wall of the recess, lit by two floodlights. */
function ReturnWall() {
  const { pos, yaw, len } = useMemo(() => {
    const [ax, az] = arcPoint(FACADE, RECESS_T_WEST, 0)
    const [bx, bz] = arcPoint(FACADE, RECESS_T_WEST_BACK, -RECESS_DEPTH)
    // face the wall's normal toward the recess (east and outward)
    const dx = bx - ax
    const dz = bz - az
    return { pos: [(ax + bx) / 2, 0, (az + bz) / 2] as const, yaw: Math.atan2(-dz, dx), len: Math.hypot(dx, dz) }
  }, [])
  const h = MAIN_HEIGHT - LEDGE_HEIGHT
  return (
    <group position={[pos[0], 0, pos[2]]} rotation={[0, yaw, 0]}>
      <mesh position={[0, LEDGE_HEIGHT + h / 2, 0.06]} receiveShadow>
        <boxGeometry args={[len, h, 0.1]} />
        <meshStandardMaterial color="#9c8768" roughness={0.85} />
      </mesh>
      {[[-0.25, 16], [0.2, 12]].map(([u, y]) => (
        <mesh key={y} position={[u * len, y, 0.35]}>
          <sphereGeometry args={[0.25, 12, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fff7e0" emissiveIntensity={3} />
        </mesh>
      ))}
    </group>
  )
}

/** Height of the canopy at a radial offset: it rises from the glazing to the roof edge. */
const canopyY = (off: number) =>
  CANOPY_Y_BACK + ((off - CANOPY_BACK) / (CANOPY_FRONT - CANOPY_BACK)) * (CANOPY_Y_FRONT - CANOPY_Y_BACK)

/**
 * Louvered canopy over the whole recess: radial beams from the top of the back
 * glazing up to a curved edge beam that continues the roofline, with thin
 * purlins across them.
 */
function Canopy() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const span = Math.abs(RECESS_T_WEST - RECESS_T_EAST) * FACADE.r
  const count = Math.floor(span / 1.6) + 1
  const run = CANOPY_FRONT - CANOPY_BACK
  const rise = CANOPY_Y_FRONT - CANOPY_Y_BACK
  const len = Math.hypot(run, rise)
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const mid = (CANOPY_BACK + CANOPY_FRONT) / 2
    for (let i = 0; i < count; i++) {
      const t = RECESS_T_EAST + ((RECESS_T_WEST - RECESS_T_EAST) * i) / (count - 1)
      const [x, z] = arcPoint(FACADE, t, mid)
      o.position.set(x, canopyY(mid), z)
      o.rotation.set(0, yawOutward(t), 0)
      o.rotateX(-Math.atan2(rise, run))
      o.updateMatrix()
      ref.current!.setMatrixAt(i, o.matrix)
    }
    ref.current!.instanceMatrix.needsUpdate = true
  }, [count, len, rise, run])
  const strips = useMemo(() => {
    const edge = arcWall(FACADE, RECESS_T_EAST - 0.005, RECESS_T_WEST + 0.005, CANOPY_FRONT, CANOPY_Y_FRONT - 0.5, CANOPY_Y_FRONT + 0.4)
    const purlins = [-7, -5, -3, -1].map((off) =>
      arcWall(FACADE, RECESS_T_EAST, RECESS_T_WEST, off, canopyY(off) + 0.15, canopyY(off) + 0.3))
    return { edge, purlins }
  }, [])
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
        <boxGeometry args={[0.3, 0.6, len]} />
        <meshStandardMaterial color="#5b5853" roughness={0.6} metalness={0.3} />
      </instancedMesh>
      <mesh geometry={strips.edge}>
        <meshStandardMaterial color="#6f6b64" roughness={0.6} metalness={0.3} side={THREE.DoubleSide} />
      </mesh>
      {strips.purlins.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#3f3d3a" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/** Sloped glass sheet under the canopy beams. */
function canopyGeometry() {
  const n = 32
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = RECESS_T_EAST + ((RECESS_T_WEST - RECESS_T_EAST) * i) / n
    const [ax, az] = arcPoint(FACADE, t, CANOPY_BACK)
    const [bx, bz] = arcPoint(FACADE, t, CANOPY_FRONT)
    pos.push(ax, CANOPY_Y_BACK + 0.3, az, bx, CANOPY_Y_FRONT + 0.3, bz)
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const STEP_COUNT = 7
const STEP_RISE = 0.17
const STEP_TREAD = 0.45
const STEP_WIDTH = 13
const STEPS_T = ATRIUM_MID + along(1.5)
const PLANTER_STEPS = [1, 3, 5]

/**
 * The entrance as in the photo: wide black granite steps with variegated
 * spider plants planted along them, up to a floor that runs back into the
 * recess, where the Kerala Startup Mission board sits on the dark base wall
 * between two lit doorways; a stone walkway and a flagpole to the east.
 */
function Entrance() {
  const yaw = yawOutward(STEPS_T)
  const front = 0.3 + STEP_COUNT * STEP_TREAD
  const walkway = useMemo(
    () => arcRibbon(FACADE, STEPS_T - along(STEP_WIDTH / 2 + 3), STEPS_T - along(STEP_WIDTH / 2 + 0.6), 0.2, 9.5, 0.09),
    [],
  )
  const [fx, fz] = arcPoint(FACADE, STEPS_T - along(STEP_WIDTH / 2 + 4.5), 3)
  const floorY = STEP_COUNT * STEP_RISE
  const floor = useMemo(() => {
    const t0 = ATRIUM_T0 + along(PYLON_W)
    const t1 = ATRIUM_T1 - along(PYLON_W)
    return extrudeFootprint([...arcPoints(t0, t1, 0.3, 12), ...arcPoints(t1, t0, -RECESS_DEPTH, 12)], floorY)
  }, [floorY])
  return (
    <group>
      <mesh geometry={floor} receiveShadow>
        <meshStandardMaterial color="#1d1e20" roughness={0.3} />
      </mesh>
      {[ATRIUM_T0 + along(PYLON_W + 2.2), ATRIUM_T1 - along(PYLON_W + 2.2)].map((t) => {
        const [x, z] = arcPoint(FACADE, t, BACK + 0.05)
        return (
          <mesh key={t} position={[x, floorY + 1.6, z]} rotation={[0, yawOutward(t), 0]}>
            <planeGeometry args={[3.2, 3.2]} />
            <meshStandardMaterial color="#e8dccb" emissive="#f3e2c4" emissiveIntensity={0.6} />
          </mesh>
        )
      })}
      {Array.from({ length: STEP_COUNT }, (_, i) => {
        // each step is a solid block from its nosing back to the building
        const nose = front - i * STEP_TREAD
        const [x, z] = arcPoint(FACADE, STEPS_T, (nose + 0.3) / 2)
        const top = (i + 1) * STEP_RISE
        return (
          <mesh key={i} position={[x, top / 2, z]} rotation={[0, yaw, 0]} receiveShadow castShadow>
            <boxGeometry args={[STEP_WIDTH, top, nose - 0.3]} />
            <meshStandardMaterial color="#1d1e20" roughness={0.3} />
          </mesh>
        )
      })}
      <SpiderPlants />
      <StartupMissionBoard />
      <mesh geometry={walkway} receiveShadow>
        <meshStandardMaterial color="#8e8d89" roughness={0.6} />
      </mesh>
      <group position={[fx, 0, fz]}>
        <mesh position={[0, 4.5, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 9, 8]} />
          <meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.45, 0.5, 0.2, 16]} />
          <meshStandardMaterial color="#d8d6d0" roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

/** Clumps of variegated spider plants on alternate steps. */
function SpiderPlants() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const perRow = 9
  const blades = 9
  const count = PLANTER_STEPS.length * perRow * blades
  useLayoutEffect(() => {
    const rnd = rng(5)
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const front = 0.3 + STEP_COUNT * STEP_TREAD
    let n = 0
    for (const s of PLANTER_STEPS) {
      const off = front - s * STEP_TREAD - STEP_TREAD / 2
      for (let k = 0; k < perRow; k++) {
        const t = STEPS_T + along((k / (perRow - 1) - 0.5) * (STEP_WIDTH - 1.5) + (rnd() - 0.5) * 0.6)
        const [x, z] = arcPoint(FACADE, t, off)
        for (let b = 0; b < blades; b++) {
          o.position.set(x, (s + 1) * STEP_RISE + 0.25, z)
          o.rotation.set((rnd() - 0.5) * 1.6, rnd() * Math.PI * 2, (rnd() - 0.5) * 1.6)
          o.scale.setScalar(0.7 + rnd() * 0.6)
          o.updateMatrix()
          ref.current!.setMatrixAt(n, o.matrix)
          ref.current!.setColorAt(n, c.set(rnd() < 0.5 ? '#c9d47c' : '#6f8f3c'))
          n++
        }
      }
    }
    ref.current!.instanceMatrix.needsUpdate = true
    ref.current!.instanceColor!.needsUpdate = true
  }, [count])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow>
      <coneGeometry args={[0.04, 0.6, 3]} />
      <meshStandardMaterial roughness={0.7} />
    </instancedMesh>
  )
}

/** The white board with the stacked-cube logo, centred on the base wall at the back of the recess. */
function StartupMissionBoard() {
  const t = ATRIUM_MID
  const [x, z] = arcPoint(FACADE, t, BACK + 0.15)
  const cubes: [number, number][] = [[0, 0.9], [-0.22, 0.68], [0.22, 0.68], [-0.44, 0.46], [0, 0.46], [0.44, 0.46]]
  return (
    <group position={[x, STEP_COUNT * STEP_RISE + 1.7, z]} rotation={[0, yawOutward(t), 0]}>
      <mesh castShadow>
        <boxGeometry args={[4.2, 2.1, 0.18]} />
        <meshStandardMaterial color="#f5f5f3" roughness={0.35} />
      </mesh>
      {cubes.map(([cx, cy]) => (
        <mesh key={`${cx},${cy}`} position={[cx, cy - 0.35, 0.12]}>
          <boxGeometry args={[0.2, 0.2, 0.06]} />
          <meshStandardMaterial color="#3a7bc8" />
        </mesh>
      ))}
      <Text font={FONT} position={[0, -0.32, 0.1]} fontSize={0.15} color="#2e9e4f" anchorX="center" anchorY="middle" letterSpacing={0.4}>
        KERALA
      </Text>
      <Text font={FONT} position={[0, -0.62, 0.1]} fontSize={0.3} color="#1d2b36" anchorX="center" anchorY="middle">
        STARTUP MISSION
      </Text>
    </group>
  )
}

/** Letters on the roof edge of the curved mass near the west end. */
function RoofLetters() {
  // on the solid stretch just west of the recess, set back from the edge
  const t = DIVISION_T
  const [x, z] = arcPoint(FACADE, t, -2.5)
  return (
    <group position={[x, MAIN_HEIGHT + 1.1, z]} rotation={[0, yawOutward(t), 0]}>
      <Text font={FONT} fontSize={1.6} color="#e9e9e6" anchorX="center" anchorY="middle" letterSpacing={0.2}>
        ISC
      </Text>
      <mesh position={[0, -0.9, -0.1]}>
        <boxGeometry args={[3.6, 0.12, 0.12]} />
        <meshStandardMaterial color="#8d8a84" />
      </mesh>
    </group>
  )
}
