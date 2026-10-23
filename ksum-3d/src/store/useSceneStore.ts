import { create } from 'zustand'
import type { ViewName } from '../config/site'

export type Mode = 'today' | 'autodock'
export interface TowerSize { w: number; d: number; h: number }

interface SceneState {
  mode: Mode
  view: ViewName
  /** Bumped on every view click so re-selecting the same view still moves the camera. */
  viewNonce: number
  spinning: boolean
  /** Measured from the GLB once it loads; drives tower placement and the stats. */
  towerSize: TowerSize | null
  setMode: (mode: Mode) => void
  setView: (view: ViewName) => void
  toggleSpin: () => void
  setTowerSize: (size: TowerSize) => void
}

export const useSceneStore = create<SceneState>()((set) => ({
  mode: 'autodock',
  view: 'overview',
  viewNonce: 0,
  spinning: true,
  towerSize: null,
  setMode: (mode) => set({ mode }),
  setView: (view) => set((s) => ({ view, viewNonce: s.viewNonce + 1 })),
  toggleSpin: () => set((s) => ({ spinning: !s.spinning })),
  setTowerSize: (towerSize) => set({ towerSize }),
}))
