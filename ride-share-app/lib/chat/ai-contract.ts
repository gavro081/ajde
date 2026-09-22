import { z } from "zod";
import { cursorSchema } from "./contract";

export const aiRequestSchema = z.discriminatedUnion("mode", [
  z.object({ rideId: z.uuid(), mode: z.literal("summary") }).strict(),
  z.object({ rideId: z.uuid(), mode: z.literal("question"), question: z.string().trim().min(1).max(1000) }).strict(),
]);
export type AiRequest = z.infer<typeof aiRequestSchema>;
export const aiModelSchema = z.object({
  insufficientEvidence: z.boolean(),
  items: z.array(z.object({
    category: z.enum(["decision", "open_question", "information"]),
    text: z.string().trim().min(1).max(1500),
    messageIds: z.array(z.uuid()).min(1).max(8),
  }).strict()).max(10),
}).strict();
export type AiModelOutput = z.infer<typeof aiModelSchema>;
export const transcriptMessageSchema = cursorSchema.extend({ author: z.string(), body: z.string() }).strict();
export type TranscriptMessage = z.infer<typeof transcriptMessageSchema>;
export const aiAnswerSchema = z.object({
  mode: z.enum(["summary", "question"]),
  insufficientEvidence: z.boolean(),
  items: z.array(z.object({ category: z.enum(["decision", "open_question", "information"]),
    text: z.string(), sources: z.array(transcriptMessageSchema) })),
  messageCount: z.number().int().positive(), cutoff: cursorSchema,
});
export type AiAnswer = z.infer<typeof aiAnswerSchema>;
export const aiErrorCodeSchema = z.enum(["invalid", "unavailable", "database", "empty", "too_large",
  "rate_limit", "missing_key", "timeout", "provider", "refusal", "invalid_output"]);
export type AiErrorCode = z.infer<typeof aiErrorCodeSchema>;
export const aiResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), value: aiAnswerSchema }),
  z.object({ ok: z.literal(false), code: aiErrorCodeSchema, error: z.string() }),
]);
export type AiResult = z.infer<typeof aiResultSchema>;
