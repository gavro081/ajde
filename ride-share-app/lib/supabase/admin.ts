import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { supabaseUrl } from './env'

export function createAdminClient() {
  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) for sign-in.',
    )
  }

  return createClient<Database>(supabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}
