/*
 * Everything the film moves in the 3D site, as a function of film time: the
 * hero car's drive (tyres rolling with distance, front wheels steering with
 * the path's curvature), Tower 2's pallet coming down and going back up, the
 * driver getting out, plugging in and walking away, the charging cable, the
 * gate camera's overlay, and the camera.
 */
import { Html, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FACADE, STRIP, TOWER_FALLBACK, towerTheta } from '../config/site'
import { useControlStore } from '../control/useControlStore'
import { arcPoint, yawOutward } from '../lib/geo'
import { CARS } from '../scene/carModels'
import { SEEK_SPEED, SHUTTERS, useTowerLayout } from '../scene/RotaryTower'
import { useSceneStore } from '../store/useSceneStore'
import { buildHeroCar, rollWheels } from './heroCar'
import { useFilm } from './store'
import { clamp01, cruiseThenBrake, lerp, shutterAt, smooth, T } from './timeline'
import { buildFigure, poseOnRoute, type Leg } from './walker'

/** Tower 2, pallet 9 (index 8): empty in the site's starting load. */
export const FILM_TOWER = 1 as const
export const FILM_PALLET = 8
export const FILM_PLATE = 'KL 01 CB 4821'
const PAINT = '#2b5797'
/** Road surface height (Site.tsx) and the turn from the south lane into the door. */
const ROAD_Y = 0.07
const TURN_R = 3.0
const Y = new THREE.Vector3(0, 1, 0)

const v3 = (x: number, z: number, y = ROAD_Y) => new THREE.Vector3(x, y, z)
const flat = (v: THREE.Vector3) => new THREE.Vector3(v.x, 0, v.z)

/** Static layout of the scene: tower frame, the drive path, the driver's route. */
function useStage() {
  const size = useSceneStore((s) => s.towerSize) ?? TOWER_FALLBACK
  const layout = useTowerLayout()
  return useMemo(() => {
    const theta = towerTheta(FILM_TOWER)
    const [tx, tz] = arcPoint(FACADE, theta, STRIP[1] - 0.1 - size.front)
    const yaw = yawOutward(theta)
    const tower = new THREE.Matrix4().compose(new THREE.Vector3(tx, 0.08, tz), new THREE.Quaternion().setFromAxisAngle(Y, yaw), new THREE.Vector3(1, 1, 1))
    const out = new THREE.Vector3(0, 0, 1).applyAxisAngle(Y, yaw)
    /** Pallet 9's deck in world space for a given chain offset. */
    const palletAt = (offset: number, target = new THREE.Vector3()) =>
      layout.pointAt(FILM_PALLET * layout.pitch + offset, target).add(new THREE.Vector3(0, layout.deck, 0)).applyMatrix4(tower)
    const docked = -FILM_PALLET * layout.pitch
    const P = palletAt(docked)
    const door0 = layout.pointAt(0, new THREE.Vector3())
    const doorDist = size.front - door0.z

    // the road toward the towers runs west, the way theta grows
    const roadDir = (th: number) => new THREE.Vector3(-Math.sin(th), 0, Math.cos(th))
    const u = roadDir(theta).addScaledVector(out, -roadDir(theta).dot(out)).normalize()
    const G = flat(P).addScaledVector(out, doorDist + 3.2).setY(ROAD_Y)
    const G2 = G.clone()
    const C = G2.clone().addScaledVector(u, -TURN_R)
    const S = C.clone().addScaledVector(out, TURN_R)
    const thS = Math.atan2(S.z - FACADE.cz, S.x - FACADE.cx)
    const offS = Math.hypot(S.x - FACADE.cx, S.z - FACADE.cz) - FACADE.r
    const pts: THREE.Vector3[] = []
    for (let d = 60; d > 0.5; d -= 1.5) { const [x, z] = arcPoint(FACADE, thS - d / (FACADE.r + offS), offS); pts.push(v3(x, z)) }
    for (let i = 0; i <= 12; i++) {
      const a = (Math.PI / 2) * (1 - i / 12)
      pts.push(C.clone().addScaledVector(out, TURN_R * Math.sin(a)).addScaledVector(u, TURN_R * Math.cos(a)).setY(ROAD_Y))
    }
    pts.push(G.clone().addScaledVector(out, 1), G.clone())
    const road = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const roadLen = road.getLength()
    const inLen = flat(P).distanceTo(flat(G))

    const inward = out.clone().negate()
    const right = new THREE.Vector3().crossVectors(inward, Y) // the parked car's right, the driver's side
    const along = (base: THREE.Vector3, r: number, o: number) => flat(base).addScaledVector(right, r).addScaledVector(out, o)
    const xz = (v: THREE.Vector3) => new THREE.Vector2(v.x, v.z)
    const half = (CARS.atto.length * layout.carScale) / 2
    const stand = along(P, 1.35, half + 0.55)
    const doorOut = along(P, 1.7, doorDist + 1.4)
    const thOut = Math.atan2(doorOut.z - FACADE.cz, doorOut.x - FACADE.cx)
    const offOut = Math.hypot(doorOut.x - FACADE.cx, doorOut.z - FACADE.cz) - FACADE.r
    const away = (d: number) => { const [x, z] = arcPoint(FACADE, thOut - d / (FACADE.r + offOut), offOut); return new THREE.Vector2(x, z) }
    const chargerW = along(P, 1.05, half + 0.3).setY(P.y + 0.85)
    const route = {
      start: xz(along(P, 0.55, -0.35)),
      legs: [
        { t0: T.exit, t1: T.exit + 0.7, to: xz(along(P, 1.2, -0.35)) },
        { t0: T.exit + 0.7, t1: T.charger, to: xz(stand) },
        { t0: T.charger, t1: T.charger + 0.9, to: xz(stand), reach: true, face: xz(chargerW) },
        { t0: T.charger + 0.9, t1: T.plug + 0.5, to: xz(stand), reach: true, face: xz(along(P, 0.9, half - 0.75)) },
        { t0: T.plug + 0.5, t1: T.leave, to: xz(stand), face: xz(doorOut) },
        { t0: T.leave, t1: T.leave + 2.1, to: xz(doorOut) },
        { t0: T.leave + 2.1, t1: T.leave + 6.5, to: away(6) },
        { t0: T.leave + 6.5, t1: T.leave + 12, to: away(13.5) },
      ] satisfies Leg[],
    }
    return { size, layout, tower, yaw, out, u, right, palletAt, docked, P, G, road, roadLen, inLen, route, half, top: new THREE.Vector3(tx, size.h, tz) }
  }, [size, layout])
}

