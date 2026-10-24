/*
 * Keyboard only: no mouse needed to look around, the camera follows behind.
 * Held keys are read every frame; one-shot keys (E, P, V, R) fire handlers.
 */
const held = new Set<string>()
const handlers = new Map<string, () => void>()

const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
}

export function bindInput() {
  const down = (e: KeyboardEvent) => {
    if (typing(e)) return
    const k = e.key.toLowerCase()
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
    if (!held.has(k) && !e.repeat) handlers.get(k)?.()
    held.add(k)
  }
  const up = (e: KeyboardEvent) => held.delete(e.key.toLowerCase())
  const blur = () => held.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
    held.clear()
  }
}

/** Run `fn` when `key` is pressed (not repeated while held). Returns an unbind. */
export function onKey(key: string, fn: () => void) {
  handlers.set(key, fn)
  return () => { if (handlers.get(key) === fn) handlers.delete(key) }
}

const any = (...keys: string[]) => keys.some((k) => held.has(k))

/** -1..1 axes: forward (W / up), turn (D / right is +1). */
export function axes() {
  return {
    forward: (any('w', 'arrowup') ? 1 : 0) - (any('s', 'arrowdown') ? 1 : 0),
    turn: (any('d', 'arrowright') ? 1 : 0) - (any('a', 'arrowleft') ? 1 : 0),
    run: any('shift'),
    handbrake: any(' '),
  }
}
