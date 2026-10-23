/*
 * Tower orchestrator: the only part of the pipeline that moves the towers. It
 * turns scenario changes, decisions and operator calls from the bus into store
 * updates (the 3D twin renders the store), then announces what the towers did:
 * a pallet brought to the door for a car, a charger switched on.
 */
import type { EventBus, JevEvent } from './eventBus.ts'
import { needsReview, useControlStore } from './useControlStore.ts'

/** The car's pallet as the store now has it, or null if it is not in the feed. */
function carOn(arrivalId: string) {
  const { feed, towers } = useControlStore.getState()
  const item = feed.find((f) => f.arrival.id === arrivalId)
  if (!item) return null
  const { tower, pallet } = item.final.bay
  return {
    item,
    docked: !needsReview(item, 'bay'),
    charging: towers[tower].pallets[pallet].charging,
    at: { arrivalId, plate: item.arrival.bookedPlate, tower, pallet },
  }
}

/** Subscribes the orchestrator to the bus. Returns an unsubscribe function. */
export function connectTowerOrchestrator(bus: EventBus<JevEvent>) {
  const offs = [
    bus.on('scenario_changed', ({ scenario }) => {
      const { start, reset } = useControlStore.getState()
      if (scenario) start(scenario)
      else reset()
    }),

    bus.on('decided', ({ arrival, decisions, rules }) => {
      // Docks the car, or holds its pallet while the bay waits for an operator.
      useControlStore.getState().ingest({ arrival, decisions, rules })
      const car = carOn(arrival.id)
      if (!car?.docked) return
      bus.publish({ type: 'pallet_to_door', ...car.at })
      if (car.charging) bus.publish({ type: 'charging_started', ...car.at })
    }),

    bus.on('review_resolved', ({ arrivalId, kind, action }) => {
      const before = carOn(arrivalId)
      if (!before || before.item.resolved[kind]) return
      useControlStore.getState().resolve(arrivalId, kind, action)
      const after = carOn(arrivalId)
      if (!after?.docked) return
      if (kind === 'bay') bus.publish({ type: 'pallet_to_door', ...after.at })
      if (after.charging && !(before.docked && before.charging)) bus.publish({ type: 'charging_started', ...after.at })
    }),
  ]
  return () => offs.forEach((off) => off())
}
