import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeLocation,
  resolveLocation,
  type LocationCandidate,
} from './resolve-location'

const candidates: LocationCandidate[] = [
  {
    kind: 'city',
    id: 6,
    nameMk: 'Штип',
    nameEn: 'Shtip',
    aliases: ['штип', 'shtip', 'stip', 'štip'],
  },
  {
    kind: 'pickup_point',
    id: 11,
    nameMk: 'Мавровка',
    nameEn: 'Mavrovka',
    aliases: ['мавровка', 'mavrovka', 'кај мавровка'],
  },
  {
    kind: 'pickup_point',
    id: 12,
    nameMk: 'Рамстор Мол',
    nameEn: 'Ramstore Mall',
    aliases: ['рамстор', 'ramstore', 'ramstor'],
  },
  {
    kind: 'pickup_point',
    id: 13,
    nameMk: 'Автокоманда',
    nameEn: 'Avtokomanda',
    aliases: ['автокоманда', 'avtokomanda', 'autokomanda'],
  },
]

for (const [input, expectedId] of [
  ['Штип', 6],
  ['Stip', 6],
  ['кај Мавровка', 11],
  ['од Рамстор', 12],
  ['на Автокоманда', 13],
] as const) {
  test(`resolves ${input} deterministically`, async () => {
    const result = await resolveLocation(input, candidates)
    assert.equal(result.id, expectedId)
    assert.equal(result.resolution, 'alias')
    assert.ok(result.confidence >= 0.98)
  })
}

test('normalizes case, whitespace, script, and diacritics', () => {
  assert.equal(normalizeLocation('  ŠTIP  '), 'stip')
  assert.equal(normalizeLocation('КаЈ   Мавровка'), 'mavrovka')
})

test('returns unresolved for an unknown place without guessing', async () => {
  const result = await resolveLocation('Непозната автобуска', candidates)
  assert.deepEqual(result, {
    kind: null,
    id: null,
    displayName: 'Непозната автобуска',
    confidence: 0,
    resolution: 'unresolved',
  })
})

test('does not call the model fallback for a known alias', async () => {
  let calls = 0
  const result = await resolveLocation('Stip', candidates, async () => {
    calls += 1
    return null
  })

  assert.equal(result.id, 6)
  assert.equal(calls, 0)
})

test('rejects a model choice that is not in the candidate vocabulary', async () => {
  const result = await resolveLocation('somewhere else', candidates, async () => ({
    kind: 'city',
    candidateId: 9999,
    confidence: 0.9,
  }))

  assert.equal(result.resolution, 'unresolved')
})

