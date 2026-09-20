import { createBrowserClient } from '@supabase/ssr'

import { supabasePublicKey, supabaseUrl } from './env'

/** Supabase client for Client Components. Reads the session from cookies. */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublicKey())
}
