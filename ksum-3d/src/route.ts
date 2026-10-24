import { useSyncExternalStore } from 'react'

/*
 * A few pages, so a tiny pushState router instead of a dependency. Vite's dev
 * server (and any SPA host) serves index.html for unknown paths.
 */
export type Route = '/' | '/how' | '/problems' | '/dashboard'
const ROUTES: Route[] = ['/', '/how', '/problems', '/dashboard']

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  window.addEventListener('popstate', notify)
  return () => { listeners.delete(l); window.removeEventListener('popstate', notify) }
}
const current = (): Route => {
  const p = window.location.pathname.replace(/\/+$/, '') || '/'
  return (ROUTES as string[]).includes(p) ? (p as Route) : '/'
}

export const useRoute = () => useSyncExternalStore(subscribe, current)

export function navigate(to: Route) {
  if (to === current()) return
  window.history.pushState(null, '', to)
  notify()
  window.scrollTo(0, 0)
}
