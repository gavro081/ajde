import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  searchQueryResultSchema,
  searchWarningSchema,
  type SearchQueryResult,
  type SearchWarning,
} from './search-query-schema';
import {
  resolveLocation,
  type LocationCandidate,
  type LocationModelFallback,
} from './resolve-location';
import { localDayUtcBounds } from '../rides/skopje-time';

const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  })
  .nullable();

const localTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

export const searchModelOutputSchema = z.object({
  originText: z.string().trim().min(1).max(160).nullable(),
  destinationText: z.string().trim().min(1).max(160).nullable(),
  dateLocal: localDateSchema,
  dateEndLocal: localDateSchema,
  timeMode: z.enum(['day', 'after', 'before', 'between', 'around']).nullable(),
  startTime: localTimeSchema,
  endTime: localTimeSchema,
  requestedSeats: z.number().int().min(1).max(8).nullable(),
  confidence: z.number().min(0).max(1),
  warnings: z.array(searchWarningSchema).max(8),
});

export type SearchModelOutput = z.infer<typeof searchModelOutputSchema>;

export type SearchLocationCandidate = LocationCandidate & {
  cityId: number | null;
};

export type SearchModelRunner = (input: {
  query: string;
  candidates: readonly SearchLocationCandidate[];
  now: Date;
  timeZone: string;
}) => Promise<SearchModelOutput>;

export type ParseSearchQueryContext = {
  candidates: readonly SearchLocationCandidate[];
  now?: Date;
  timeZone?: string;
  locationFallback?: LocationModelFallback;
  modelRunner?: SearchModelRunner;
};

export class SearchParserError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'missing_key'
      | 'provider_error'
      | 'refusal'
      | 'timeout'
      | 'invalid_output',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'SearchParserError';
  }
}

export async function parseSearchQuery(
  query: string,
  context: ParseSearchQueryContext,
): Promise<SearchQueryResult> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 300) {
    throw new SearchParserError(
      'Search query length is invalid.',
      'invalid_output',
    );
  }

  const now = context.now ?? new Date();
  const timeZone = context.timeZone ?? 'Europe/Skopje';
  const runModel = context.modelRunner ?? runOpenAISearchModel;
  let rawModelOutput: SearchModelOutput;
  try {
    rawModelOutput = await runModel({
      query: normalizedQuery,
      candidates: context.candidates,
      now,
      timeZone,
    });
  } catch (error) {
    if (error instanceof SearchParserError) throw error;
    throw new SearchParserError(
      'The search provider failed.',
      'provider_error',
      { cause: error },
    );
  }
  const modelOutput = searchModelOutputSchema.safeParse(rawModelOutput);
  if (!modelOutput.success) {
    throw new SearchParserError(
      'The model returned an invalid search interpretation.',
      'invalid_output',
    );
  }

  // A dateless search means "any upcoming departure", and seats are always one, so the
  // model's warnings about either are noise.
  const output = modelOutput.data;
  const dateless =
    !output.dateLocal &&
    !output.dateEndLocal &&
    !output.timeMode &&
    !output.startTime &&
    !output.endTime;
  const warnings = output.warnings.filter(
    (warning) =>
      warning.field !== 'seats' && !(dateless && warning.field === 'departure'),
  );
  const [originId, destinationId] = await Promise.all([
    resolveCityId(
      'origin',
      modelOutput.data.originText,
      context.candidates,
      context.locationFallback,
      warnings,
    ),
    resolveCityId(
      'destination',
      modelOutput.data.destinationText,
      context.candidates,
      context.locationFallback,
      warnings,
    ),
  ]);
  const bounds = materializeDepartureBounds(
    modelOutput.data,
    timeZone,
    warnings,
  );

  const result = searchQueryResultSchema.safeParse({
    originId,
    destinationId,
    departureAfter: bounds.after,
    departureBefore: bounds.before,
    dateFrom: output.dateLocal,
    dateTo: output.dateEndLocal ?? output.dateLocal,
    timeAfter: bounds.timeAfter,
    timeBefore: bounds.timeBefore,
    requestedSeats: null,
    confidence: modelOutput.data.confidence,
    warnings,
  });
  if (!result.success) {
    throw new SearchParserError(
      'The interpreted search filters were invalid.',
      'invalid_output',
    );
  }
  return result.data;
}

async function resolveCityId(
  field: 'origin' | 'destination',
  raw: string | null,
  candidates: readonly SearchLocationCandidate[],
  fallback: LocationModelFallback | undefined,
  warnings: SearchWarning[],
) {
  if (!raw) return null;
  const resolution = await resolveLocation(raw, candidates, fallback);
  if (resolution.resolution === 'unresolved') {
    warnings.push({
      field,
      code: 'needs_review',
      message: `“${raw}” did not match a known ${field}; choose it manually.`,
    });
    return null;
  }
  if (resolution.kind === 'city') return resolution.id;

  const pickup = candidates.find(
    (candidate) =>
      candidate.kind === 'pickup_point' && candidate.id === resolution.id,
  );
  if (pickup?.cityId) return pickup.cityId;
  warnings.push({
    field,
    code: 'needs_review',
    message: `The ${field} pickup point could not be linked to a city.`,
  });
  return null;
}