/** Tower 2's chain offset, as RotaryTower moves it: constant speed, the shorter way round. */
function chainOffset(t: number, pitch: number) {
  const at = -FILM_PALLET * pitch
  const travel = (FILM_PALLET * pitch) / SEEK_SPEED
  let o = 0
  for (const [t0, from, to] of [[T.pallet, 0, at], [T.lift, at, 0], [T.pay, 0, at]] as const) if (t >= t0) o = lerp(from, to, clamp01((t - t0) / travel))
  return o
}
const doorAt = (t: number) => (t >= T.pay ? FILM_PALLET : t >= T.lift ? 0 : t >= T.pallet ? FILM_PALLET : null)

export function FilmRig() {
  const stage = useStage()
  const atto = useGLTF(CARS.atto.url).scene
  const car = useMemo(() => buildHeroCar(atto, 'atto', PAINT, FILM_PLATE), [atto])
  const figure = useMemo(() => buildFigure('#f0b91c'), [])
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const scale = stage.layout.carScale
  const [vision, setVision] = useState(false)

  const charger = useMemo(() => {
    const g = new THREE.Group()
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.16), new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.4 }))
    post.position.y = 0.55
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), new THREE.MeshStandardMaterial({ color: '#2f9e5b', emissive: '#2f9e5b', emissiveIntensity: 0.8 }))
    screen.position.set(0, 0.85, 0.081)
    g.add(post, screen)
    return g
  }, [])
  const cable = useMemo(() => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#ff7a1a', roughness: 0.5 })), [])
  const plug = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), new THREE.MeshStandardMaterial({ color: '#2f9e5b', emissive: '#2f9e5b', emissiveIntensity: 1 })), [])
  const ring = useRef<THREE.Mesh>(null)

  // the film takes over the control room's tower state while it plays
  useEffect(() => {
    useControlStore.setState({ scenario: 'normal', door: [null, null] })
    return () => useControlStore.getState().reset()
  }, [])

  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion() }), [])
  const lastDoor = useRef<number | null | undefined>(undefined)

  useFrame(() => {
    const t = useFilm.getState().t
    const s = stage

    // tower 2 follows the script
    const door = doorAt(t)
    if (door !== lastDoor.current) {
      lastDoor.current = door
      useControlStore.setState({ door: [null, door] })
    }
    SHUTTERS[FILM_TOWER] = shutterAt(t)
    const offset = chainOffset(t, s.layout.pitch)
    const deck = s.palletAt(offset, tmp.a)
    const parkedYaw = s.yaw + Math.PI

    // the car: road, gate, onto the pallet, then riding it
    let pos = tmp.b
    let yaw = 0
    let dist = 0
    let steer = 0
    if (t < T.gate) {
      const d = cruiseThenBrake(t, T.drive, T.gate, s.roadLen)
      const k = d / s.roadLen
      pos.copy(s.road.getPointAt(k))
      const tan = s.road.getTangentAt(k)
      yaw = Math.atan2(tan.x, tan.z)
      const ahead = s.road.getTangentAt(Math.min(1, k + 0.4 / s.roadLen))
      const behind = s.road.getTangentAt(Math.max(0, k - 0.4 / s.roadLen))
      const turn = Math.atan2(ahead.x, ahead.z) - Math.atan2(behind.x, behind.z)
      steer = THREE.MathUtils.clamp(Math.atan((Math.atan2(Math.sin(turn), Math.cos(turn)) / 0.8) * 2.7 * scale), -0.55, 0.55)
      dist = d
    } else if (t < T.parked) {
      const d = s.inLen * smooth((t - T.driveIn) / (T.parked - T.driveIn))
      const k = d / s.inLen
      pos.copy(s.G).lerp(flat(deck).setY(deck.y), k)
      // level on the road, then up the pallet's ramp over the last two metres
      pos.y = lerp(ROAD_Y, deck.y, smooth((d - (s.inLen - 2.6)) / 2))
      yaw = parkedYaw
      dist = s.roadLen + d
    } else {
      pos.copy(deck)
      yaw = parkedYaw
      dist = s.roadLen + s.inLen
    }
    car.root.visible = t >= T.drive
    car.root.position.copy(pos)
    car.root.rotation.set(0, yaw, 0)
    car.root.scale.setScalar(scale)
    rollWheels(car, dist, steer, scale)

    // charger rides on the pallet, beside the car's right rear
    charger.position.copy(deck).addScaledVector(s.right, 1.05).addScaledVector(s.out, s.half + 0.3)
    charger.rotation.y = s.yaw + Math.PI / 2
    const socket = tmp.c.copy(charger.position).setY(charger.position.y + 0.9)
    const port = car.root.localToWorld(new THREE.Vector3(-car.width / 2 - 0.02, 0.82, -(CARS.atto.length / 2 - 0.7)))

    // the driver
    const p = poseOnRoute(t, s.route.start, s.route.legs)
    figure.set({ ...p, y: 0.08 })
    figure.root.visible = t >= T.exit && t < T.leave + 12
    figure.root.updateMatrixWorld(true)

    // cable: from the socket to the hand while carried, then to the port
    const carried = t >= T.charger + 0.45 && t < T.plug
    const plugged = t >= T.plug
    cable.visible = carried || plugged
    if (cable.visible) {
      const end = plugged ? port : figure.hand.getWorldPosition(new THREE.Vector3())
      const mid = socket.clone().lerp(end, 0.5)
      mid.y = Math.min(socket.y, end.y) - 0.45
      cable.geometry.dispose()
      cable.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(socket, mid, end), 24, 0.03, 8)
    }
    plug.visible = plugged
    plug.position.copy(port)
    ;(plug.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + 0.6 * Math.sin(t * 5) ** 2

    if (ring.current) {
      const on = t >= T.gate - 0.5 && t < T.pallet + 1
      ring.current.visible = on
      ring.current.position.copy(s.G).setY(0.1)
      ring.current.scale.setScalar(1 + 0.08 * Math.sin(t * 4))
    }
    const show = t >= T.gate + 0.4 && t < T.pallet + 0.8
    if (show !== vision) setVision(show)

    shoot(camera, t, s, pos, yaw, figure.root.position, deck)
  })

  return (
    <>
      <primitive object={car.root}>
        {vision && (
          <Html position={car.plateFront.toArray()} center zIndexRange={[20, 0]}>
            <div className="film-vision">
              <span className="film-vision__box" />
              <span className="film-vision__label">{FILM_PLATE} · 97% · matches booking</span>
            </div>
          </Html>
        )}
      </primitive>
      <primitive object={figure.root} />
      <primitive object={charger} />
      <primitive object={cable} />
      <primitive object={plug} />
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2.6, 2.72, 64]} />
        <meshBasicMaterial color="#3d74e0" transparent opacity={0.6} />
      </mesh>
      <BookingMarker top={stage.top} />
    </>
  )
}

