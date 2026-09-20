import { createBrowserClient } from '@supabase/ssr'

import type { Database } from './database.types'
import { supabasePublicKey, supabaseUrl } from './env'

/** Supabase client for Client Components. Reads the session from cookies. */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublicKey())
}
