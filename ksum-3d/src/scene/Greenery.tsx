import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BOARD } from '../config/site'
import { site } from '../data/site'
import { distanceToPolyline, insidePolygon } from '../lib/buildingGeo'
import { rng, type XZ } from '../lib/geo'

const TREES = 900
/** Keep clear of the KSUM plot, which has its own planting. */
const HERO_CLEAR = 105

interface Tree { x: number; z: number; s: number; palm: boolean }

/** Kerala greenery: broadleaf canopy trees and coconut palms, off buildings, roads and water. */
export function Greenery() {
  const trees = useMemo(() => {
    const rnd = rng(2024)
    const out: Tree[] = []
    const blocks = site.buildings.map((b) => b.pts)
    const water = site.water.map((w) => w.pts)
    let tries = 0
    while (out.length < TREES && tries++ < TREES * 30) {
      const p: XZ = [BOARD.x0 + rnd() * (BOARD.x1 - BOARD.x0), BOARD.z0 + rnd() * (BOARD.z1 - BOARD.z0)]
      if (Math.hypot(p[0], p[1]) < HERO_CLEAR) continue
      if (blocks.some((b) => insidePolygon(p, b) || distanceToPolyline(p, [...b, b[0]]) < 3)) continue
      if (water.some((w) => insidePolygon(p, w))) continue
      if (site.roads.some((r) => distanceToPolyline(p, r.pts) < r.w / 2 + 2.5)) continue
      out.push({ x: p[0], z: p[1], s: 0.8 + rnd() * 0.7, palm: rnd() < 0.35 })
    }
    return out
  }, [])
  const broad = useMemo(() => trees.filter((t) => !t.palm), [trees])
  const palms = useMemo(() => trees.filter((t) => t.palm), [trees])
  return (
    <group>
      <Broadleaf trees={broad} />
      <Palms trees={palms} />
    </group>
  )
}

function Broadleaf({ trees }: { trees: Tree[] }) {
  const crowns = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    const greens = ['#3f6b2f', '#4a7a34', '#365e2a', '#56813a']
    trees.forEach((t, i) => {
      o.position.set(t.x, 4.2 * t.s + 2.2 * t.s, t.z)
      o.scale.set(3.4 * t.s, 2.6 * t.s, 3.4 * t.s)
      o.rotation.set(0, i, 0)
      o.updateMatrix()
      crowns.current!.setMatrixAt(i, o.matrix)
      crowns.current!.setColorAt(i, c.set(greens[i % greens.length]))
      o.position.set(t.x, 2.2 * t.s, t.z)
      o.scale.set(t.s, t.s, t.s)
      o.updateMatrix()
      trunks.current!.setMatrixAt(i, o.matrix)
    })
    crowns.current!.instanceMatrix.needsUpdate = true
    crowns.current!.instanceColor!.needsUpdate = true
    trunks.current!.instanceMatrix.needsUpdate = true
  }, [trees])
  return (
    <group>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 4.4, 6]} />
        <meshStandardMaterial color="#5b4a3a" roughness={0.9} />
      </instancedMesh>
    </group>
  )
}

/** Coconut palms: tall leaning trunk and a ring of drooping fronds (one instanced frond mesh). */
function Palms({ trees }: { trees: Tree[] }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const fronds = useRef<THREE.InstancedMesh>(null)
  const FRONDS = 8
  useLayoutEffect(() => {
    const rnd = rng(77)
    const o = new THREE.Object3D()
    const top = new THREE.Vector3()
    trees.forEach((t, i) => {
      const h = 9 + t.s * 5
      const lean = (rnd() - 0.5) * 0.25
      o.position.set(t.x, h / 2, t.z)
      o.rotation.set(lean, rnd() * 6, 0)
      o.scale.set(1, h, 1)
      o.updateMatrix()
      trunks.current!.setMatrixAt(i, o.matrix)
      top.set(0, 0.5, 0).applyMatrix4(o.matrix)
      for (let k = 0; k < FRONDS; k++) {
        const f = new THREE.Object3D()
        f.position.copy(top)
        f.rotation.set(0, (k / FRONDS) * Math.PI * 2 + rnd() * 0.3, 0)
        f.rotateX(0.55 + rnd() * 0.35) // droop
        f.translateZ(1.6)
        f.updateMatrix()
        fronds.current!.setMatrixAt(i * FRONDS + k, f.matrix)
      }
    })
    trunks.current!.instanceMatrix.needsUpdate = true
    fronds.current!.instanceMatrix.needsUpdate = true
  }, [trees])
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 1, 6]} />
        <meshStandardMaterial color="#8a7a63" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={fronds} args={[undefined, undefined, trees.length * FRONDS]} castShadow>
        <boxGeometry args={[0.6, 0.05, 3.4]} />
        <meshStandardMaterial color="#4b7330" roughness={0.8} />
      </instancedMesh>
    </group>
  )
}
