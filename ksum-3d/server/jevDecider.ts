/*
 * The Jev decider: one systemOne call per arrival, mapped to a DecisionSet.
 * If Jev errors or runs past the timeout, the rules policy decides instead
 * (source 'rules'), so a car is never left waiting on the model.
 *
 * The optional disk cache stores Jev's raw answers keyed by a hash of the
 * request, so the simulator can replay a day without paying for it twice.
 * Answers (not decisions) are cached, so changing the mapping needs no re-run.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { TypeSafeClient } from '@typesafe-ai/sdk'
import type { Questions, SystemOneResult } from '@typesafe-ai/sdk'
import { baselineDecisions } from '../src/control/baseline.ts'
import type { Arrival, Decider, DecisionSet, SiteState } from '../src/control/types.ts'
import { buildRequest, mapAnswers } from './jev.ts'
import type { JevClient } from './jev.ts'
import { jevUsage } from './jevUsage.ts'
import type { UsageCounter } from './jevUsage.ts'

export const DEFAULT_TIMEOUT_MS = 4000
export const DEFAULT_CACHE_PATH = join(import.meta.dirname, 'data', 'jev-cache.json')
/** Model asked for; the response reports the exact version that answered. */
export const JEV_MODEL = process.env.TYPESAFE_DEFAULT_MODEL || 'jev-latest'

export interface JevDeciderOptions {
  /** Injected client for tests; defaults to a TypeSafeClient created on first use. */
  client?: JevClient
  /** Total budget for one decision, retries included. */
  timeoutMs?: number
  /** Path of the answer cache, or omit to always call Jev. */
  cachePath?: string
  /** Called when Jev fails and the rules policy answers instead. */
  onFallback?: (error: unknown, arrival: Arrival) => void
  /** Counts real calls (not cache hits) and failures, for the cost counter. */
  usage?: UsageCounter
}

interface CachedAnswer { model: string; answers: SystemOneResult<Questions>['answers']; latencyMs: number }

/** Last model version Jev reported, for /api/health. */
export let lastJevModel: string | null = null

function openCache(path: string) {
  let entries: Record<string, CachedAnswer> = {}
  try {
    if (existsSync(path)) entries = JSON.parse(readFileSync(path, 'utf8')) as Record<string, CachedAnswer>
  } catch {
    // A corrupt cache is only lost money, never a reason to stop deciding.
    entries = {}
  }
  return {
    get: (key: string) => entries[key],
    set(key: string, value: CachedAnswer) {
      entries[key] = value
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify(entries))
    },
  }
}

export function createJevDecider(options: JevDeciderOptions = {}): Decider {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const cache = options.cachePath ? openCache(options.cachePath) : null
  let client = options.client
  // Lazy so importing this module never needs the API key.
  const getClient = () => (client ??= new TypeSafeClient({ timeout: timeoutMs, retry: { maxRetries: 1 } }))

  async function ask(arrival: Arrival, state: SiteState): Promise<DecisionSet> {
    const { request, candidates } = buildRequest(arrival, state)
    const key = createHash('sha256').update(JSON.stringify({ model: JEV_MODEL, request })).digest('hex')
    const hit = cache?.get(key)
    if (hit) return mapAnswers(arrival, state, candidates, hit, hit.latencyMs)
    const started = performance.now()
    const result = await getClient().systemOne({ ...request, model: JEV_MODEL }, { signal: AbortSignal.timeout(timeoutMs) })
    const latencyMs = Math.round(performance.now() - started)
    lastJevModel = result.model
    // Map before caching so a malformed response is never stored.
    const decisions = mapAnswers(arrival, state, candidates, result, latencyMs)
    options.usage?.record({ decisions: Object.keys(result.answers).length, latencyMs, usage: result.usage })
    cache?.set(key, { model: result.model, answers: result.answers, latencyMs })
    return decisions
  }

  return {
    name: 'jev',
    async decide(arrival, state) {
      try {
        return await ask(arrival, state)
      } catch (error) {
        options.usage?.fail()
        options.onFallback?.(error, arrival)
        const reason = error instanceof Error ? error.name : 'error'
        const rules = baselineDecisions(arrival, state)
        for (const d of Object.values(rules)) d.why = `${d.why} (Jev unavailable: ${reason}, rules fallback)`
        return rules
      }
    },
  }
}

/** Live decider used by the server: no cache, so every decision is a fresh judgment. */
export const jevDecider: Decider = createJevDecider({
  usage: jevUsage,
  onFallback: (error, arrival) => console.warn(`[jev] fallback for ${arrival.id}:`, error instanceof Error ? error.message : error),
})
