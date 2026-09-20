import 'server-only'

import {
  buildLocationResponseRequest,
  parseLocationResponse,
} from './openai-location-contract'
import type { LocationModelFallback } from './resolve-location'

const RESPONSES_URL = 'https://api.openai.com/v1/responses'

export function createOpenAILocationFallback(): LocationModelFallback | undefined {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return undefined

  const model = process.env.OPENAI_LOCATION_MODEL || 'gpt-5-mini'

  return async (raw, candidates) => {
    try {
      const response = await fetch(RESPONSES_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildLocationResponseRequest(raw, candidates, model)),
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) return null
      return parseLocationResponse(await response.json())
    } catch {
      return null
    }
  }
}

