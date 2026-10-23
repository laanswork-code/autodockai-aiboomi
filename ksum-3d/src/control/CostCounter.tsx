import { useEffect } from 'react'
import type { JevUsage } from './types.ts'
import { useControlStore } from './useControlStore.ts'

/** "$0.01160" while under a dollar: at $0.00008 a decision, cents alone would sit still for 125 decisions. */
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
  const avg = usage.avgLatencyMs === null ? 'no calls yet' : `${usage.avgLatencyMs} ms avg`
  return (
    <div className="cost" aria-label="Jev cost per decision">
      <p className="cost__line">Jev: {usage.decisions} decisions, {usd(usage.costUsd)} total, {avg}</p>
      <p className="muted cost__note">
        {usage.calls} call{usage.calls === 1 ? '' : 's'}
        {usage.failures > 0 && `, ${usage.failures} fell back to rules`}
        {usage.inputTokens !== null && `, ${usage.inputTokens + (usage.outputTokens ?? 0)} tokens`}
        {' '}since the server started, at {usd(usage.usdPerDecision)} per decision (TypeSafe list price)
      </p>
    </div>
  )
}
