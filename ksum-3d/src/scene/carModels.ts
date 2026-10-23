import * as THREE from 'three'

/** The two BYD models shipped with the AutoDock demo. Lengths are the real cars'. */
export const CARS = {
  seal: { url: '/models/seal.glb', length: 4.8 },
  atto: { url: '/models/atto.glb', length: 4.455 },
} as const
export type CarKind = keyof typeof CARS

const PAINT = /car[_ ]?paint/i

/**
 * Normalised template per model: nose along +z, wheels on y = 0, centred,
 * real-world length. Built once per loaded scene and cloned per car.
 */
const templates = new WeakMap<THREE.Object3D, THREE.Group>()
function template(scene: THREE.Object3D, length: number) {
  const hit = templates.get(scene)
  if (hit) return hit
  const inner = scene.clone(true)
  const box = new THREE.Box3().setFromObject(inner)
  const size = box.getSize(new THREE.Vector3())
  // Lay the long axis along z.
  if (size.x > size.z) inner.rotation.y = Math.PI / 2
  inner.updateMatrixWorld(true)
  const b2 = new THREE.Box3().setFromObject(inner)
  const s = length / Math.max(size.x, size.z)
  const c = b2.getCenter(new THREE.Vector3())
  inner.position.set(-c.x * s, -b2.min.y * s, -c.z * s)
  inner.scale.multiplyScalar(s)
  inner.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  const t = new THREE.Group()
  t.add(inner)
  templates.set(scene, t)
  return t
}

/** Paint materials are shared per (material, colour) so 20 cars don't mean 20 copies. */
const paints = new Map<string, THREE.Material>()
function paint(m: THREE.MeshStandardMaterial, color: string) {
  const key = `${m.uuid}|${color}`
  let p = paints.get(key)
  if (!p) {
    const c = m.clone()
    c.color.set(color)
    paints.set(key, c)
    p = c
  }
  return p
}

/** Builds a car object (for use as a child of something else, e.g. a pallet). */
export function makeCar(scene: THREE.Object3D, kind: CarKind, color: string) {
  const obj = template(scene, CARS[kind].length).clone(true)
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && !Array.isArray(mesh.material) && PAINT.test(mesh.material.name)) {
      mesh.material = paint(mesh.material as THREE.MeshStandardMaterial, color)
    }
  })
  return obj
}
