/*
 * Solar and grid flows on the 3D twin: panels on both tower roofs, a grid
 * transformer west of the strip, and moving dashes from each source to each
 * tower's charging bus above its door. Dash thickness and speed follow the
 * live kW from the control store. When the grid connection is cut back (the
 * power cut scenario) the grid lines turn red and break into sparse dashes.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FACADE, STRIP, STRIP_T_WEST, TOWER_FALLBACK, towerTheta } from '../config/site'
import { siteEnergy, useControlStore } from '../control/useControlStore'
import { arcPoint, yawOutward } from '../lib/geo'
import { useSceneStore } from '../store/useSceneStore'

/** Orange rather than yellow, so the solar lines stand out against the towers' yellow frame. */
const SOLAR = '#ff7a1a'
const GRID = '#2f7fd6'
const CUT = '#d6402f'
/** Busway height on the door face, above the cars driving in. */
const BUS_Y = 3.4
/** Radial offset of the busway, just proud of the door face. */
const LINE_OFF = STRIP[1] + 0.2
/** Dash and gap lengths in metres: near solid when flowing, sparse when the grid is cut. */
const DASH = { solid: [1.4, 0.45], cut: [0.45, 1.5] } as const

const UP = new THREE.Vector3(0, 1, 0)
const DASH_GEO = new THREE.CylinderGeometry(1, 1, 1, 8)

/** World point on the arc at a radial offset, `along` metres east of `theta`. */
function at(theta: number, offset: number, y: number, along = 0) {
  const [x, z] = arcPoint(FACADE, theta - along / (FACADE.r + offset), offset)
  return new THREE.Vector3(x, y, z)
}

const radiusFor = (kw: number) => (kw > 0 ? Math.min(0.45, 0.12 + 0.06 * Math.sqrt(kw)) : 0.06)
/** Metres per second along the line. */
const speedFor = (kw: number) => (kw > 0 ? Math.min(7, 0.6 + 0.12 * kw) : 0)

interface FlowProps { points: THREE.Vector3[]; kw: number; color: string; dash: readonly [number, number]; active: boolean }

/** A polyline drawn as a faint guide tube with dashes running along it. */
function Flow({ points, kw, color, dash, active }: FlowProps) {
  const curve = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>()
    for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(points[i - 1], points[i]))
    return path
  }, [points])
  const guide = useMemo(() => new THREE.TubeGeometry(curve, points.length * 12, 0.05, 6, false), [curve, points.length])
  useEffect(() => () => guide.dispose(), [guide])

  const length = curve.getLength()
  const [len, gap] = dash
  const pitch = len + gap
  const count = Math.max(1, Math.ceil(length / pitch))
  const radius = radiusFor(kw)
  const speed = speedFor(kw)

  const ref = useRef<THREE.InstancedMesh>(null)
  const offset = useRef(0)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), t: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), [])
  useFrame((_, dt) => {
    const mesh = ref.current
    if (!mesh || !active) return // hidden in Today mode: skip the per-dash work
    offset.current = (offset.current + Math.min(dt, 0.05) * speed) % pitch
    const { m, p, t, q, s } = tmp
    for (let i = 0; i <= count; i++) {
      const start = i * pitch + offset.current - pitch
      const a = Math.max(0, start)
      const b = Math.min(length, start + len)
      if (b <= a) {
        mesh.setMatrixAt(i, m.makeScale(0, 0, 0))
        continue
      }
      const u = (a + b) / 2 / length
      curve.getPointAt(u, p)
      curve.getTangentAt(u, t)
      q.setFromUnitVectors(UP, t.normalize())
      mesh.setMatrixAt(i, m.compose(p, q, s.set(radius, b - a, radius)))
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={guide}>
        <meshBasicMaterial color={color} transparent opacity={0.3} toneMapped={false} />
      </mesh>
      {/* one extra dash so one is always entering as another leaves */}
      <instancedMesh key={count} ref={ref} args={[DASH_GEO, undefined, count + 1]} frustumCulled={false}>
        <meshBasicMaterial color={color} transparent opacity={kw > 0 ? 1 : 0.35} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** Two rows of four panels on short legs, tilted a little toward the road. */
function SolarRoof({ position, yaw }: { position: THREE.Vector3; yaw: number }) {
  const panels = useMemo(() => {
    const out: [number, number][] = []
    for (const z of [-1.05, 1.05]) for (const x of [-1.6, -0.53, 0.53, 1.6]) out.push([x, z])
    return out
  }, [])
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* mounting frame */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[4.4, 0.08, 4.4]} />
        <meshStandardMaterial color="#b9bdc2" metalness={0.6} roughness={0.4} />
      </mesh>
      {panels.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.32, z]} rotation={[0.17, 0, 0]}>
          <boxGeometry args={[1.0, 0.05, 1.95]} />
          <meshStandardMaterial color="#1d3058" metalness={0.35} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

/** Pad-mounted transformer where the site meets the KSEB feed. */
function Transformer({ position, yaw }: { position: THREE.Vector3; yaw: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.2, 0.2, 1.8]} />
        <meshStandardMaterial color="#9a9993" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[1.8, 1.5, 1.4]} />
        <meshStandardMaterial color="#5f7a62" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* cable riser up to the busway */}
      <mesh position={[0, (1.7 + BUS_Y) / 2, 0]}>
        <boxGeometry args={[0.18, BUS_Y - 1.7, 0.18]} />
        <meshStandardMaterial color="#6b6e73" />
      </mesh>
    </group>
  )
}

