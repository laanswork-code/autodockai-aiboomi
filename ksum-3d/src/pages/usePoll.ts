import { useEffect, useState } from 'react'

export interface Poll<T> { data: T | null; error: string | null; at: number | null }

/**
 * GET `url` now and every `ms` while the tab is visible. Keeps the last good
 * data on a failed poll so the page does not flash empty.
 */
export function usePoll<T>(url: string, ms: number): Poll<T> {
  const [state, setState] = useState<Poll<T>>({ data: null, error: null, at: null })
  useEffect(() => {
    let alive = true
    let ctrl: AbortController | null = null
    // Last body seen: an unchanged poll keeps the same `data` object, so nothing downstream re-renders.
    let last = ''
    const tick = async () => {
      if (document.visibilityState !== 'visible') return
      ctrl?.abort()
      ctrl = new AbortController()
      try {
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const text = await res.text()
        if (!alive) return
        if (text === last) {
          setState((s) => (s.error ? { ...s, error: null, at: Date.now() } : s))
          return
        }
        const data = JSON.parse(text) as T
        last = text
        setState({ data, error: null, at: Date.now() })
      } catch (e) {
        if (alive && !(e instanceof DOMException && e.name === 'AbortError')) {
          setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), at: Date.now() }))
        }
      }
    }
    tick()
    const id = window.setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => { alive = false; ctrl?.abort(); window.clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [url, ms])
  return state
}
