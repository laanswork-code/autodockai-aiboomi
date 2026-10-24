/*
 * The game loop inside the physics world: who is on foot or driving, the
 * hand-over at the pink circle, the car coming back out of the tower, and a
 * chase camera that follows behind so no mouse is needed.
 *
 * Keys: W/S or arrows to move, A/D to turn, Shift to run, Space handbrake,
 * E to get in or out, P for the phone, M for the map, L for the leaderboard, V to change the camera,
 * R to right the car. The car will not drive until you have booked a slot.
 */
import { useFrame, useThree } from '@react-three/fiber'
import type { RapierRigidBody } from '@react-three/rapier'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { DOCKED } from '../scene/RotaryTower'
import { Foot } from './Foot'
import { DockingCar, GameTowers, UndockingCar } from './GameTowers'
import { Guidance } from './Guidance'
import { onKey } from './input'
import { DROP_RADIUS, dropSpot, randomSpawn } from './layout'
import { send } from './net'
import { Others } from './Others'
import { StaticWorld } from './StaticWorld'
import { camIndex, handles, live, myBooking, toast, useGame } from './store'
import { Vehicle } from './Vehicle'

const ENTER_RANGE = 3.4
/** Camera presets: distance behind, height, and how high to look. */
const CAMS = [
  { car: [7.2, 2.6, 1.3], foot: [4.4, 2.1, 1.5] },
  { car: [11, 4.2, 1.2], foot: [7, 3.4, 1.3] },
  { car: [16, 11, 0.5], foot: [12, 9, 0.5] },
] as const

type Spot = { x: number; z: number; yaw: number }

function ChaseCam() {
  const camera = useThree((s) => s.camera)
  const yaw = useRef(0)
  const look = useRef(new THREE.Vector3())
  const first = useRef(true)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const { mode } = useGame.getState()
    const driving = mode === 'car'
    const at = driving ? live.car : live.foot
    const heading = driving ? live.carYaw : live.footYaw
    const [dist, height, lookUp] = CAMS[camIndex.current][driving ? 'car' : 'foot']
    // the camera swings round behind the heading on its own; slower in reverse so it does not whip
    const rate = driving && live.speed < -0.5 ? 1.2 : 3.2
    yaw.current += Math.atan2(Math.sin(heading - yaw.current), Math.cos(heading - yaw.current)) * (first.current ? 1 : 1 - Math.exp(-dt * rate))
    const want = new THREE.Vector3(at.x - Math.sin(yaw.current) * dist, at.y + height, at.z - Math.cos(yaw.current) * dist)
    const lookAt = new THREE.Vector3(at.x, at.y + lookUp, at.z)
    if (first.current) { camera.position.copy(want); look.current.copy(lookAt); first.current = false }
    camera.position.lerp(want, 1 - Math.exp(-dt * 7))
    look.current.lerp(lookAt, 1 - Math.exp(-dt * 12))
    camera.lookAt(look.current)
  })
  return null
}

