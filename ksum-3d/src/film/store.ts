import { create } from 'zustand'

/** Film time in seconds. The 3D rig reads it every frame; the overlay re-renders from it. */
export const useFilm = create<{ t: number }>()(() => ({ t: 0 }))
