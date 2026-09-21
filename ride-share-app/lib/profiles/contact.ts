import { z } from "zod";

export const phoneSchema = z.string().trim().max(40)
  .regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number, including your country code.")
  .transform(value => value.replace(/[ ()-]/g, ""))
  .refine(value => /^\+?[0-9]{7,15}$/.test(value), "Use a phone number with 7–15 digits.");

export const socialUrlSchema = z.string().trim().max(500).refine(value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname.includes(".") && !url.username && !url.password;
  } catch { return false; }
}, "Enter a full HTTPS profile link, such as https://instagram.com/yourname.");

export const contactSchema = z.object({ phone: phoneSchema, socialUrl: socialUrlSchema });

export function safeSocialUrl(value: string | null | undefined) {
  const parsed = socialUrlSchema.safeParse(value ?? "");
  return parsed.success && parsed.data ? parsed.data : null;
}
