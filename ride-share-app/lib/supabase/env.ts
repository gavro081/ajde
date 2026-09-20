/**
 * Supabase environment lookup.
 *
 * Supabase issues two flavours of public key: the legacy `anon` JWT and the
 * newer `sb_publishable_…` key. Either works, so accept both and fail loudly
 * with the variable name instead of letting the SDK throw "Invalid URL".
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in ` +
        `(Supabase dashboard → Project Settings → API).`,
    )
  }
  return value
}

export function supabaseUrl(): string {
  return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}

export function supabasePublicKey(): string {
  return required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
}