export function Play() {
  const me = useGame((s) => s.me)!
  const mode = useGame((s) => s.mode)
  const carState = useGame((s) => s.car)
  const booking = useGame(myBooking)
  const set = useGame((s) => s.set)
  const hasBooked = useGame((s) => s.hasBooked)
  // a different start for every login, so players do not pile up in one spot
  const [start] = useState(() => randomSpawn())
  const [footSpawn, setFootSpawn] = useState<Spot>(start.foot)
  const [carSpawn, setCarSpawn] = useState<Spot>(start.car)
  const [footKey, setFootKey] = useState(0)
  const [carKey, setCarKey] = useState(0)
  const [dockFrom, setDockFrom] = useState<Spot | null>(null)
  const carBody = useRef<RapierRigidBody | null>(null)
  const onBody = useCallback((b: RapierRigidBody | null) => { carBody.current = b; handles.car = b }, [])
  const ready = useRef(0)

  // a car already parked under this plate (from an earlier visit) starts in its tower
  useEffect(() => {
    const b = myBooking(useGame.getState())
    if (b && b.status !== 'booked') { set({ car: 'stored' }); live.carVisible = false }
    else live.carVisible = true
  }, [set])

  useEffect(() => {
    const offE = onKey('e', () => {
      const s = useGame.getState()
      if (s.mode === 'foot' && s.car === 'world') {
        if (live.foot.distanceTo(live.car) > ENTER_RANGE) return toast('Walk up to your car to get in')
        // no driving off until there is somewhere to park
        if (!s.hasBooked) { s.set({ mode: 'car', phone: true }); return toast('Book a slot to start driving', 4000) }
        s.set({ mode: 'car' })
      } else if (s.mode === 'car') {
        if (Math.abs(live.speed) > 2) return toast('Slow down to get out')
        // driver's door on the right, as in Indian cars
        const yaw = live.carYaw
        setFootSpawn({ x: live.car.x - Math.cos(yaw) * 1.7, z: live.car.z + Math.sin(yaw) * 1.7, yaw })
        setFootKey((k) => k + 1)
        s.set({ mode: 'foot' })
      }
    })
    const offP = onKey('p', () => { const s = useGame.getState(); s.set({ phone: !s.phone }) })
    const offM = onKey('m', () => { const s = useGame.getState(); s.set({ map: !s.map }) })
    const offL = onKey('l', () => { const s = useGame.getState(); s.set({ board: !s.board }) })
    // Esc closes whatever is open first; with nothing open it brings up the pause menu
    const offEsc = onKey('escape', () => {
      const s = useGame.getState()
      if (s.phone || s.map || s.board) s.set({ phone: false, map: false, board: false })
      else s.set({ menu: !s.menu })
    })
    const offV = onKey('v', () => { camIndex.current = (camIndex.current + 1) % CAMS.length })
    const offR = onKey('r', () => {
      const b = carBody.current
      if (!b || useGame.getState().car !== 'world') return
      const p = b.translation()
      b.setTranslation({ x: p.x, y: p.y + 1.2, z: p.z }, true)
      b.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, live.carYaw, 0)), true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
    })
    return () => { offE(); offP(); offM(); offL(); offEsc(); offV(); offR() }
  }, [])

  useFrame((_, dt) => {
    const s = useGame.getState()
    const b = myBooking(s)
    // hand-over: stopped inside the pink circle of the booked tower
    if (b?.status === 'booked' && s.mode === 'car' && s.car === 'world') {
      const d = dropSpot(b.tower)
      if (Math.hypot(live.car.x - d.x, live.car.z - d.z) < DROP_RADIUS && Math.abs(live.speed) < 1.2) {
        const side = { x: d.x + Math.cos(d.yaw) * 4.2, z: d.z - Math.sin(d.yaw) * 4.2, yaw: d.yaw + Math.PI }
        setDockFrom({ x: live.car.x, z: live.car.z, yaw: live.carYaw })
        setFootSpawn(side)
        setFootKey((k) => k + 1)
        s.set({ mode: 'foot', car: 'docking', phone: false })
        toast(`Hand-over at Tower ${b.tower + 1}: the tower parks it for you`)
      }
    }
    // retrieval: once the tower has turned the car's pallet to the door for half a second, it drives out
    if (b?.status === 'retrieving' && s.car === 'stored' && s.world?.towers[b.tower].door === b.pallet && DOCKED[b.tower]) {
      ready.current += dt
      if (ready.current > 0.5) { ready.current = 0; s.set({ car: 'undocking' }); live.carVisible = true }
    } else ready.current = 0
  })

  const parked = useCallback(() => {
    send({ t: 'park' })
    live.carVisible = false
    set({ car: 'stored' })
    toast('Parked. Press P and Retrieve when you want it back')
  }, [set])
  const collected = useCallback(() => {
    const b = myBooking(useGame.getState())
    if (!b) return
    send({ t: 'collected' })
    setCarSpawn(dropSpot(b.tower))
    setCarKey((k) => k + 1)
    set({ car: 'world' })
    toast('Your car is out. Press E to get in')
  }, [set])

  return (
    <>
      <StaticWorld />
      <GameTowers />
      <Others />
      <Guidance />
      {mode === 'foot' && <Foot key={`f${footKey}`} color={me.color} spawn={footSpawn} />}
      {carState === 'world' && (
        <Vehicle key={`c${carKey}`} kind={me.kind} color={me.color} plate={me.plate} spawn={carSpawn} driving={mode === 'car' && hasBooked} onBody={onBody} />
      )}
      {carState === 'docking' && booking && dockFrom && (
        <DockingCar kind={me.kind} color={me.color} plate={me.plate} tower={booking.tower} from={dockFrom} onDone={parked} />
      )}
      {carState === 'undocking' && booking && (
        <UndockingCar kind={me.kind} color={me.color} plate={me.plate} tower={booking.tower} onDone={collected} />
      )}
      <ChaseCam />
    </>
  )
}
