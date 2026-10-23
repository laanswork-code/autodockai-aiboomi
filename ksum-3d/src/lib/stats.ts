import { STRIP_AREA, TODAY_BAYS, TOWER_CAPACITY, TOWER_FALLBACK } from '../config/site'
import type { TowerSize } from '../store/useSceneStore'

export interface SpaceStats {
  today: { cars: number; area: number; perCar: number }
  autodock: { cars: number; area: number; perCar: number; towers: number }
  densityGain: number
  freed: number
}

/** Ground needed today (the whole paver strip) vs. two rotary towers. */
export function spaceStats(size: TowerSize | null): SpaceStats {
  const t = size ?? TOWER_FALLBACK
  const towers = 2
  const towerArea = towers * t.w * t.d
  const todayCars = TODAY_BAYS.length
  const towerCars = towers * TOWER_CAPACITY
  const todayPer = STRIP_AREA / todayCars
  const towerPer = towerArea / towerCars
  return {
    today: { cars: todayCars, area: STRIP_AREA, perCar: todayPer },
    autodock: { cars: towerCars, area: towerArea, perCar: towerPer, towers },
    densityGain: todayPer / towerPer,
    freed: Math.max(0, STRIP_AREA - towerArea),
  }
}
