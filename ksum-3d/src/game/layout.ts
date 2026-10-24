/*
 * Where things are in the game, in world metres, from the same site layout
 * the twin uses: the two towers, the pink drop circle in front of each door,
 * random spawn points on the roads, and a GPS route that follows the curved road.
 */
import * as THREE from 'three'
import { BOARD, FACADE, ROAD, STRIP, STRIP_T_EAST, TOWER_FALLBACK, towerTheta } from '../config/site'
import { site } from '../data/site'
import { arcPoint, clipPolyline, yawOutward, type XZ } from '../lib/geo'
import type { TowerSize } from '../store/useSceneStore'

/** Radial offset of the drop circle: on the road, just clear of the door. */
const DROP_OFFSET = STRIP[1] + 3.4
export const DROP_RADIUS = 2.6
const ROAD_MID = ROAD.offset

export interface TowerPlace { k: 0 | 1; theta: number; x: number; z: number; yaw: number }

export function towerPlaces(size: TowerSize | null): [TowerPlace, TowerPlace] {
  const s = size ?? TOWER_FALLBACK
  return ([0, 1] as const).map((k) => {
    const theta = towerTheta(k)
    const [x, z] = arcPoint(FACADE, theta, STRIP[1] - 0.1 - s.front)
    return { k, theta, x, z, yaw: yawOutward(theta) }
  }) as [TowerPlace, TowerPlace]
}

/** Centre of tower k's drop circle and the yaw of a car facing out of its door. */
export function dropSpot(k: 0 | 1) {
  const theta = towerTheta(k)
  const [x, z] = arcPoint(FACADE, theta, DROP_OFFSET)
  return { x, z, yaw: yawOutward(theta) }
}

/** Roads a player can start on: OSM road pieces within reach of the towers, plus the curved front road. */
const SPAWN_REACH = 170
const spawnRoads: XZ[][] = (() => {
  const [tx, tz] = arcPoint(FACADE, towerTheta(0), STRIP[1])
  const near = (p: XZ) => Math.hypot(p[0] - tx, p[1] - tz) < SPAWN_REACH
  const osm = site.roads.filter((r) => r.w >= 5).flatMap((r) => clipPolyline(r.pts, BOARD)).filter((pts) => pts.length > 1 && pts.every(near))
  const front = Array.from({ length: 12 }, (_, i) => arcPoint(FACADE, STRIP_T_EAST - (12 + i * 6) / (FACADE.r + ROAD_MID), ROAD_MID))
  return [...osm, front]
})()

/**
 * A random start on one of those roads, so players do not all appear in one
 * spot: the car on the road facing along it, you on the verge beside it.
 */
export function randomSpawn(rand: () => number = Math.random) {
  const pts = spawnRoads[Math.floor(rand() * spawnRoads.length)]
  const i = Math.floor(rand() * (pts.length - 1))
  const [ax, az] = pts[i]
  const [bx, bz] = pts[i + 1]
  const k = 0.2 + rand() * 0.6
  const x = ax + (bx - ax) * k
  const z = az + (bz - az) * k
  const len = Math.hypot(bx - ax, bz - az) || 1
  const [dx, dz] = [(bx - ax) / len, (bz - az) / len]
  const yaw = Math.atan2(dx, dz) + (rand() < 0.5 ? Math.PI : 0)
  // the driver's door is on the right; stand just outside it
  const side = 2.6
  return { car: { x, z, yaw }, foot: { x: x - Math.cos(yaw) * side, z: z + Math.sin(yaw) * side, yaw } }
}

const thetaOf = (x: number, z: number) => Math.atan2(z - FACADE.cz, x - FACADE.cx)

/**
 * A drivable route from (x, z) to tower k's drop circle: onto the road, along
 * its curve, then into the circle. Off-road starts go straight to the road first.
 */
export function routeTo(k: 0 | 1, x: number, z: number): THREE.Vector3[] {
  const end = dropSpot(k)
  const t0 = thetaOf(x, z)
  const t1 = towerTheta(k)
  const pts: THREE.Vector3[] = [new THREE.Vector3(x, 0, z)]
  const steps = Math.max(2, Math.ceil(Math.abs(t1 - t0) * (FACADE.r + ROAD_MID) / 4))
  for (let i = 0; i <= steps; i++) {
    const [px, pz] = arcPoint(FACADE, t0 + ((t1 - t0) * i) / steps, ROAD_MID)
    pts.push(new THREE.Vector3(px, 0, pz))
  }
  pts.push(new THREE.Vector3(end.x, 0, end.z))
  return pts
}

/** Length of a route in metres. */
export const routeLength = (pts: THREE.Vector3[]) => pts.reduce((a, p, i) => (i ? a + p.distanceTo(pts[i - 1]) : 0), 0)
