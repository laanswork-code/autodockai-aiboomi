/*
 * The map, drawn on a canvas from the site data: a GTA-style radar in the
 * corner that turns with you, and the full map (M) that shows the whole site
 * north-up with both towers, your route, your car and everyone online.
 */
import { useEffect, useMemo, useRef } from 'react'
import { BOARD, FACADE, ROAD, STRIP_T_EAST, STRIP_T_WEST } from '../config/site'
import { site } from '../data/site'
import { arcPoint, clipPolyline, type XZ } from '../lib/geo'
import { objective, PINK, ROUTE } from './guide'
import { routeTo, towerPlaces } from './layout'
import { live, remote, useGame } from './store'

const RADAR = 190
const RADAR_RANGE = 140 // metres from centre to edge
/** The area the full map fits to the screen: the site and the roads around it (the model board runs further). */
const AREA = { x0: -190, x1: 170, z0: -130, z1: 150 }

interface Layers { roads: { pts: readonly XZ[]; w: number }[]; buildings: (readonly XZ[])[]; ktiz: readonly XZ[] }

function useLayers(): Layers {
  return useMemo(() => {
    const roads = site.roads.flatMap((x) => clipPolyline(x.pts, BOARD).map((pts) => ({ pts, w: x.w })))
    // the curved front road the twin draws in place of the OSM one
    const arc = Array.from({ length: 41 }, (_, i) => arcPoint(FACADE, STRIP_T_EAST - 0.5 + ((STRIP_T_WEST - STRIP_T_EAST + 0.9) * i) / 40, ROAD.offset))
    return { roads: [...roads, { pts: arc, w: ROAD.width }], buildings: site.buildings.map((b) => b.pts), ktiz: site.ktiz.pts }
  }, [])
}

/**
 * Paint the map into `g`, already transformed to world metres. `px` is metres
 * per CSS pixel, so marks keep their on-screen size at any zoom.
 */
function paint(g: CanvasRenderingContext2D, L: Layers, px: number, labels: boolean) {
  const s = useGame.getState()
  const driving = s.mode === 'car'
  const at = driving ? live.car : live.foot
  const poly = (pts: readonly XZ[]) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.closePath() }
  const dot = (x: number, z: number, r: number, fill: string) => { g.fillStyle = fill; g.beginPath(); g.arc(x, z, r * px, 0, Math.PI * 2); g.fill() }
  const text = (t: string, x: number, z: number, dy = 0) => {
    g.save(); g.translate(x, z); g.scale(px, px)
    g.font = '600 12px Inter, system-ui, sans-serif'; g.textAlign = 'center'
    g.lineWidth = 3; g.strokeStyle = 'rgba(22,24,27,.85)'; g.strokeText(t, 0, dy); g.fillStyle = '#fff'; g.fillText(t, 0, dy)
    g.restore()
  }

  g.lineCap = 'round'; g.lineJoin = 'round'
  g.fillStyle = '#56645a'
  for (const pts of L.buildings) { poly(pts); g.fill() }
  g.fillStyle = '#7d8a80'; poly(L.ktiz); g.fill()
  g.strokeStyle = '#9aa39c'
  for (const r of L.roads) { g.lineWidth = Math.max(2.5 * px, r.w); g.beginPath(); r.pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z))); g.stroke() }

  // the two towers stand 5 m apart, so one label covers both
  const towers = towerPlaces(null)
  for (const t of towers) { g.fillStyle = '#1747a6'; g.fillRect(t.x - 3, t.z - 3, 6, 6) }
  if (labels) text('AutoDock towers', (towers[0].x + towers[1].x) / 2, (towers[0].z + towers[1].z) / 2, -12)
  const o = objective()
  if (o && o.kind !== 'car') {
    const route = routeTo(o.tower, at.x, at.z)
    g.strokeStyle = ROUTE; g.lineWidth = 3.5 * px
    g.beginPath(); route.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.stroke()
  }
  if (o) dot(o.x, o.z, 5.5, PINK)
  if (s.car === 'world' && s.mode === 'foot') { dot(live.car.x, live.car.z, 4.5, '#ffffff'); if (labels) text('Your car', live.car.x, live.car.z, -9) }
  for (const [id, p] of remote) {
    const inCar = p.mode === 'car' && p.car
    const x = inCar ? p.car!.x : p.x
    const z = inCar ? p.car!.z : p.z
    dot(x, z, 4.2, '#5ec8ff')
    if (labels) text(s.players[id]?.name ?? '', x, z, -9)
  }
}