/** Solar and grid flows into both towers. Shown with the towers, in With AutoDock mode. */
export function EnergyFlows() {
  const mode = useSceneStore((s) => s.mode)
  const size = useSceneStore((s) => s.towerSize) ?? TOWER_FALLBACK
  const scenario = useControlStore((s) => s.scenario)
  const towers = useControlStore((s) => s.towers)
  const energy = useMemo(() => siteEnergy(scenario, towers), [scenario, towers])
  const cut = energy.gridLimitKw < energy.normalLimitKw

  const layout = useMemo(() => {
    const half = size.w / 2 - 0.3
    const tx = { theta: STRIP_T_WEST, off: STRIP[1] - 1.4, along: -1.8 }
    const txTop = at(tx.theta, tx.off, BUS_Y, tx.along)
    return ([0, 1] as const).map((k) => {
      const t = towerTheta(k)
      // the solar downlead runs just outside the frame on each tower's outer side
      const outer = (k === 0 ? -1 : 1) * (size.w / 2 + 0.4)
      const roofY = size.h + 0.1
      const y = BUS_Y - k * 0.5 // the two grid lines run one above the other along tower 1's door face
      return {
        k,
        roof: at(t, STRIP[1] - 0.1 - size.front, roofY),
        yaw: yawOutward(t),
        bus: at(t, LINE_OFF, BUS_Y + 0.55),
        solar: [at(t, LINE_OFF, roofY, outer), at(t, LINE_OFF, BUS_Y + 0.75, outer), at(t, LINE_OFF, BUS_Y + 0.75)],
        grid: [at(tx.theta, tx.off, 1.7, tx.along), txTop, at(towerTheta(0), LINE_OFF, y, -half - 0.3), at(t, LINE_OFF, y)],
        tx: { position: at(tx.theta, tx.off, 0.08, tx.along), yaw: yawOutward(tx.theta) },
      }
    })
  }, [size.w, size.h, size.front])

  return (
    <group visible={mode === 'autodock'}>
      <Transformer {...layout[0].tx} />
      {layout.map(({ k, roof, yaw, bus, solar, grid }) => (
        <group key={k}>
          <SolarRoof position={roof} yaw={yaw} />
          {/* charging bus box where both feeds meet, above the door */}
          <mesh position={bus} rotation={[0, yaw, 0]}>
            <boxGeometry args={[0.9, 1.4, 0.3]} />
            <meshStandardMaterial color="#e7e9ec" roughness={0.5} />
          </mesh>
          <Flow points={solar} kw={energy.solarToTower[k]} color={SOLAR} dash={DASH.solid} active={mode === 'autodock'} />
          <Flow points={grid} kw={energy.gridToTower[k]} color={cut ? CUT : GRID} dash={cut ? DASH.cut : DASH.solid} active={mode === 'autodock'} />
        </group>
      ))}
    </group>
  )
}
