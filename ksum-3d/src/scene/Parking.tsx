import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import {
  FACADE, STRIP, STRIP_T_EAST, TODAY_BAYS, TOWER_CAPACITY, TOWER_FALLBACK, bayTheta, towerTheta,
} from '../config/site'
import { arcPoint, arcRibbon, yawInward, yawOutward } from '../lib/geo'
import { spaceStats } from '../lib/stats'
import { useSceneStore, type Mode } from '../store/useSceneStore'
import { Car } from './Car'
import type { CarKind } from './carModels'
import { RotaryTower, type TowerLoad } from './RotaryTower'

/** What was parked on the strip in the photos: mostly white, black, silver and blue. */
const COLORS = ['#f2f2f0', '#1b1c1f', '#a9adb2', '#f2f2f0', '#2a3f6a', '#6b6e73', '#f2f2f0', '#7a1e22']
const KINDS: CarKind[] = ['atto', 'seal']
const fleet = TODAY_BAYS.map((bay, i) => ({ bay, kind: KINDS[i % 2], color: COLORS[i % COLORS.length] }))

/** The same cars, moved into the towers (7 + 6), leaving empty pallets to show spare capacity. */
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
          <div className="tag">Surface parking today · {fleet.length} cars on {Math.round(spaceStats(null).today.area)} m²</div>
        </Html>
      )}
      {fleet.map(({ bay, kind, color }) => {
        const t = bayTheta(bay)
        const [x, z] = arcPoint(FACADE, t, (STRIP[0] + STRIP[1]) / 2)
        return <Car key={bay} kind={kind} color={color} position={[x, 0.08, z]} rotation={[0, yawInward(t), 0]} />
      })}
    </group>
  )
}

/** With AutoDock: two rotary towers at the west end, doors on the road, the rest freed. */
function Towers({ mode }: { mode: Mode }) {
  const size = useSceneStore((s) => s.towerSize) ?? TOWER_FALLBACK
  const placed = ([0, 1] as const).map((k) => {
    const t = towerTheta(k, size.w)
    const [x, z] = arcPoint(FACADE, t, STRIP[1] - size.d / 2)
    return { k, t, x, z }
  })
  const freedT0 = towerTheta(1, size.w) - (size.w / 2 + 0.8) / (FACADE.r + 6.75)
  const freed = useMemo(() => arcRibbon(FACADE, STRIP_T_EAST, freedT0, STRIP[0], STRIP[1], 0.1), [freedT0])
  const stats = spaceStats(size)
  const [lx, lz] = arcPoint(FACADE, (STRIP_T_EAST + freedT0) / 2, (STRIP[0] + STRIP[1]) / 2)
  return (
    <group>
      {placed.map(({ k, t, x, z }) => (
        <RotaryTower key={k} load={towerLoads[k]} reportSize={k === 0} position={[x, 0.08, z]} rotation={[0, yawOutward(t), 0]} />
      ))}
      <mesh geometry={freed}>
        <meshStandardMaterial color="#58c27d" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* Html ignores the parent's visibility, so labels mount only in this mode */}
      {mode === 'autodock' && (
        <>
          <Html position={[lx, 1.2, lz]} center zIndexRange={[10, 0]}>
            <div className="tag tag--freed">Freed ground · {Math.round(stats.freed)} m²</div>
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
