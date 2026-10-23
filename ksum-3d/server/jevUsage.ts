/*
 * Running cost of the Jev decision layer: real calls, decisions, tokens, cost
 * and mean latency since the server started. The SDK reports token usage but
 * not a bill, so cost is decisions times TypeSafe's published price.
 */
import type { Usage } from '@typesafe-ai/sdk'
import type { JevUsage } from '../src/control/types.ts'

/**
 * TypeSafe's published price, about $0.00008 per decision (https://typesafe.ai/,
 * also in docs/PLAN.md). The systemOne response carries tokens, not dollars.
 */
export const JEV_USD_PER_DECISION = 0.00008

export interface UsageCounter {
  /** One successful systemOne call that answered `decisions` questions. */
  record(call: { decisions: number; latencyMs: number; usage: Usage }): void
  /** One call that failed, so the rules decided. */
  fail(): void
  snapshot(): JevUsage
}

const addTokens = (total: number | null, n: number | null | undefined) => (n == null ? total : (total ?? 0) + n)

export function createUsageCounter(): UsageCounter {
  let calls = 0
  let failures = 0
  let decisions = 0
  let latencyMs = 0
  let inputTokens: number | null = null
  let outputTokens: number | null = null
  return {
    record(call) {
      calls += 1
      decisions += call.decisions
      latencyMs += call.latencyMs
      inputTokens = addTokens(inputTokens, call.usage?.input_tokens)
      outputTokens = addTokens(outputTokens, call.usage?.output_tokens)
    },
    fail() {
      failures += 1
    },
    snapshot: () => ({
      calls,
      failures,
      decisions,
      inputTokens,
      outputTokens,
      usdPerDecision: JEV_USD_PER_DECISION,
      // rounded to a millionth of a cent so 24 decisions read 0.00192, not 0.0019200000000000003
      costUsd: Number((decisions * JEV_USD_PER_DECISION).toFixed(8)),
      avgLatencyMs: calls ? Math.round(latencyMs / calls) : null,
    }),
  }
}

/** Totals for the live server's decider. */
export const jevUsage = createUsageCounter()
