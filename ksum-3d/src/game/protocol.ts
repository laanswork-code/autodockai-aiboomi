/*
 * Messages between the game page and the game server (server/game/index.ts).
 * JSON over one WebSocket. Poses go up at about 15 Hz and come back batched;
 * world changes (bookings, pallets, doors) are pushed when they happen.
 */

export type CarKind = 'seal' | 'atto'
export interface PalletCar { plate: string; kind: CarKind; color: string }
export interface TowerState { pallets: (PalletCar | null)[]; door: number }
export type BookingStatus = 'booked' | 'parked' | 'retrieving'
/** `at`: when it was booked (server ms), for the hand-over time on the leaderboard. */
export interface Booking { plate: string; tower: 0 | 1; pallet: number; status: BookingStatus; at: number }
/** Per plate: completed parks and the fastest time from booking to parked. */
export interface PlayerStats { name: string; parks: number; bestMs: number }
export interface WorldState { towers: [TowerState, TowerState]; bookings: Record<string, Booking>; stats: Record<string, PlayerStats> }

/** What a player looks like right now. `car` is set while they drive (or their car stands somewhere). */
export interface Pose {
  x: number; y: number; z: number; yaw: number
  mode: 'foot' | 'car' | 'away'
  walked: number; moving: number
  car?: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number; steer: number; spin: number }
}
export interface PlayerInfo { id: string; name: string; plate: string; kind: CarKind; color: string }

export type ClientMsg =
  | { t: 'hello'; name: string; plate: string; kind: CarKind; color: string }
  | { t: 'pose'; pose: Pose }
  | { t: 'book' }
  | { t: 'park' }
  | { t: 'retrieve' }
  | { t: 'collected' }

export type ServerMsg =
  | { t: 'welcome'; id: string; plate: string; world: WorldState; players: PlayerInfo[] }
  | { t: 'world'; world: WorldState }
  | { t: 'join'; player: PlayerInfo }
  | { t: 'leave'; id: string }
  | { t: 'poses'; poses: Record<string, Pose> }
  | { t: 'error'; message: string }
