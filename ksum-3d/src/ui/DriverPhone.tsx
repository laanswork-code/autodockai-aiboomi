import { useState } from 'react'
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

/** The driver phone for the newest car through the decision layer, or sample data before any. */
export function DriverPhone() {
  const latest = useControlStore((s) => s.feed[0])
  const [open, setOpen] = useState(false)
  return (
    <>
      <PhoneToggle open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <div className="phone-dock">
          <Phone
            key={latest?.arrival.id ?? 'sample'}
            arrival={latest?.arrival}
            decisions={latest && settled(latest)}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  )
}
