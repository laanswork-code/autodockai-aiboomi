/*
 * A small typed event bus, and the events of the Jev pipeline:
 *
 *   scenario player -> bus -> decision step (Jev, or rules) -> bus -> tower orchestrator -> 3D twin
 *
 * The player publishes `arrival`; the decision step answers with `decided` and
 * a `review_requested` per decision held for an operator; the tower
 * orchestrator turns decisions and operator calls into tower moves and
 * announces them (`pallet_to_door`, `charging_started`). Every event is kept in
 * a short history for the control room's event log.
 *
 * Pure TS with type-only imports, so it runs in the browser and in Node.
 */
import { clock, KIND_LABEL } from './format.ts'
import type { Arrival, DecisionKind, DecisionSet, ScenarioName } from './types.ts'

interface CarAt { arrivalId: string; plate: string; tower: 0 | 1; pallet: number }

export type JevEvent =
  /** A scenario started (or null: the control room was reset). */
  | { type: 'scenario_changed'; scenario: ScenarioName | null }
  /** A car reached the gate. */
  | { type: 'arrival'; arrival: Arrival }
  /** All four decisions for a car. `rules` is the rules policy on the same state; `reachable` false means the rules decided. */
  | { type: 'decided'; arrival: Arrival; decisions: DecisionSet; rules: DecisionSet; reachable: boolean }
  /** One decision is waiting for an operator. */
  | { type: 'review_requested'; arrivalId: string; plate: string; kind: DecisionKind }
  /** The operator approved a held decision, or overrode it with the rules answer. */
  | { type: 'review_resolved'; arrivalId: string; plate: string; kind: DecisionKind; action: 'approve' | 'override' }
  /** A tower turned a car's pallet to its door and the car docked. */
  | ({ type: 'pallet_to_door' } & CarAt)
  /** A docked car's charger switched on. */
  | ({ type: 'charging_started' } & CarAt)
  /** A car left its pallet. The demo scenarios end before anyone leaves, so the control room does not publish it yet. */
  | ({ type: 'departed' } & CarAt)

export type JevEventType = JevEvent['type']

/** An event as the history keeps it: numbered in publish order. */
export interface Logged<E> { seq: number; event: E }

type Handler<E> = (event: E) => void

export interface EventBus<E extends { type: string }> {
  /** Subscribe to one event type. Returns an unsubscribe function. */
  on<T extends E['type']>(type: T, handler: Handler<Extract<E, { type: T }>>): () => void
  /** Subscribe to every event. Returns an unsubscribe function. */
  onAny(handler: Handler<E>): () => void
  /**
   * Publish an event. Events published from inside a handler wait until the
   * current event has reached every handler, so subscribers see events in
   * publish order.
   */
  publish(event: E): void
  /** The newest events, oldest first. A new array after each publish. */
  history(): readonly Logged<E>[]
  /** Called after each publish (for useSyncExternalStore). Returns an unsubscribe function. */
  watch(listener: () => void): () => void
}

export function createEventBus<E extends { type: string }>({ keep = 50 } = {}): EventBus<E> {
  const handlers = new Map<string, Set<Handler<E>>>()
  const any = new Set<Handler<E>>()
  const watchers = new Set<() => void>()
  const queue: E[] = []
  let log: readonly Logged<E>[] = []
  let seq = 0
  let dispatching = false

  const add = <H>(set: Set<H>, h: H) => { set.add(h); return () => { set.delete(h) } }
  const call = (h: Handler<E>, event: E) => {
    // one broken subscriber must not stop the pipeline
    try { h(event) } catch (err) { console.error(`event bus: ${event.type} handler failed`, err) }
  }

  return {
    on(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set())
      return add(handlers.get(type)!, handler as Handler<E>)
    },
    onAny: (handler) => add(any, handler),
    watch: (listener) => add(watchers, listener),
    history: () => log,
    publish(event) {
      queue.push(event)
      if (dispatching) return
      dispatching = true
      try {
        for (let next = queue.shift(); next; next = queue.shift()) {
          log = [...log, { seq: ++seq, event: next }].slice(-keep)
          for (const h of [...(handlers.get(next.type) ?? [])]) call(h, next)
          for (const h of [...any]) call(h, next)
          for (const w of [...watchers]) w()
        }
      } finally {
        dispatching = false
      }
    },
  }
}

const at = (e: CarAt) => `tower ${e.tower + 1}, pallet ${e.pallet + 1}`

/** One line for the event log. */
export function describeEvent(e: JevEvent): string {
  switch (e.type) {
    case 'scenario_changed': return e.scenario ? `Scenario: ${e.scenario}` : 'Scenario reset'
    case 'arrival': return `${e.arrival.bookedPlate} at the gate, ${clock(e.arrival.t)}`
    case 'decided': {
      const jev = Object.values(e.decisions).filter((d) => d.source === 'jev').length
      return `${e.arrival.bookedPlate}: decided, ${e.reachable ? `${jev} of 4 by Jev` : 'by rules (server unreachable)'}`
    }
    case 'review_requested': return `${e.plate}: ${KIND_LABEL[e.kind].toLowerCase()} held for an operator`
    case 'review_resolved': return `${e.plate}: operator ${e.action} on ${KIND_LABEL[e.kind].toLowerCase()}`
    case 'pallet_to_door': return `${e.plate}: tower ${e.tower + 1} brings pallet ${e.pallet + 1} to the door`
    case 'charging_started': return `${e.plate}: charging on ${at(e)}`
    case 'departed': return `${e.plate}: left ${at(e)}`
  }
}
