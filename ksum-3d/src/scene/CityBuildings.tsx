import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { blockParts, gableRoof, orientedBox } from '../lib/buildingGeo'
import type { XZ } from '../lib/geo'
import {
  corrugatedTexture, houseWallTexture, officeGlassTexture, punchedTexture, ribbonOfficeTexture, roofTexture, tileRoofTexture,
} from '../lib/textures'
import { drawnBuildings } from './drawnBuildings'

type Style = 'glass' | 'office' | 'plaster' | 'house' | 'shed'

/**
 * The two glass corporate offices: Sutherland Global Services (a real
 * corporate office at KINFRA) and the large block to the east. Heights are
 * our estimate for a six- and five-storey glass building.
 */
const GLASS: Record<number, number> = { 849498815: 24, 797769169: 21 }
const OFFICE_NAMES = /kinfra|startup|kribs|bionest|office/i
/** Kerala plaster palette: cream, white, pale yellow, light grey, sand. */
const PLASTER = ['#f1e8d2', '#f5f3ee', '#efe1b2', '#dfe2e3', '#e9dcc4']

const area = (pts: readonly XZ[]) => Math.abs(pts.reduce((a, [x, z], i) => {
  const [x2, z2] = pts[(i + 1) % pts.length]
  return a + x * z2 - x2 * z
}, 0)) / 2

function styleOf(id: number, name: string | null, a: number): Style {
  if (GLASS[id]) return 'glass'
  if (a > 6000) return 'shed'
  if (a >= 900 || (name && OFFICE_NAMES.test(name))) return 'office'
  if (a < 150) return 'house'
  return 'plaster'
}

const wallMaterial = (style: Style, color: string) => {
  switch (style) {
    case 'glass': return new THREE.MeshPhysicalMaterial({ map: officeGlassTexture(), metalness: 0.55, roughness: 0.06, envMapIntensity: 1.6, clearcoat: 1 })
    case 'office': return new THREE.MeshStandardMaterial({ map: ribbonOfficeTexture(), color, roughness: 0.85 })
    case 'plaster': return new THREE.MeshStandardMaterial({ map: punchedTexture(), color, roughness: 0.9 })
    case 'house': return new THREE.MeshStandardMaterial({ map: houseWallTexture(), color, roughness: 0.9 })
    case 'shed': return new THREE.MeshStandardMaterial({ map: corrugatedTexture(), roughness: 0.55, metalness: 0.4 })
  }
}

interface Bucket { mat: THREE.Material; geos: THREE.BufferGeometry[]; shadow: boolean }

/**
 * Surrounding buildings from OpenStreetMap, each given a believable facade for
 * its size and use, merged into one mesh per material.
 */
export function CityBuildings() {
  const meshes = useMemo(() => {
    const buckets = new Map<string, Bucket>()
    const add = (key: string, make: () => THREE.Material, geo: THREE.BufferGeometry, shadow = true) => {
      const b = buckets.get(key) ?? { mat: make(), geos: [], shadow }
      b.geos.push(geo)
      buckets.set(key, b)
    }
    const roofMat = () => new THREE.MeshStandardMaterial({ map: roofTexture(), roughness: 0.95 })
    for (const b of drawnBuildings()) {
      const a = area(b.pts)
      const style = styleOf(b.id, b.name, a)
      const color = PLASTER[b.id % PLASTER.length]
      const h = style === 'glass' ? GLASS[b.id] : style === 'house' ? 3.6 : style === 'shed' ? 11 : b.h
      const { roof, walls } = blockParts(b.pts, h)
      add(`${style}|${style === 'glass' || style === 'shed' ? '' : color}`, () => wallMaterial(style, color), walls)
      if (style === 'house') {
        const { half } = orientedBox(b.pts)
        add('tiles', () => new THREE.MeshStandardMaterial({ map: tileRoofTexture(), roughness: 0.8, side: THREE.DoubleSide }),
          gableRoof(b.pts, h, Math.min(2.4, half[1] * 0.8)))
      } else {
        add('roof', roofMat, roof, false)
        // parapet and rooftop plant on the bigger buildings
        if (style !== 'shed') {
          const ring = b.pts.map(([x, z]) => [x, z] as XZ)
          const parapet = blockParts(ring, 1.1)
          parapet.walls.translate(0, h, 0)
          add(`${style}|${style === 'glass' ? '' : color}|parapet`, () => style === 'glass'
            ? new THREE.MeshStandardMaterial({ color: '#2f3a40', roughness: 0.5, metalness: 0.4 })
            : wallMaterial(style, color), parapet.walls)
          if (a > 300) {
            const { mid, ux, uz } = orientedBox(b.pts)
            const unit = new THREE.BoxGeometry(4, 2.2, 3)
            unit.rotateY(-Math.atan2(uz, ux))
            unit.translate(mid[0], h + 1.1, mid[1])
            add('plant', () => new THREE.MeshStandardMaterial({ color: '#9a9893', roughness: 0.7, metalness: 0.2 }), unit.toNonIndexed())
          }
        }
      }
    }
    return [...buckets.entries()].map(([key, b]) => ({
      key,
      mat: b.mat,
      geo: mergeGeometries(b.geos.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
        // merge needs identical attribute sets
        if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
        if (!g.getAttribute('normal')) g.computeVertexNormals()
        return g
      })),
      shadow: b.shadow,
    }))
  }, [])

  return (
    <group>
      {meshes.map((m) => m.geo && (
        <mesh key={m.key} geometry={m.geo} material={m.mat} castShadow={m.shadow} receiveShadow />
      ))}
    </group>
  )
}
