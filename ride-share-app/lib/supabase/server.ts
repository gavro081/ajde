import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from './database.types'
import { supabasePublicKey, supabaseUrl } from './env'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Always create a new one per request — never hoist it to a module global,
 * because it carries the caller's session.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies. Safe to ignore: proxy.ts
          // refreshes the session on every request, so the cookie is current.
        }
      },
    },
  })
}
