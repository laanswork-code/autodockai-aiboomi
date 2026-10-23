import assert from 'node:assert/strict'
import { appendFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { baselineDecisions } from '../src/control/baseline.ts'
import { appendAudit, readAudit } from './audit.ts'
import { quickStop, sampleState } from './fixtures/sample.ts'

const tmp = mkdtempSync(join(tmpdir(), 'audit-test-'))
after(() => rmSync(tmp, { recursive: true, force: true }))

test('appends JSON lines and reads back the last N, oldest first', async () => {
  const path = join(tmp, 'nested', 'audit.jsonl')
  assert.deepEqual(await readAudit(10, path), [])
  const decisions = baselineDecisions(quickStop, sampleState())
  for (const id of ['a1', 'a2', 'a3']) {
    await appendAudit({ at: new Date().toISOString(), arrival: { ...quickStop, id }, decisions }, path)
  }
  appendFileSync(path, '{"torn line\n')
  assert.deepEqual((await readAudit(2, path)).map((e) => e.arrival.id), ['a3'])
  assert.deepEqual((await readAudit(3, path)).map((e) => e.arrival.id), ['a2', 'a3'])
  assert.deepEqual(await readAudit(0, path), [])
})
