import { KIND_LABEL, clock, valueText } from './format.ts'
import type { Decision, DecisionKind } from './types.ts'
import { AUTO_THRESHOLD, ESCALATES } from './types.ts'
import { needsReview, type FeedItem } from './useControlStore.ts'

const KINDS: DecisionKind[] = ['bay', 'charge', 'price', 'anomaly']
const RESOLVED_LABEL = { approved: 'Approved', overridden: 'Overridden', cleared: 'Cleared' } as const

/**
 * Confidence as a bar. Decisions that can escalate show a tick where they stop
 * acting on their own; bay and price always act on Jev's best answer.
 */
export function ConfidenceBar({ kind, confidence }: { kind: DecisionKind; confidence: number }) {
  const thr = ESCALATES[kind] ? AUTO_THRESHOLD[kind] : null
  const below = thr !== null && confidence < thr
  return (
    <div className="conf" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={confidence}
      aria-label={`Confidence ${Math.round(confidence * 100)}%${thr === null ? ', always acts' : `, auto at ${Math.round(thr * 100)}%`}`}>
      <div className={`conf__bar ${below ? 'is-low' : ''}`} style={{ width: `${confidence * 100}%` }} />
      {thr !== null && <div className="conf__tick" style={{ left: `${thr * 100}%` }} />}
    </div>
  )
}

function Row({ item, kind }: { item: FeedItem; kind: DecisionKind }) {
  const d = item.decisions[kind] as Decision
  const resolution = item.resolved[kind]
  const review = needsReview(item, kind)
  const changed = resolution === 'overridden' || resolution === 'cleared'
  const state = resolution ? RESOLVED_LABEL[resolution] : review ? 'Needs review' : 'Auto'
  return (
    <li className={`drow ${review ? 'is-review' : ''}`}>
      <span className="drow__k">{KIND_LABEL[kind]}</span>
      <span className="drow__v">
        {valueText(kind, item.final[kind], review)}
        {changed && <s className="drow__was">{valueText(kind, d.value)}</s>}
      </span>
      <span className={`badge badge--${d.source}`}>{d.source}</span>
      <span className={`state state--${review ? 'review' : resolution ?? 'auto'}`}>{state}</span>
      <ConfidenceBar kind={kind} confidence={d.confidence} />
      <span className="drow__conf">{Math.round(d.confidence * 100)}%</span>
      <span className="drow__why">{d.why}</span>
    </li>
  )
}

/** One car at the gate and the four decisions made for it. */
export function DecisionCard({ item }: { item: FeedItem }) {
  const { arrival: a } = item
  return (
    <article className="dcard">
      <header className="dcard__head">
        <b className="plate">{a.bookedPlate}</b>
        <span>{a.vehicle.model}{a.vehicle.ev ? ` · ${a.vehicle.socPct}%` : ''}{a.vehicle.fleet ? ' · robotaxi' : ''}</span>
        <time>{clock(a.t)}</time>
      </header>
      {a.note && <p className="dcard__note">"{a.note}"</p>}
      <ul className="drows">
        {KINDS.map((k) => <Row key={k} item={item} kind={k} />)}
      </ul>
    </article>
  )
}
