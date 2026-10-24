import { useEffect } from 'react'
import type { JevUsage } from './types.ts'
import { useControlStore } from './useControlStore.ts'

/** "$0.01160" while under a dollar: at $0.00008 a decision, cents alone would sit still for 125 decisions. */
/** Indian digit grouping, as on the rest of the page: 1,26,538. */
const n = (x: number) => x.toLocaleString('en-IN')
const usd = (x: number) => `$${x < 1 ? x.toFixed(5) : x.toFixed(2)}`

/**
 * Cost per decision, live: real Jev calls on the decision server since it
 * started. Seeded from /api/health, then refreshed by every /api/decide reply.
 */
export function CostCounter() {
  const usage = useControlStore((s) => s.jevUsage)
  const setJevUsage = useControlStore((s) => s.setJevUsage)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/health', { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { jev?: JevUsage } | null) => {
        // a decision reply may have landed first; it is never older than this
        if (body?.jev && !useControlStore.getState().jevUsage) setJevUsage(body.jev)
      })
      .catch(() => {}) // no server: the counter just stays empty
    return () => ctrl.abort()
  }, [setJevUsage])

  if (!usage) return null
  return (
    <div className="cost" aria-label="Jev cost per decision">
      <dl className="cost__figs">
        <div><dt>Jev decisions</dt><dd>{n(usage.decisions)}</dd></div>
        <div><dt>Total</dt><dd>{usd(usage.costUsd)}</dd></div>
        <div><dt>Avg latency</dt><dd>{usage.avgLatencyMs === null ? 'No calls yet' : <>{usage.avgLatencyMs}<small>ms</small></>}</dd></div>
      </dl>
      <p className="muted cost__note">
        {n(usage.calls)} call{usage.calls === 1 ? '' : 's'}
        {usage.failures > 0 && `, ${n(usage.failures)} fell back to rules`}
        {usage.inputTokens !== null && `, ${n(usage.inputTokens + (usage.outputTokens ?? 0))} tokens`}
        {' '}since the server started, at {usd(usage.usdPerDecision)} per decision (TypeSafe list price)
      </p>
    </div>
  )
}
