import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BOARD } from '../config/site'
import { site } from '../data/site'
import { clipPolyline, polylineRibbon, toShape } from '../lib/geo'
import { asphaltTexture, lawnTexture } from '../lib/textures'
import { CityBuildings } from './CityBuildings'
import { Greenery } from './Greenery'

/** OSM road that runs along the KTIZ facade; replaced by the curved road in Site. */
const FRONT_ROAD_ID = 209966289
/** Ground runs well past the mapped area and fades into the haze. */
const GROUND = 3000

/** Everything around the KSUM building: ground, roads, water, buildings and trees. */
export function Context() {
  const { ground, roads, water } = useMemo(() => {
    const g = new THREE.PlaneGeometry(GROUND, GROUND)
    g.rotateX(-Math.PI / 2)
    // UVs in metres so the lawn texture tiles at its real size
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * GROUND, uv.getY(i) * GROUND)
    const r = site.roads
      .filter((x) => x.id !== FRONT_ROAD_ID)
      .flatMap((x) => clipPolyline(x.pts, BOARD).map((p) => polylineRibbon(p, x.w, 0.06)))
    const w = site.water.map((x) => {
      const s = new THREE.ShapeGeometry(toShape(x.pts))
      s.rotateX(-Math.PI / 2)
      s.translate(0, 0.05, 0)
      return s
    })
    return { ground: g, roads: mergeGeometries(r), water: w.length ? mergeGeometries(w) : null }
  }, [])

  return (
    <group>
      <mesh geometry={ground} position={[0, -0.02, 0]} receiveShadow>
        <meshStandardMaterial map={lawnTexture()} color="#a9b98a" roughness={1} />
      </mesh>
      <mesh geometry={roads} receiveShadow>
        <meshStandardMaterial map={asphaltTexture()} roughness={0.92} />
      </mesh>
      {water && (
        <mesh geometry={water}>
          <meshPhysicalMaterial color="#5f8a8c" roughness={0.08} metalness={0.1} clearcoat={1} />
        </mesh>
      )}
      <CityBuildings />
      <Greenery />
    </group>
  )
}
