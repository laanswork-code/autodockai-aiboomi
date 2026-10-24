import { BOARD, FACADE, ROAD } from '../config/site'
import { site, type SiteData } from '../data/site'
import { inRect, type XZ } from '../lib/geo'

export const centroid = (pts: readonly XZ[]): XZ => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
]

/**
 * The OSM buildings the scene draws: on the model board, and not standing on
 * the curved front road (the KSUM building moved north to fit it, so a few
 * mapped buildings now sit where the road runs). Physics uses the same list.
 */
export function drawnBuildings(): SiteData['buildings'] {
  return site.buildings.filter((b) => {
    const [cx, cz] = centroid(b.pts)
    return inRect(BOARD, [cx, cz]) && Math.hypot(cx - FACADE.cx, cz - FACADE.cz) >= FACADE.r + ROAD.offset + ROAD.width / 2 + 4
  })
}
