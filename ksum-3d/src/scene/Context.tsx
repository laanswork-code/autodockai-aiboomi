import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { site } from '../data/site'
import { BOARD } from '../config/site'
import { clipPolyline, extrudeFootprint, inRect, polylineRibbon, toShape, type XZ } from '../lib/geo'

/** OSM road that runs along the KTIZ facade; replaced by the curved road in Site. */
const FRONT_ROAD_ID = 209966289

const centroid = (pts: XZ[]): XZ => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
]

/** Everything around the KSUM building, in an architectural-model style. */
export function Context() {
  const { buildings, roads, water } = useMemo(() => {
    const b = site.buildings
      .filter((x) => inRect(BOARD, centroid(x.pts)))
      .map((x) => extrudeFootprint(x.pts, x.h))
    const r = site.roads
      .filter((x) => x.id !== FRONT_ROAD_ID)
      .flatMap((x) => clipPolyline(x.pts, BOARD).map((p) => polylineRibbon(p, x.w, 0.06)))
    const w = site.water.map((x) => {
      const g = new THREE.ShapeGeometry(toShape(x.pts))
      g.rotateX(-Math.PI / 2)
      g.translate(0, 0.05, 0)
      return g
    })
    return {
      buildings: mergeGeometries(b),
      roads: mergeGeometries(r),
      water: w.length ? mergeGeometries(w) : null,
    }
  }, [])

  const bw = BOARD.x1 - BOARD.x0
  const bd = BOARD.z1 - BOARD.z0
  return (
    <group>
      {/* the board itself, with a visible edge like a site model */}
      <mesh position={[(BOARD.x0 + BOARD.x1) / 2, -1.5, (BOARD.z0 + BOARD.z1) / 2]} receiveShadow>
        <boxGeometry args={[bw, 3, bd]} />
        <meshStandardMaterial color="#efece6" roughness={0.95} />
      </mesh>
      <mesh geometry={buildings} castShadow receiveShadow>
        <meshStandardMaterial color="#ead7ab" roughness={0.85} />
      </mesh>
      <mesh geometry={roads} receiveShadow>
        <meshStandardMaterial color="#9a9ca0" roughness={0.9} />
      </mesh>
      {water && (
        <mesh geometry={water}>
          <meshStandardMaterial color="#8cc4e8" roughness={0.3} />
        </mesh>
      )}
    </group>
  )
}
