import { z } from "zod";

export const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;
export const SCREENSHOT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const screenshotPostSchema = z.object({
  text: z.string().max(5_000),
  kind: z.enum(["offer", "request", "other"]),
  confidence: z.number().min(0).max(1),
});
export type ScreenshotPost = z.infer<typeof screenshotPostSchema>;
export const screenshotResponseSchema = z.object({ posts: z.array(screenshotPostSchema).max(10) });

/** Shared metadata validation; no image bytes or secrets enter the browser contract. */
export function isSupportedScreenshot(mimeType: string, byteLength: number) {
  return SCREENSHOT_MIME_TYPES.some(type => type === mimeType) && Number.isInteger(byteLength) && byteLength > 0 && byteLength <= MAX_SCREENSHOT_BYTES;
}
