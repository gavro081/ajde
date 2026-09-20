import 'server-only'

import { createClient } from '@/lib/supabase/server'

import {
  resolveLocation,
  type LocationCandidate,
  type LocationModelFallback,
  type LocationResolution,
} from './resolve-location'

export async function loadLocationCandidates(): Promise<LocationCandidate[]> {
  const supabase = await createClient()
  const [citiesResult, pickupPointsResult] = await Promise.all([
    supabase.from('cities').select('id, name_mk, name_en, aliases'),
    supabase.from('pickup_points').select('id, name_mk, name_en, aliases'),
  ])

  if (citiesResult.error) {
    throw new Error('Could not load canonical cities.', { cause: citiesResult.error })
  }
  if (pickupPointsResult.error) {
    throw new Error('Could not load canonical pickup points.', {
      cause: pickupPointsResult.error,
    })
  }

  return [
    ...citiesResult.data.map((city) => ({
      kind: 'city' as const,
      id: city.id,
      nameMk: city.name_mk,
      nameEn: city.name_en,
      aliases: city.aliases,
    })),
    ...pickupPointsResult.data.map((point) => ({
      kind: 'pickup_point' as const,
      id: point.id,
      nameMk: point.name_mk,
      nameEn: point.name_en,
      aliases: point.aliases,
    })),
  ]
}

export async function resolveCanonicalLocation(
  raw: string,
  modelFallback?: LocationModelFallback,
): Promise<LocationResolution> {
  const candidates = await loadLocationCandidates()
  return resolveLocation(raw, candidates, modelFallback)
}

