import { BAYS_PER_TOWER, BAY_W, KEPT_BAY_COUNT, STRIP, STRIP_AREA, TODAY_BAYS, TOWER_CAPACITY } from '../config/site'

export interface SpaceStats {
  today: { cars: number; area: number; perCar: number }
  autodock: { cars: number; area: number; perCar: number; towers: number }
  densityGain: number
  /** Surface bays east of the towers that stay in use. */
  keptBays: number
}

const BAY_AREA = BAY_W * (STRIP[1] - STRIP[0])

/** Ground needed today (the whole paver strip) vs. two rotary towers, each on two bays. */
export function spaceStats(): SpaceStats {
  const towers = 2
  const towerArea = towers * BAYS_PER_TOWER * BAY_AREA
  const todayCars = TODAY_BAYS.length
  const towerCars = towers * TOWER_CAPACITY
  const todayPer = STRIP_AREA / todayCars
  const towerPer = towerArea / towerCars
  return {
    today: { cars: todayCars, area: STRIP_AREA, perCar: todayPer },
    autodock: { cars: towerCars, area: towerArea, perCar: towerPer, towers },
    densityGain: todayPer / towerPer,
    keptBays: KEPT_BAY_COUNT,
  }
}
