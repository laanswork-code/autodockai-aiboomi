import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalisePlate } from '../../server/game/state.ts'
import { isPlate, randomPlate } from './plates.ts'

test('random plates look like Kerala plates and pass both the form and the server', () => {
  for (let i = 0; i < 500; i++) {
    const p = randomPlate()
    assert.match(p, /^KL (0[1-9]|[1-7]\d|8[0-6]) [A-HJ-NP-Z]{1,2} \d{4}$/)
    assert.ok(isPlate(p), p)
    assert.equal(normalisePlate(p), p)
  }
})

test('the form accepts real plate shapes and refuses junk', () => {
  for (const ok of ['KL 07 AB 1234', 'KL07AB1234', 'MH 12 A 1', 'DL 3 CAB 9999']) assert.ok(isPlate(ok), ok)
  for (const bad of ['', 'K', 'HELLO WORLD', 'KL 07 AB 12345']) assert.ok(!isPlate(bad), bad)
})
