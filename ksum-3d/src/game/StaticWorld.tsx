/*
 * The solid parts of the site for physics: the ground, every building as
 * walls extruded from the same footprints the scene draws, the two towers as
 * boxes, and the cars that stay parked on the surface bays.
 */
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useMemo } from 'react'
import {
  FACADE, KEPT_BAYS, LEDGE_HEIGHT, MAIN_HEIGHT, MIDDLE_BLOCK, STRIP, TOWER_FALLBACK, WEST_BLOCK, bayTheta, ledgeFootprint, mainFootprint,
} from '../config/site'
import { arcPoint, yawInward, type XZ } from '../lib/geo'
import { Car } from '../scene/Car'
import { drawnBuildings } from '../scene/drawnBuildings'
import type { CarKind } from '../scene/carModels'
import { useSceneStore } from '../store/useSceneStore'
import { towerPlaces } from './layout'

/** One trimesh of vertical walls (no roofs: nothing here can climb that high). */
function wallMesh(polys: { pts: readonly XZ[]; h: number }[]) {
  const v: number[] = []
  const idx: number[] = []
  for (const { pts, h } of polys) {
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[(i + 1) % pts.length]
      const n = v.length / 3
      v.push(ax, 0, az, bx, 0, bz, bx, h, bz, ax, h, az)
      idx.push(n, n + 1, n + 2, n, n + 2, n + 3)
    }
  }
  return [new Float32Array(v), new Uint32Array(idx)] as [Float32Array, Uint32Array]
}

const COLORS = ['#f2f2f0', '#1b1c1f', '#a9adb2', '#2a3f6a', '#6b6e73', '#7a1e22']
/** Car half extents for the parked cars' boxes. */
const HALF = { w: 0.95, h: 0.75, l: 2.35 }

export function StaticWorld() {
  const size = useSceneStore((s) => s.towerSize) ?? TOWER_FALLBACK
  const walls = useMemo(() => wallMesh([
    { pts: mainFootprint(), h: MAIN_HEIGHT },
    { pts: MIDDLE_BLOCK.bottom, h: MIDDLE_BLOCK.height },
    { pts: WEST_BLOCK.bottom, h: WEST_BLOCK.height },
    { pts: ledgeFootprint(), h: LEDGE_HEIGHT },
    // exactly the buildings the scene draws, so nothing invisible stops you
    ...drawnBuildings().map((b) => ({ pts: b.pts, h: Math.max(4, b.h) })),
  ]), [])
  const towers = towerPlaces(size)
  const parked = useMemo(() => KEPT_BAYS.map((bay, i) => {
    const t = bayTheta(bay)
    const [x, z] = arcPoint(FACADE, t, (STRIP[0] + STRIP[1]) / 2)
    return { bay, x, z, yaw: yawInward(t), kind: (i % 2 ? 'atto' : 'seal') as CarKind, color: COLORS[i % COLORS.length] }
  }), [])

  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1500, 0.5, 1500]} position={[0, -0.5, 0]} friction={1} />
        <TrimeshCollider args={walls} />
        {towers.map((t) => (
          <CuboidCollider key={t.k} args={[size.w / 2, size.h / 2, size.d / 2]}
            position={[t.x + Math.sin(t.yaw) * (size.front - size.d / 2), size.h / 2, t.z + Math.cos(t.yaw) * (size.front - size.d / 2)]}
            rotation={[0, t.yaw, 0]} />
        ))}
      </RigidBody>
      {parked.map((c) => (
        <RigidBody key={c.bay} type="fixed" colliders={false} position={[c.x, 0.08, c.z]} rotation={[0, c.yaw, 0]}>
          <CuboidCollider args={[HALF.w, HALF.h, HALF.l]} position={[0, HALF.h, 0]} />
          <Car kind={c.kind} color={c.color} />
        </RigidBody>
      ))}
    </>
  )
}
