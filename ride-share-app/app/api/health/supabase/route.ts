import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * Connectivity check for the Supabase wiring: GET /api/health/supabase.
 * Confirms the env vars are present and that the project answers auth calls.
 * A signed-out visitor is expected — `user: null` with ok:true is a pass.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()

    // "Auth session missing" just means nobody is signed in; the round-trip worked.
    if (error && error.name !== 'AuthSessionMissingError') {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 })
    }

    return NextResponse.json({
      ok: true,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      user: data.user?.id ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
