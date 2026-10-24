/*
 * Where things are in the game, in world metres, from the same site layout
 * the twin uses: the two towers, the pink drop circle in front of each door,
 * spawn points on the road, and a GPS route that follows the curved road.
 */
import * as THREE from 'three'
import { FACADE, ROAD, STRIP, STRIP_T_EAST, TOWER_FALLBACK, towerTheta } from '../config/site'
import { arcPoint, yawOutward } from '../lib/geo'
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

/** Spawn on the road east of the towers, one slot per player so cars do not stack. */
export function spawnSpot(slot: number) {
  const theta = STRIP_T_EAST - (14 + (slot % 8) * 7) / (FACADE.r + ROAD_MID)
  const [x, z] = arcPoint(FACADE, theta, ROAD_MID + 1.8)
  const [px, pz] = arcPoint(FACADE, theta, ROAD_MID + 4.3)
  // cars face west, toward the towers: along the road's tangent, the way the angle grows
  const yaw = Math.atan2(-Math.sin(theta), Math.cos(theta))
  return { car: { x, z, yaw }, foot: { x: px, z: pz, yaw } }
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
