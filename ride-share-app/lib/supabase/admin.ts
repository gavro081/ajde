import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'
import { supabaseUrl } from './env'

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for the development auth bypass.')
  }

  return createClient<Database>(supabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

