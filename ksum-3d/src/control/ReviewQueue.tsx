import { useMemo } from 'react'
import { KIND_LABEL, valueText } from './format.ts'
import type { DecisionKind } from './types.ts'
import { AUTO_THRESHOLD } from './types.ts'
import { needsReview, useControlStore, type FeedItem } from './useControlStore.ts'

const KINDS: DecisionKind[] = ['bay', 'charge', 'price', 'anomaly']

/** Why a decision is waiting: low confidence, or a raised anomaly flag. */
function reason(item: FeedItem, kind: DecisionKind) {
  const d = item.decisions[kind]
  if (d.mode === 'review') return `Confidence ${Math.round(d.confidence * 100)}%, auto needs ${Math.round(AUTO_THRESHOLD[kind] * 100)}%`
  return `Anomaly flagged: ${d.why}`
}

/** Decisions held for a human, oldest first. Override applies the rules value. */
export function ReviewQueue() {
  const feed = useControlStore((s) => s.feed)
  const resolve = useControlStore((s) => s.resolve)
  const pending = useMemo(
    () => [...feed].reverse().flatMap((item) => KINDS.filter((k) => needsReview(item, k)).map((kind) => ({ item, kind }))),
    [feed],
  )
  return (
    <section className="queue" aria-label="Operator review queue">
      <h3>Operator review <span className="count">{pending.length}</span></h3>
      {pending.length === 0 && <p className="muted">Nothing waiting. Confident decisions act on their own.</p>}
      <ul>
        {pending.map(({ item, kind }) => {
          const ruleValue = item.rules[kind].value
          const same = JSON.stringify(ruleValue) === JSON.stringify(item.decisions[kind].value)
          const clearOnly = kind === 'anomaly' && same
          return (
            <li key={`${item.arrival.id}-${kind}`} className="qitem">
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
                <button type="button" className="btn btn--go" onClick={() => resolve(item.arrival.id, kind, 'approve')}>Approve</button>
                <button type="button" className="btn" disabled={same && !clearOnly}
                  title={clearOnly ? 'Operator checked the car: clear the flag' : same ? 'Rules agree with this decision' : 'Apply the rules value instead'}
                  onClick={() => resolve(item.arrival.id, kind, 'override')}>{clearOnly ? 'Clear flag' : 'Override'}</button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