function materializeDepartureBounds(
  output: SearchModelOutput,
  timeZone: string,
  warnings: SearchWarning[],
) {
  if (output.dateLocal && output.dateEndLocal && output.dateEndLocal < output.dateLocal) {
    throw new SearchParserError('The date range ends before it starts.', 'invalid_output');
  }
  let timeAfter: string | null = null;
  let timeBefore: string | null = null;
  if (output.timeMode === 'around' && output.startTime) {
    const [hour, minute] = output.startTime.split(':').map(Number);
    const format = (minutes: number) => {
      const normalized = (minutes + 1440) % 1440;
      return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
    };
    timeAfter = format(hour * 60 + minute - 60);
    timeBefore = format(hour * 60 + minute + 60);
  } else if (output.timeMode === 'after' && output.startTime) {
    timeAfter = output.startTime;
  } else if (output.timeMode === 'before' && output.endTime) {
    timeBefore = output.endTime;
  } else if (output.timeMode === 'between' && output.startTime && output.endTime) {
    timeAfter = output.startTime;
    timeBefore = output.endTime;
  } else if (output.timeMode && output.timeMode !== 'day') {
    warnings.push({ field: 'departure', code: 'needs_review',
      message: 'The time range was incomplete; choose the time manually.' });
  }
  if (timeAfter && timeAfter === timeBefore) {
    throw new SearchParserError('The time range must not be empty.', 'invalid_output');
  }
  // Dates bound the calendar range; clock times repeat independently on each day.
  return {
    after: output.dateLocal ? localDayUtcBounds(output.dateLocal, timeZone).start : null,
    before: output.dateEndLocal || output.dateLocal
      ? localDayUtcBounds((output.dateEndLocal ?? output.dateLocal)!, timeZone).end : null,
    timeAfter,
    timeBefore,
  };
}

async function runOpenAISearchModel({
  query,
  candidates,
  now,
  timeZone,
}: Parameters<SearchModelRunner>[0]): Promise<SearchModelOutput> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    throw new SearchParserError('OpenAI is not configured.', 'missing_key');

  const client = new OpenAI({ apiKey, timeout: 10_000 });
  const model =
    process.env.OPENAI_SEARCH_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    'gpt-5.4-mini';
  console.log('[NL search] Model:', model);
  const vocabulary = candidates.map((candidate) => ({
    kind: candidate.kind,
    id: candidate.id,
    city_id: candidate.cityId,
    name_mk: candidate.nameMk,
    name_en: candidate.nameEn,
    aliases: candidate.aliases,
  }));

  try {
    const response = await client.responses.parse({
      model,
      store: false,
      input: [
        {
          role: 'system',
          content:
            `Extract ride-feed search criteria. Current instant: ${now.toISOString()}. ` +
            `Interpret relative dates in ${timeZone}. Preserve only the words naming origin and ` +
            'destination in originText/destinationText. A lone place such as ‘Bitola Friday after 4’ ' +
            'is a destination, never an invented origin. Use 16:00 for contextually afternoon ‘after 4’; ' +
            "warn when genuinely ambiguous. Date and time are independent: time-only queries are valid " +
            "with both dates null; never request a date just because a time was given. dateLocal is " +
            "the first calendar date and dateEndLocal the inclusive last date (null for a single day). " +
            "Support relative ranges in Macedonian Cyrillic/Latin, Albanian and English. " +
            "'slednive nekolku dena' / 'следниве неколку дена' / 'next few days' means today " +
            "through today+2 calendar days inclusive; add a needs_review warning explaining that assumption. " +
            "Explicit next N days means today through today+(N-1); this weekend means the upcoming " +
            "Saturday-Sunday (include today if already the weekend). Clock times apply each day of a range. " +
            "'nakaj 5' / 'накај 5' / 'around 5' means timeMode=around, startTime=17:00, endTime=null " +
            "unless morning context specifies 05:00; warn about the afternoon assumption. Around uses " +
            "a one-hour tolerance each side, not an after filter. For between times, an end before " +
            "the start means an overnight clock window. Standard working hours (работно време / rabotno vreme) " +
            "are 09:00–17:00. Outside working hours (надвор од работно време, nadvor od rabotno vreme) " +
            "means timeMode=between, startTime=17:00, endTime=09:00 (overnight). After working hours " +
            "(по работно време, posle rabotno vreme, after work) means timeMode=after, startTime=17:00. " +
            "During working hours (во работно време, vo rabotno vreme) means timeMode=between 09:00–17:00. " +
            "Before work (пред работа, pred rabota) means timeMode=before, endTime=09:00. " +
            "For a date without a time use timeMode=day. Unknown or " +
            'unsupported criteria stay null and receive a warning. A search without any date or time is ' +
            'valid and means any upcoming departure: leave dateLocal null with no warning. Every booking ' +
            'is exactly one seat, so leave requestedSeats null. Never infer gender preferences.',
        },
        {
          role: 'user',
          content: `Canonical location vocabulary:\n${JSON.stringify(vocabulary)}\n\nSearch query:\n${query}`,
        },
      ],
      reasoning: { effort: 'none' },
      text: {
        format: zodTextFormat(searchModelOutputSchema, 'ride_search_query'),
      },
    });

    if (!response.output_parsed) {
      throw new SearchParserError(
        'The model refused the search query.',
        'refusal',
      );
    }
    return response.output_parsed;
  } catch (error) {
    if (error instanceof SearchParserError) throw error;
    if (error instanceof Error && /timeout/i.test(error.name + error.message)) {
      throw new SearchParserError(
        'Search interpretation timed out.',
        'timeout',
        { cause: error },
      );
    }
    throw new SearchParserError(
      'The search provider failed.',
      'provider_error',
      { cause: error },
    );
  }
}
