export type LocationKind = 'city' | 'pickup_point'

export type LocationCandidate = {
  kind: LocationKind
  id: number
  nameMk: string
  nameEn: string
  aliases: string[]
}

export type ResolvedLocation = {
  kind: LocationKind
  id: number
  displayName: string
  confidence: number
  resolution: 'alias' | 'model'
}

export type UnresolvedLocation = {
  kind: null
  id: null
  displayName: string
  confidence: 0
  resolution: 'unresolved'
}

export type LocationResolution = ResolvedLocation | UnresolvedLocation

export type LocationModelChoice = {
  kind: LocationKind
  candidateId: number
  confidence: number
}

export type LocationModelFallback = (
  raw: string,
  candidates: readonly LocationCandidate[],
) => Promise<LocationModelChoice | null>

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ѓ: 'gj', е: 'e', ж: 'zh', з: 'z',
  ѕ: 'dz', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', ќ: 'kj', у: 'u', ф: 'f', х: 'h',
  ц: 'c', ч: 'ch', џ: 'dz', ш: 'sh',
}

const LEADING_CONTEXT = /^(?:kaj|od|na|vo|do|at|from|near|by)\s+/

export function normalizeLocation(value: string): string {
  const latin = [...value.toLocaleLowerCase('mk-MK')]
    .map((character) => CYRILLIC_TO_LATIN[character] ?? character)
    .join('')

  return latin
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(LEADING_CONTEXT, '')
    .replace(/\s+/g, ' ')
}

export async function resolveLocation(
  raw: string,
  candidates: readonly LocationCandidate[],
  modelFallback?: LocationModelFallback,
): Promise<LocationResolution> {
  const normalizedRaw = normalizeLocation(raw)
  if (!normalizedRaw) return unresolved(raw)

  for (const candidate of candidates) {
    const primaryNames = [candidate.nameMk, candidate.nameEn]
    if (primaryNames.some((name) => normalizeLocation(name) === normalizedRaw)) {
      return resolved(candidate, 1, 'alias')
    }
  }

  for (const candidate of candidates) {
    if (candidate.aliases.some((alias) => normalizeLocation(alias) === normalizedRaw)) {
      return resolved(candidate, 0.98, 'alias')
    }
  }

  if (!modelFallback) return unresolved(raw)

  const choice = await modelFallback(raw, candidates)
  const candidate = choice
    ? candidates.find((item) => item.id === choice.candidateId && item.kind === choice.kind)
    : null

  if (!choice || !candidate) return unresolved(raw)

  return resolved(candidate, clampConfidence(choice.confidence), 'model')
}

function resolved(
  candidate: LocationCandidate,
  confidence: number,
  resolution: ResolvedLocation['resolution'],
): ResolvedLocation {
  return {
    kind: candidate.kind,
    id: candidate.id,
    displayName: candidate.nameMk,
    confidence,
    resolution,
  }
}

function unresolved(raw: string): UnresolvedLocation {
  return {
    kind: null,
    id: null,
    displayName: raw.trim(),
    confidence: 0,
    resolution: 'unresolved',
  }
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

