import { phoneSchema, safeSocialUrl } from "@/lib/profiles/contact";

export function ContactDetails({ phone, socialUrl, instagram, facebook }: {
  phone?: string | null; socialUrl?: string | null; instagram?: string | null; facebook?: string | null;
}) {
  const number = phoneSchema.safeParse(phone);
  const links = [...new Set([socialUrl, instagram, facebook].map(safeSocialUrl).filter((url): url is string => !!url))];
  if (!number.success && !links.length) return <p className="mt-2 text-xs text-slate-500">Contact details not added yet.</p>;
  return <div className="mt-2 flex flex-col items-start gap-1 text-sm">
    {number.success ? <a href={`tel:${number.data}`} className="break-all font-medium text-brand-700 underline-offset-4 hover:underline">{number.data}</a> : null}
    {links.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-700 underline-offset-4 hover:underline" aria-label={`Social profile on ${new URL(url).hostname} (opens in a new tab)`}>{new URL(url).hostname.replace(/^www\./, "")} ↗</a>)}
  </div>;
}