/** A white arrow for me, pointing along `rot` (canvas radians). */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, rot: number) {
  g.save(); g.translate(x, y); g.rotate(rot)
  g.fillStyle = '#ffffff'; g.strokeStyle = '#16181b'; g.lineWidth = 1.5
  g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3); g.lineTo(-6.5, 7); g.closePath(); g.fill(); g.stroke()
  g.restore()
}

/** Run `draw` every animation frame against a canvas sized for the screen. */
function useCanvasLoop(ref: React.RefObject<HTMLCanvasElement | null>, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const c = ref.current
      if (!c) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      draw(g, w, h)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [ref, draw])
}

/** Corner radar: centred on me, my heading up. */
export function Radar() {
  const ref = useRef<HTMLCanvasElement>(null)
  const L = useLayers()
  const draw = useMemo(() => (g: CanvasRenderingContext2D, w: number) => {
    const s = useGame.getState()
    const at = s.mode === 'car' ? live.car : live.foot
    const heading = s.mode === 'car' ? live.carYaw : live.footYaw
    const k = (w / 2) / RADAR_RANGE
    g.save()
    g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 2, 0, Math.PI * 2); g.clip()
    g.fillStyle = '#2b3a2c'; g.fillRect(0, 0, w, w)
    g.translate(w / 2, w / 2); g.rotate(Math.PI + heading); g.scale(k, k); g.translate(-at.x, -at.z)
    paint(g, L, 1 / k, false)
    g.restore()
    arrow(g, w / 2, w / 2, 0)
  }, [L])
  useCanvasLoop(ref, draw)
  return <canvas ref={ref} className="gm-radar" style={{ width: RADAR, height: RADAR }} aria-label="Radar. Press M for the full map" />
}

/** Full map (M): the whole site, north up, fitted to the screen. */
export function FullMap() {
  const open = useGame((s) => s.map)
  const ref = useRef<HTMLCanvasElement>(null)
  const L = useLayers()
  const draw = useMemo(() => (g: CanvasRenderingContext2D, w: number, h: number) => {
    const s = useGame.getState()
    const at = s.mode === 'car' ? live.car : live.foot
    const heading = s.mode === 'car' ? live.carYaw : live.footYaw
    const bw = AREA.x1 - AREA.x0
    const bh = AREA.z1 - AREA.z0
    const cx = AREA.x0 + bw / 2
    const cz = AREA.z0 + bh / 2
    const k = Math.min(w / bw, h / bh)
    g.fillStyle = '#2b3a2c'; g.fillRect(0, 0, w, h)
    g.save()
    g.translate(w / 2, h / 2); g.scale(k, k); g.translate(-cx, -cz)
    paint(g, L, 1 / k, true)
    g.restore()
    // me: world (x, z) to screen; heading yaw points along (sin, cos) in x/z, which is down-screen for yaw 0
    const sx = w / 2 + (at.x - cx) * k
    const sy = h / 2 + (at.z - cz) * k
    arrow(g, sx, sy, Math.PI - heading)
  }, [L])
  useCanvasLoop(ref, draw)
  if (!open) return null
  return (
    <div className="gm-map" role="dialog" aria-label="Map">
      <canvas ref={ref} />
      <div className="gm-map-legend">
        <strong>Map</strong>
        <span><i style={{ background: '#fff' }} /> You and your car</span>
        <span><i style={{ background: '#5ec8ff' }} /> Other players</span>
        <span><i style={{ background: '#1747a6' }} /> AutoDock towers</span>
        <span><i style={{ background: PINK }} /> Where to go</span>
        <span><i style={{ background: ROUTE }} /> Your route</span>
        <em>M or Esc to close</em>
      </div>
    </div>
  )
}
