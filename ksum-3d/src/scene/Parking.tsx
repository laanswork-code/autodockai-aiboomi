import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import {
  FACADE, KEPT_BAYS, STRIP, STRIP_T_EAST, TODAY_BAYS, TOWERS_T_EAST, TOWER_CAPACITY, TOWER_FALLBACK, bayTheta, towerTheta,
} from '../config/site'
import { arcPoint, yawInward, yawOutward } from '../lib/geo'
import { spaceStats } from '../lib/stats'
import { useControlStore } from '../control/useControlStore'
import { useSceneStore, type Mode } from '../store/useSceneStore'
import { Car } from './Car'
import type { CarKind } from './carModels'
import { RotaryTower, type TowerLoad } from './RotaryTower'

/** What was parked on the strip in the photos: mostly white, black, silver and blue. */
const COLORS = ['#f2f2f0', '#1b1c1f', '#a9adb2', '#f2f2f0', '#2a3f6a', '#6b6e73', '#f2f2f0', '#7a1e22']
const KINDS: CarKind[] = ['atto', 'seal']
const fleet = TODAY_BAYS.map((bay, i) => ({ bay, kind: KINDS[i % 2], color: COLORS[i % COLORS.length] }))
type Parked = (typeof fleet)[number]
/** With AutoDock the cars east of the towers stay where they are. */
const keptFleet = fleet.filter(({ bay }) => KEPT_BAYS.includes(bay))

/** Tower loads, 7 + 6 cars, leaving empty pallets to show spare capacity. */
const towerLoads: [(TowerLoad | null)[], (TowerLoad | null)[]] = [[], []]
for (let p = 0; p < TOWER_CAPACITY; p++) {
  for (const k of [0, 1] as const) {
    const idx = k === 0 ? p : 7 + p
    const take = k === 0 ? p < 7 : p < fleet.length - 7
    towerLoads[k].push(take ? { kind: fleet[idx].kind, color: fleet[idx].color } : null)
  }
}

/** Today: cars nose-in on the paver strip. */
function TodayCars({ mode }: { mode: Mode }) {
  const [lx, lz] = arcPoint(FACADE, bayTheta(7), STRIP[1])
  return (
    <group>
      {mode === 'today' && (
        <Html position={[lx, 3.2, lz]} center zIndexRange={[10, 0]}>
          <div className="tag">Surface parking today · {fleet.length} cars on {Math.round(spaceStats().today.area)} m²</div>
        </Html>
      )}
      <SurfaceCars cars={fleet} />
    </group>
  )
}

/** Cars nose-in on their bays of the paver strip. */
function SurfaceCars({ cars }: { cars: Parked[] }) {
  return (
    <>
      {cars.map(({ bay, kind, color }) => {
        const t = bayTheta(bay)
        const [x, z] = arcPoint(FACADE, t, (STRIP[0] + STRIP[1]) / 2)
        return <Car key={bay} kind={kind} color={color} position={[x, 0.08, z]} rotation={[0, yawInward(t), 0]} />
      })}
    </>
  )
}

/** With AutoDock: two rotary towers on the four west bays, doors on the road, cars still parked on the rest. */
function Towers({ mode }: { mode: Mode }) {
  const size = useSceneStore((s) => s.towerSize) ?? TOWER_FALLBACK
  // each tower centred on its two bays, door face at the strip's road edge
  const placed = ([0, 1] as const).map((k) => {
    const t = towerTheta(k)
    const [x, z] = arcPoint(FACADE, t, STRIP[1] - 0.1 - size.front)
    return { k, t, x, z }
  })
  const stats = spaceStats()
  const [lx, lz] = arcPoint(FACADE, (STRIP_T_EAST + TOWERS_T_EAST) / 2, (STRIP[0] + STRIP[1]) / 2)
  // While a control-room scenario runs, the towers turn to its decisions and carry its docked cars.
  const controlled = useControlStore((s) => s.scenario !== null)
  const door = useControlStore((s) => s.door)
  const docked = useControlStore((s) => s.cars)
  const loads = useMemo(
    () => towerLoads.map((base, k) => (Object.keys(docked[k]).length ? base.map((b, p) => docked[k][p] ?? b) : base)),
    [docked],
  )
  return (
    <group>
      {placed.map(({ k, t, x, z }) => (
        <RotaryTower key={k} load={loads[k]} reportSize={k === 0} controlled={controlled} doorPallet={door[k]}
          position={[x, 0.08, z]} rotation={[0, yawOutward(t), 0]} />
      ))}
      <SurfaceCars cars={keptFleet} />
      {/* Html ignores the parent's visibility, so labels mount only in this mode */}
      {mode === 'autodock' && (
        <>
          <Html position={[lx, 3.2, lz]} center zIndexRange={[10, 0]}>
            <div className="tag">Surface parking kept · {stats.keptBays} bays</div>
          </Html>
          <Html position={[placed[0].x, size.h + 2, placed[0].z]} center zIndexRange={[10, 0]}>
            <div className="tag tag--tower">2 AutoDock towers · room for {stats.autodock.cars} cars</div>
          </Html>
        </>
      )}
    </group>
  )
}

export function Parking() {
  const mode = useSceneStore((s) => s.mode)
  return (
    <group>
      <group visible={mode === 'today'}>
        <TodayCars mode={mode} />
      </group>
      <group visible={mode === 'autodock'}>
        <Towers mode={mode} />
      </group>
    </group>
  )
}
