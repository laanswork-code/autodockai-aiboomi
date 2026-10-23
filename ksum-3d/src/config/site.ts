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

/*
 * Footprint traced from the Google Maps outline: the curved front ends at a
 * vertical recess (the "division" in the photos); west of it two angled blocks
 * form a sawtooth whose teeth point south-west, the west edge runs diagonally
 * to the north-west corner, and the back edge steps down a third of the way
 * from the east. Teeth are capped so they stay clear of the parking strip.
 */
const at = (x: number, offset: number) => arcPoint(FACADE, thetaAtX(FACADE, x), offset)
const DEPTH = 22
/** Where the curve ends; from here the front runs straight into the first notch, as on the map. */
export const DIVISION_T = thetaAtX(FACADE, -20)
const NOTCH1 = at(-29.2, -4)
const TOOTH1 = at(-33.6, 0.2)
const NOTCH2 = at(-48.2, -5)
const TOOTH2 = at(-56.2, 5.5)
const NOTCH1_BACK = at(-29.2, -4 - DEPTH)
const NOTCH2_BACK = at(-48.2, -5 - DEPTH)
const NW_CORNER: XZ = [-72.3, -25.7]

/** Back edge, west to east, with the step at x = 24. */
const BACK: XZ[] = [[-38, -24.8], [24.1, -19.9], [24.8, -12.9], [64.9, -10.4]]

/** Points along the arc at a radial offset, from t0 to t1 inclusive. */
export function arcPoints(t0: number, t1: number, offset = 0, steps = 16): XZ[] {
  return Array.from({ length: steps + 1 }, (_, i) => arcPoint(FACADE, t0 + ((t1 - t0) * i) / steps, offset))
}

/*
 * The entrance recess: a full-height cut in the curved mass, glazed at the
 * back. Its east edge is flush with the east pylon; its west edge is a splayed
 * return wall. West of the pylons the recess only opens above a solid ledge.
 */
export const RECESS_DEPTH = 9
export const RECESS_T_EAST = thetaAtX(FACADE, 26)
export const RECESS_T_WEST = thetaAtX(FACADE, -18)
/** Where the splayed west return wall meets the back glazing. */
export const RECESS_T_WEST_BACK = thetaAtX(FACADE, -12)
export const LEDGE_HEIGHT = 8

/** Main curved mass: the arc from the east end to the division with the entrance recess cut out, then the vertical recess and the back edge. */
export function mainFootprint(): XZ[] {
  return [
    ...arcPoints(FACADE_T_EAST, RECESS_T_EAST, 0, 24),
    ...arcPoints(RECESS_T_EAST, RECESS_T_WEST_BACK, -RECESS_DEPTH),
    ...arcPoints(RECESS_T_WEST, DIVISION_T, 0),
    NOTCH1, ...BACK,
  ]
}

/** Solid ledge under the west part of the recess, from the splayed wall to the west pylon. */
export function ledgeFootprint(): XZ[] {
  return [
    ...arcPoints(ATRIUM_T1, RECESS_T_WEST, 0, 8),
    ...arcPoints(RECESS_T_WEST_BACK, ATRIUM_T1, -RECESS_DEPTH, 8),
  ]
}

/** Taller than the 20-pallet towers (about 25 m), as on site. */
export const MAIN_HEIGHT = 30

export interface Block { bottom: XZ[]; top: XZ[]; height: number }
const inset = (p: XZ, dx: number, dz: number): XZ => [p[0] + dx, p[1] + dz]

/** Middle block: the first tooth, leaning back slightly at its corner. */
export const MIDDLE_BLOCK: Block = {
  bottom: [NOTCH1, TOOTH1, NOTCH2, NOTCH2_BACK, NOTCH1_BACK],
  top: [NOTCH1, at(-33.6, -0.6), NOTCH2, NOTCH2_BACK, NOTCH1_BACK],
  height: 33,
}

/** West block: the second tooth and the diagonal west edge, which is battered (leans in). */
export const WEST_BLOCK: Block = {
  bottom: [NOTCH2, TOOTH2, NW_CORNER, [-38, -24.8], NOTCH2_BACK],
  top: [NOTCH2, inset(TOOTH2, 0.8, -0.8), inset(NW_CORNER, 2.6, 0), [-38, -24.8], NOTCH2_BACK],
  height: 36,
}

/** Outer edges of the two pylons that flank the full-height glazing and the entrance. */
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
export const TOWER_CAPACITY = 20
export const TOWER_GAP = 0.6
/** Fallback footprint until the model has been measured. */
export const TOWER_FALLBACK = { w: 6.0, d: 7.8, h: 20, front: 3.9 }
export const towerTheta = (k: 0 | 1, towerW: number) =>
  STRIP_T_WEST - (0.4 + towerW / 2 + k * (towerW + TOWER_GAP)) / BAY_R

/** Model board: context buildings and roads are clipped to this rectangle. */
export const BOARD: Rect = { x0: -330, x1: 330, z0: -270, z1: 250 }

/** Camera presets: [position, target]. */
const towerMid = arcPoint(FACADE, STRIP_T_WEST - 7 / BAY_R, STRIP[1])
const streetEye = arcPoint(FACADE, STRIP_T_WEST - 40 / BAY_R, ROAD.offset + ROAD.width / 2 + 6)
const towersEye = arcPoint(FACADE, STRIP_T_WEST - 30 / BAY_R, 48)
const atriumMid = (ATRIUM_T0 + ATRIUM_T1) / 2
const entranceEye = arcPoint(FACADE, atriumMid + 6 / FACADE.r, 42)
const entranceAt = arcPoint(FACADE, atriumMid, -3)
export const VIEWS = {
  overview: { pos: [-115, 85, 165], target: [-12, 4, 12] },
  street: { pos: [streetEye[0], 1.7, streetEye[1]], target: [towerMid[0], 6.5, towerMid[1]] },
  towers: { pos: [towersEye[0], 24, towersEye[1]], target: [towerMid[0], 6, towerMid[1]] },
  entrance: { pos: [entranceEye[0], 30, entranceEye[1]], target: [entranceAt[0], 8, entranceAt[1]] },
  plan: { pos: [0, 330, 0.01], target: [0, 0, 0] },
} as const
export type ViewName = keyof typeof VIEWS
