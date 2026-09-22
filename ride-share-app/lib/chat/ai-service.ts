import "server-only";
import { isChatAiEnabled } from "./ai-feature";
import { aiModelSchema, aiRequestSchema, type AiErrorCode, type AiResult } from "./ai-contract";
import { loadTranscript, TranscriptTooLarge } from "./transcript";
import { roomAccess } from "./server";
import { ChatAiError, runChatAssistant } from "@/lib/ai/chat-assistant";

const errors: Record<AiErrorCode, string> = {
  disabled: "AI chat assistance is disabled. You can still read and send messages.",
  invalid: "Ask a question between 1 and 1,000 characters about this chat.",
  unavailable: "This ride room is unavailable.", database: "Chat history could not be loaded. Please retry.",
  empty: "No messages to summarize or ask about yet.", too_large: "Chat is too long for AI assistance. You can still browse its full history.",
  rate_limit: "AI request limit reached. Wait a minute before trying again.",
  missing_key: "AI chat assistance is not configured. You can still read and send messages.",
  timeout: "AI took too long to respond. Please try again.", provider: "AI is temporarily unavailable. Please try again.",
  refusal: "AI could not answer this request. Try a different question about the chat.",
  invalid_output: "AI could not provide a verified response. Please try again.",
};
export function aiFailure(code: AiErrorCode): AiResult { return { ok: false, code, error: errors[code] }; }

export async function assistRoom(input: unknown, signal?: AbortSignal): Promise<AiResult> {
  if (!isChatAiEnabled()) return aiFailure("disabled");
  const parsed = aiRequestSchema.safeParse(input);
  if (!parsed.success) return aiFailure("invalid");
  const request = parsed.data;
  try {
    const access = await roomAccess(request.rideId);
    if (!access.ok) return aiFailure(access.code);
    const transcript = await loadTranscript(access);
    if (!transcript.cutoff) return aiFailure("empty");
    if (!process.env.OPENAI_API_KEY?.trim()) return aiFailure("missing_key");
    const before = await roomAccess(request.rideId);
    if (!before.ok) return aiFailure(before.code);
    if (before.user.id !== access.user.id) return aiFailure("unavailable");
    const permit = await before.supabase.rpc("try_chat_ai_request");
    if (permit.error) return aiFailure("database");
    if (!permit.data) return aiFailure("rate_limit");
    const output = await runChatAssistant(request, transcript.messages, signal);
    const after = await roomAccess(request.rideId);
    if (!after.ok) return aiFailure(after.code);
    if (after.user.id !== access.user.id) return aiFailure("unavailable");
    const validated = aiModelSchema.safeParse(output);
    if (!validated.success) return aiFailure("invalid_output");
    const { items, insufficientEvidence } = validated.data;
    if (insufficientEvidence ? items.length !== 0 : items.length === 0) return aiFailure("invalid_output");
    const byId = new Map(transcript.messages.map(message => [message.id, message]));
    if (items.some(item => item.messageIds.some(id => !byId.has(id)))) return aiFailure("invalid_output");
    return { ok: true, value: { mode: request.mode, insufficientEvidence,
      items: items.map(item => ({ category: item.category, text: item.text,
        sources: [...new Set(item.messageIds)].map(id => byId.get(id)!) })),
      messageCount: transcript.messages.length, cutoff: transcript.cutoff } };
  } catch (error) {
    if (error instanceof TranscriptTooLarge) return aiFailure("too_large");
    if (error instanceof ChatAiError) return aiFailure(error.code);
    return aiFailure("database");
  }
}
