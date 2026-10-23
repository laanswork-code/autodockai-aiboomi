import { arcPoint, circleFrom3, thetaAtX, type Rect, type XZ } from '../lib/geo'

/*
 * Site layout for the Kerala Technology Innovation Zone (KSUM) building at
 * KINFRA Hi-Tech Park, Kalamassery. Coordinates are metres, x = east, z = south,
 * origin at the OSM footprint centroid (see scripts/build-site.mjs).
 *
 * OSM puts the curved facade on top of the road centreline, so the building is
 * shifted 8 m north to leave room for the lawn, parking strip and road seen in
 * the site photos.
 */
export const KTIZ_SHIFT = -8
const S = KTIZ_SHIFT

/** The curved south facade: a circle through three OSM facade vertices. */
export const FACADE = circleFrom3([-46.7, 18.4 + S], [5.1, 32.2 + S], [64.1, 8.0 + S])
export const FACADE_T_WEST = thetaAtX(FACADE, -46.7)
export const FACADE_T_EAST = thetaAtX(FACADE, 64.1)

/** West and back edges of the OSM footprint, after the shift, continuing from the arc's west end. */
const BACK: XZ[] = [[-67.4, -3.6 + S], [-73.1, -27.4 + S], [12.2, -26.6 + S], [47.5, -24.4 + S], [65.2, -22.9 + S]]

/** Main curved mass: the arc from east to west, then the back edges. */
export function mainFootprint(steps = 48): XZ[] {
  const pts: XZ[] = []
  for (let i = 0; i <= steps; i++) {
    const t = FACADE_T_EAST + ((FACADE_T_WEST - FACADE_T_EAST) * i) / steps
    pts.push(arcPoint(FACADE, t))
  }
  return [...pts, ...BACK]
}

export const MAIN_HEIGHT = 22
/** The taller stepped wing at the west end (left in the photos). */
export const WEST_WING: XZ[] = [[-73.1, -35.4], [-50, -35.4], [-43, 4], [-46.7, 10.4], [-67.4, -11.6]]
export const WEST_WING_HEIGHT = 27

/** Glazed atrium with the louvered canopy, centred on the entrance. */
export const ATRIUM_T0 = thetaAtX(FACADE, 26)
export const ATRIUM_T1 = thetaAtX(FACADE, -4)

/** Radial bands in front of the facade, in metres from the facade. */
export const LAWN = [0.6, 4] as const          // planter lawn with the KSUM letters and palms
export const STRIP = [4, 9.5] as const         // interlocking-paver parking strip, cars nose-in
export const ROAD = { offset: 13.25, width: 7.5 } as const

/** Parking bays: 2.6 m wide, from the west end of the strip toward the entrance. */
export const BAY_W = 2.6
export const BAY_COUNT = 15
const BAY_R = FACADE.r + (STRIP[0] + STRIP[1]) / 2
export const STRIP_T_WEST = thetaAtX(FACADE, -44)
export const bayTheta = (i: number) => STRIP_T_WEST - ((i + 0.5) * BAY_W) / BAY_R
export const STRIP_T_EAST = STRIP_T_WEST - (BAY_COUNT * BAY_W) / BAY_R
export const STRIP_AREA = BAY_COUNT * BAY_W * (STRIP[1] - STRIP[0])

/** Bays occupied today (two empty, as on the day the photos were taken). */
export const TODAY_BAYS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14]

/** Two AutoDock rotary towers at the west end of the strip, doors facing the road. */
export const TOWER_CAPACITY = 12
export const TOWER_GAP = 1.2
/** Fallback footprint until the model has been measured. */
export const TOWER_FALLBACK = { w: 6.2, d: 7.5, h: 16 }
export const towerTheta = (k: 0 | 1, towerW: number) =>
  STRIP_T_WEST - (0.4 + towerW / 2 + k * (towerW + TOWER_GAP)) / BAY_R

/** Model board: context buildings and roads are clipped to this rectangle. */
export const BOARD: Rect = { x0: -330, x1: 330, z0: -270, z1: 250 }

/** Camera presets: [position, target]. */
const towerMid = arcPoint(FACADE, STRIP_T_WEST - 7 / BAY_R, STRIP[1])
const streetEye = arcPoint(FACADE, STRIP_T_WEST - 40 / BAY_R, ROAD.offset + ROAD.width / 2 + 6)
const towersEye = arcPoint(FACADE, STRIP_T_WEST - 30 / BAY_R, 48)
export const VIEWS = {
  overview: { pos: [-115, 85, 165], target: [-12, 4, 12] },
  street: { pos: [streetEye[0], 1.7, streetEye[1]], target: [towerMid[0], 6.5, towerMid[1]] },
  towers: { pos: [towersEye[0], 24, towersEye[1]], target: [towerMid[0], 6, towerMid[1]] },
  plan: { pos: [0, 330, 0.01], target: [0, 0, 0] },
} as const
export type ViewName = keyof typeof VIEWS
