import { assistRoom, aiFailure } from "@/lib/chat/ai-service";
import type { AiErrorCode } from "@/lib/chat/ai-contract";

export const maxDuration = 60;
const status: Record<AiErrorCode, number> = { invalid: 400, unavailable: 403, database: 503, empty: 422,
  too_large: 422, rate_limit: 429, missing_key: 503, timeout: 504, provider: 502, refusal: 422, invalid_output: 502 };
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  // Cookie-authenticated, same-origin requests only; never expose a paid cross-site endpoint.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return Response.json(aiFailure("unavailable"), { status: 403, headers });
  }
  const reader = request.body?.getReader();
  if (!reader) return Response.json(aiFailure("invalid"), { status: 400, headers });
  let input: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); return Response.json(aiFailure("invalid"), { status: 413, headers }); }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return Response.json(aiFailure("invalid"), { status: 400, headers }); }
  const result = await assistRoom(input, request.signal);
  return Response.json(result, { status: result.ok ? 200 : status[result.code],
    headers: { ...headers, ...(!result.ok && result.code === "rate_limit" ? { "Retry-After": "60" } : {}) } });
}
