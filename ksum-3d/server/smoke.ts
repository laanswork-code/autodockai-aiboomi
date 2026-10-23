/*
 * Live smoke test: two real Jev calls (a quick stop and a doubtful overnight
 * stay), printed as typed decisions, with the raw responses recorded to
 * server/fixtures/live-sample.json for the offline tests.
 * Run: node --env-file=../.env server/smoke.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TypeSafeClient } from '@typesafe-ai/sdk'
import { buildRequest, mapAnswers } from './jev.ts'
import { JEV_MODEL } from './jevDecider.ts'
import { overnight, quickStop, sampleState } from './fixtures/sample.ts'

const client = new TypeSafeClient({ timeout: 8000, retry: { maxRetries: 0 } })
const state = sampleState()
const samples = []

for (const arrival of [quickStop, overnight]) {
  const { request, candidates } = buildRequest(arrival, state)
  const started = performance.now()
  const result = await client.systemOne({ ...request, model: JEV_MODEL })
  const latencyMs = Math.round(performance.now() - started)
  const decisions = mapAnswers(arrival, state, candidates, result, latencyMs)
  console.log(`\n${arrival.id}  model ${result.model}  ${latencyMs} ms  tokens in/out ${result.usage.input_tokens}/${result.usage.output_tokens}`)
  for (const d of Object.values(decisions)) {
    console.log(`  ${d.kind.padEnd(7)} ${JSON.stringify(d.value).padEnd(60)} conf ${d.confidence.toFixed(2)}  ${d.mode.padEnd(6)} ${d.source}  ${d.why}`)
  }
  samples.push({ arrivalId: arrival.id, model: result.model, latencyMs, usage: result.usage, answers: result.answers })
}

const out = join(import.meta.dirname, 'fixtures', 'live-sample.json')
writeFileSync(out, JSON.stringify({ recordedAt: new Date().toISOString(), samples }, null, 2) + '\n')
console.log(`\nrecorded ${samples.length} live responses to ${out}`)
