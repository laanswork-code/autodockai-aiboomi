/*
 * Game state. React-facing state lives in the zustand store; values that
 * change every frame (positions, speed) live in `live`, a plain object the
 * physics writes and the HUD, minimap, camera and network read.
 */
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import { create } from 'zustand'
import type { Booking, CarKind, PlayerInfo, Pose, WorldState } from './protocol'

export type Mode = 'foot' | 'car'
/** Where my car is: driving around, being carried into a tower, stored on a pallet, or coming back out. */
export type CarState = 'world' | 'docking' | 'stored' | 'undocking'

export interface Me { id: string; name: string; plate: string; kind: CarKind; color: string }

interface GameState {
  me: Me | null
  status: 'login' | 'connecting' | 'playing' | 'offline'
  error: string | null
  world: WorldState | null
  players: Record<string, PlayerInfo>
  mode: Mode
  car: CarState
  phone: boolean
  /** Full-screen map (M). */
  map: boolean
  /** Leaderboard overlay (L). */
  board: boolean
  /** Pause menu (Esc). */
  menu: boolean
  /** What the player last joined with, to fill the login card again after logging out. */
  last: { name: string; plate: string; kind: CarKind; color: string } | null
  /** Booked at least once this visit: until then the car will not drive. */
  hasBooked: boolean
  /** Short line at the top of the screen, GTA style. */
  toast: string | null
  set: (patch: Partial<GameState>) => void
}

export const useGame = create<GameState>()((set) => ({
  me: null,
  status: 'login',
  error: null,
  world: null,
  players: {},
  mode: 'foot',
  car: 'world',
  phone: false,
  map: false,
  board: false,
  menu: false,
  last: null,
  hasBooked: false,
  toast: null,
  set: (patch) => set(patch),
}))

export const myBooking = (s: GameState): Booking | null => (s.me && s.world?.bookings[s.me.plate]) || null

/** Written every frame by the player and the car; read by the camera, HUD, minimap and network. */
export const live = {
  foot: new THREE.Vector3(),
  footYaw: 0,
  walked: 0,
  moving: 0,
  car: new THREE.Vector3(),
  carQuat: new THREE.Quaternion(),
  carYaw: 0,
  /** m/s along the car's nose, negative in reverse. */
  speed: 0,
  steer: 0,
  spin: 0,
  /** False while the car is inside a tower. */
  carVisible: true,
}

/** The physics body of my car while it is on the road (for resetting it, and for test scripts). */
export const handles = { car: null as RapierRigidBody | null }

/** Shutter openness each tower is easing toward; the docking animations set it. */
export const shutterTarget: [number, number] = [0, 0]
/** Which chase-camera preset is in use (V cycles it). */
export const camIndex = { current: 0 }

/** Latest poses of everyone else, straight from the socket (15 Hz); remote avatars smooth toward them. */
export const remote = new Map<string, Pose>()

let toastTimer = 0
export function toast(text: string, ms = 3200) {
  useGame.getState().set({ toast: text })
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => useGame.getState().set({ toast: null }), ms)
}
