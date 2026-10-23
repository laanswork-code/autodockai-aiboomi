/*
 * Test helpers: a fake Jev client and hand-built answers in the SDK's real
 * response shape, plus access to the recorded live responses.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ChoiceResponse, NoulResponse, Questions, RequestOptions, ScoreResponse, SystemOneRequest, SystemOneResult } from '@typesafe-ai/sdk'
import type { JevClient } from '../jev.ts'

type Answers = SystemOneResult<Questions>['answers']

export interface LiveSample { arrivalId: string; model: string; latencyMs: number; answers: Answers }
export const liveSamples = (): LiveSample[] =>
  (JSON.parse(readFileSync(join(import.meta.dirname, 'live-sample.json'), 'utf8')) as { samples: LiveSample[] }).samples
export const liveSample = (arrivalId: string) => {
  const s = liveSamples().find((x) => x.arrivalId === arrivalId)
  if (!s) throw new Error(`no live sample for ${arrivalId}`)
  return s
}

export const choiceAnswer = (probabilities: Record<string, number>): ChoiceResponse => {
  const entries = Object.entries(probabilities)
  const [label, top] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const n = entries.length
  return { type: 'choice', choice: label, confidence: (top - 1 / n) / (1 - 1 / n), probabilities }
}
export const noulAnswer = (p: number): NoulResponse => ({ type: 'noul', noul: p })
export const scoreAnswer = (score: number, confidence: number): ScoreResponse =>
  ({ type: 'score', score, confidence, legend: {}, probabilities: {} }) as unknown as ScoreResponse

export interface FakeClient extends JevClient {
  calls: { request: SystemOneRequest<Questions>; options?: RequestOptions }[]
}

/** A client that answers from `answer(request)`, or hangs until aborted when it returns 'hang'. */
export function fakeClient(answer: (request: SystemOneRequest<Questions>) => Answers | Error | 'hang'): FakeClient {
  const calls: FakeClient['calls'] = []
  return {
    calls,
    systemOne(request, options) {
      calls.push({ request, options })
      const a = answer(request)
      if (a === 'hang') {
        return new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(options.signal?.reason)))
      }
      if (a instanceof Error) return Promise.reject(a)
      return Promise.resolve({ model: 'jev-test', answers: a, usage: { input_tokens: 1, output_tokens: 1 } })
    },
  }
}