/** "Held for you" tag over Tower 2 while the driver books. */
function BookingMarker({ top }: { top: THREE.Vector3 }) {
  const t = useFilm((s) => s.t)
  if (t < T.plan + 1 || t >= T.drive + 1) return null
  return (
    <Html position={[top.x, top.y + 3, top.z]} center zIndexRange={[20, 0]}>
      <div className="film-marker"><b>Tower 2 · pallet 9</b><span>Held for you, 08:40 to 16:40</span></div>
    </Html>
  )
}

type Stage = ReturnType<typeof useStage>
const ease = smooth

/** The camera for each shot. Cuts between shots, moves within them. */
function shoot(cam: THREE.PerspectiveCamera, t: number, s: Stage, car: THREE.Vector3, carYaw: number, walker: THREE.Vector3, deck: THREE.Vector3) {
  const at = (from: number, to: number) => ease((t - from) / (to - from))
  const heading = new THREE.Vector3(Math.sin(carYaw), 0, Math.cos(carYaw))
  const side = new THREE.Vector3().crossVectors(heading, Y) // car's right
  const base = flat(s.P)
  let pos: THREE.Vector3
  let look: THREE.Vector3
  let fov = 38
  if (t < T.book) {
    // title: high and wide over the site, drifting
    const k = t / T.book
    pos = base.clone().addScaledVector(s.out, 95).addScaledVector(s.u, 40 - 25 * k).setY(70 - 8 * k)
    look = base.clone().setY(8)
  } else if (t < T.drive) {
    // booking: descend toward Tower 2
    const k = at(T.book, T.drive)
    pos = base.clone().addScaledVector(s.out, lerp(80, 34, k)).addScaledVector(s.u, lerp(-40, -22, k)).setY(lerp(55, 20, k))
    look = base.clone().setY(lerp(10, 12, k))
  } else if (t < T.drive + 6) {
    // tracking alongside, low, to see the tyres roll
    pos = car.clone().addScaledVector(side, -6.2).addScaledVector(heading, 1.5).setY(0.9)
    look = car.clone().addScaledVector(heading, 0.6).setY(0.55)
    fov = 34
  } else if (t < T.drive + 10) {
    // drone alongside, from the strip side, clear of the roadside trees
    pos = car.clone().addScaledVector(side, 9).addScaledVector(heading, -5).setY(7.5)
    look = car.clone().addScaledVector(heading, 3).setY(0.6)
  } else if (t < T.gate) {
    // waiting at the strip as the car turns in
    pos = s.G.clone().addScaledVector(s.out, 4.5).addScaledVector(s.u, 6.5).setY(1.5)
    look = car.clone().setY(0.8)
    fov = 40
  } else if (t < T.pallet) {
    // the gate camera's view of the front plate, from over the door
    pos = s.G.clone().addScaledVector(s.out, -3.05).addScaledVector(s.u, 0.55).setY(1.7)
    look = s.G.clone().addScaledVector(s.out, -1.8).setY(0.5)
    fov = lerp(56, 46, at(T.gate, T.gate + 3))
  } else if (t < T.driveIn) {
    // wide and low from the road: the pallet comes down
    pos = s.G.clone().addScaledVector(s.out, 8.5).addScaledVector(s.u, -5).setY(3.2)
    look = base.clone().setY(lerp(11, 2.2, at(T.pallet, T.driveIn - 0.8)))
    fov = 48
  } else if (t < T.exit) {
    // side-on as the car drives onto the pallet
    const mid = s.G.clone().lerp(base, 0.55)
    pos = mid.clone().addScaledVector(s.u, -9.5).addScaledVector(s.out, 2.5).setY(1.9)
    look = car.clone().setY(0.8)
    fov = 36
  } else if (t < T.leave + 1) {
    // the driver gets out and plugs in
    pos = base.clone().addScaledVector(s.out, s.half + 5).addScaledVector(s.right, -1.4).setY(2.2)
    look = base.clone().addScaledVector(s.out, s.half + 0.1).addScaledVector(s.right, 0.8).setY(0.8)
    fov = 42
  } else if (t < T.lapse) {
    // follow the driver walking away, the tower behind
    pos = walker.clone().addScaledVector(s.out, 6).addScaledVector(s.u, 2.5).setY(1.7)
    look = walker.clone().addScaledVector(s.u, 1).setY(1.6)
    fov = 40
  } else if (t < T.pay) {
    // the lift and the time lapse: low and wide on the tower, easing in
    const k = at(T.lapse, T.pay)
    pos = base.clone().addScaledVector(s.out, lerp(40, 34, k)).addScaledVector(s.u, lerp(-14, -9, k)).setY(lerp(6, 8, k))
    look = deck.clone().lerp(base.clone().setY(12), 0.5)
    fov = 50
  } else {
    // pay and the end: the car back at the door, then rise away
    const k = at(T.pay + 3, T.total)
    pos = base.clone().addScaledVector(s.out, lerp(16, 60, k)).addScaledVector(s.u, lerp(-8, -30, k)).setY(lerp(3, 34, k))
    look = base.clone().setY(lerp(2, 10, k))
    fov = 40
  }
  cam.position.copy(pos)
  cam.lookAt(look)
  if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix() }
}

