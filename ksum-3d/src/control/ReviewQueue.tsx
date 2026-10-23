import { useMemo, useState } from 'react'
import { KIND_LABEL, valueText } from './format.ts'
import type { DecisionKind } from './types.ts'
import { AUTO_THRESHOLD } from './types.ts'
import { resolveReview } from './pipeline.ts'
import { needsReview, useControlStore, type FeedItem } from './useControlStore.ts'

const KINDS: DecisionKind[] = ['bay', 'charge', 'price', 'anomaly']
/** Exit fade before the item leaves the queue; matches .qitem[data-leaving] in index.css. */
const LEAVE_MS = 160

/** Why a decision is waiting: low confidence, or a raised anomaly flag. */
function reason(item: FeedItem, kind: DecisionKind) {
  const d = item.decisions[kind]
  if (d.mode === 'review') return `Confidence ${Math.round(d.confidence * 100)}%, auto needs ${Math.round(AUTO_THRESHOLD[kind] * 100)}%`
  return `Anomaly flagged: ${d.why}`
}

/** Decisions held for a human, oldest first. Override applies the rules value. */
export function ReviewQueue() {
  const feed = useControlStore((s) => s.feed)
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const resolve = (item: FeedItem, kind: DecisionKind, how: 'approve' | 'override') => {
    const key = `${item.arrival.id}-${kind}`
    if (leaving.has(key)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return resolveReview(item, kind, how)
    setLeaving((s) => new Set(s).add(key))
    window.setTimeout(() => {
      resolveReview(item, kind, how)
      setLeaving((s) => { const n = new Set(s); n.delete(key); return n })
    }, LEAVE_MS)
  }
  const pending = useMemo(
    () => [...feed].reverse().flatMap((item) => KINDS.filter((k) => needsReview(item, k)).map((kind) => ({ item, kind }))),
    [feed],
  )
  return (
    <section className="queue" aria-label="Operator review queue">
      <h3>Operator review <span key={pending.length} className="count">{pending.length}</span></h3>
      {pending.length === 0 && <p className="muted">Nothing waiting. Confident decisions act on their own.</p>}
      <ul>
        {pending.map(({ item, kind }) => {
          const ruleValue = item.rules[kind].value
          const same = JSON.stringify(ruleValue) === JSON.stringify(item.decisions[kind].value)
          const clearOnly = kind === 'anomaly' && same
          const key = `${item.arrival.id}-${kind}`
          const gone = leaving.has(key)
          return (
            <li key={key} className="qitem" data-leaving={gone || undefined}>
              <div className="qitem__top">
                <b className="plate">{item.arrival.bookedPlate}</b>
                <span>{KIND_LABEL[kind]}: {valueText(kind, item.decisions[kind].value, item.decisions[kind].mode === 'review')}</span>
              </div>
              <p className="qitem__why">{reason(item, kind)}</p>
              {kind === 'anomaly' && item.arrival.plateRead.text !== item.arrival.bookedPlate && (
                <p className="qitem__why">Camera read {item.arrival.plateRead.text} at {Math.round(item.arrival.plateRead.ocrConfidence * 100)}%</p>
              )}
              {!same && <p className="qitem__why">Rules say: {valueText(kind, ruleValue)}</p>}
              <div className="qitem__act">
                <button type="button" className="btn btn--go" disabled={gone} onClick={() => resolve(item, kind, 'approve')}>Approve</button>
                <button type="button" className="btn" disabled={gone || (same && !clearOnly)}
                  title={clearOnly ? 'Operator checked the car: clear the flag' : same ? 'Rules agree with this decision' : 'Apply the rules value instead'}
                  onClick={() => resolve(item, kind, 'override')}>{clearOnly ? 'Clear flag' : 'Override'}</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
