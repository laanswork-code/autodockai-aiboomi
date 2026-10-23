/*
 * The control room's pipeline, wired once:
 *
 *   scenario player -> bus -> decision step -> bus -> tower orchestrator -> store -> 3D twin
 *
 * The player (here) and the operator (the review queue) only publish events;
 * the decision step (api.ts) and the tower orchestrator (orchestrator.ts)
 * subscribe to them.
 */
import { connectDecisionStep } from './api.ts'
import { SCENARIOS } from './demoArrivals.ts'
import { createEventBus, type JevEvent } from './eventBus.ts'
import { connectTowerOrchestrator } from './orchestrator.ts'
import type { DecisionKind, ScenarioName } from './types.ts'
import { useControlStore, type FeedItem } from './useControlStore.ts'

export const bus = createEventBus<JevEvent>()
connectDecisionStep(bus)
connectTowerOrchestrator(bus)

/** Scenario player: start a scenario, or reset with null. */
export const playScenario = (scenario: ScenarioName | null) => bus.publish({ type: 'scenario_changed', scenario })

/** Scenario player: publish the running scenario's next arrival, or stop at the end. */
export function playNext() {
  const { scenario, cursor, busy, setPlaying } = useControlStore.getState()
  if (!scenario || busy) return
  const arrival = SCENARIOS[scenario].arrivals[cursor]
  if (!arrival) { setPlaying(false); return }
  bus.publish({ type: 'arrival', arrival })
}

/** The operator's call on a held decision. Override applies the rules value. */
export const resolveReview = (item: FeedItem, kind: DecisionKind, action: 'approve' | 'override') =>
  bus.publish({ type: 'review_resolved', arrivalId: item.arrival.id, plate: item.arrival.bookedPlate, kind, action })
