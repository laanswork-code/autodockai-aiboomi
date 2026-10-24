import { useEffect, useRef, useState } from 'react'
import type { Decision, DecisionKind, DecisionSet } from '../control/types'
import { useControlStore, type FeedItem } from '../control/useControlStore'
import { Phone, PhoneToggle } from '../phone'

/** An operator's approval or correction replaces the pending decision, so the phone stops saying "confirming". */
function settle<K extends DecisionKind>(item: FeedItem, kind: K): Decision<K> {
  const d = item.decisions[kind]
  return item.resolved[kind] ? { ...d, value: item.final[kind], mode: 'auto' } : d
}

const settled = (item: FeedItem): DecisionSet => ({
  bay: settle(item, 'bay'), charge: settle(item, 'charge'), price: settle(item, 'price'), anomaly: settle(item, 'anomaly'),
})

/**
 * The driver phone for the newest car through the decision layer, or sample data before any.
 * The car is pinned when the phone opens, so new arrivals do not reset a walkthrough;
 * reopening picks up the newest car. Operator resolutions still flow in by id.
 */
export function DriverPhone() {
  const [open, setOpen] = useState(false)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const item = useControlStore((s) => s.feed.find((f) => f.arrival.id === pinnedId))
  const dock = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (!open) setPinnedId(useControlStore.getState().feed[0]?.arrival.id ?? null)
    setOpen(!open)
  }

  useEffect(() => {
    if (!open) return
    // focus moves into the dialog, onto the step's main button
    const el = dock.current?.querySelector<HTMLElement>('.ph-primary')
    el?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <PhoneToggle open={open} onToggle={toggle} />
      {open && (
        <div className="phone-dock" ref={dock}>
          <Phone
            key={item?.arrival.id ?? 'sample'}
            arrival={item?.arrival}
            decisions={item && settled(item)}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  )
}
