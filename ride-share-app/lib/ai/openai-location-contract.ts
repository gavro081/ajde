import type {
  LocationCandidate,
  LocationKind,
  LocationModelChoice,
} from './resolve-location'

type ResponsesApiPayload = {
  output?: Array<{
    type?: string
    content?: Array<{ type?: string; text?: string }>
  }>
}

type StructuredChoice = {
  matched: boolean
  kind: LocationKind | null
  candidate_id: number | null
  confidence: number
}

export function buildLocationResponseRequest(
  raw: string,
  candidates: readonly LocationCandidate[],
  model: string,
) {
  const vocabulary = candidates.map((candidate) => ({
    kind: candidate.kind,
    id: candidate.id,
    name_mk: candidate.nameMk,
    name_en: candidate.nameEn,
    aliases: candidate.aliases,
  }))

  return {
    model,
    store: false,
    instructions:
      'Resolve the supplied Macedonian location text to the single best candidate. ' +
      'Use only the provided candidate IDs. Return matched=false when none is defensible.',
    input: JSON.stringify({ raw_location: raw, candidates: vocabulary }),
    text: {
      format: {
        type: 'json_schema',
        name: 'location_resolution',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            matched: { type: 'boolean' },
            kind: { type: ['string', 'null'], enum: ['city', 'pickup_point', null] },
            candidate_id: { type: ['integer', 'null'] },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['matched', 'kind', 'candidate_id', 'confidence'],
          additionalProperties: false,
        },
      },
    },
  }
}

export function parseLocationResponse(payload: unknown): LocationModelChoice | null {
  if (!payload || typeof payload !== 'object') return null

  const response = payload as ResponsesApiPayload
  const outputText = response.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text')?.text

  if (!outputText) return null

  try {
    const parsed = JSON.parse(outputText) as Partial<StructuredChoice>
    if (
      parsed.matched !== true ||
      (parsed.kind !== 'city' && parsed.kind !== 'pickup_point') ||
      !Number.isInteger(parsed.candidate_id) ||
      typeof parsed.confidence !== 'number' ||
      !Number.isFinite(parsed.confidence)
    ) {
      return null
    }

    return {
      kind: parsed.kind,
      candidateId: parsed.candidate_id as number,
      confidence: Math.min(1, Math.max(0, parsed.confidence)),
    }
  } catch {
    return null
  }
}

