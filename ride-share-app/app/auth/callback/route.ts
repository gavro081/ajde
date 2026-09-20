import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { isAllowedStudentEmail } from '@/lib/auth/email-domain'
import { getProfileCompletion, safeNextPath } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

const otpTypes = new Set<EmailOtpType>([
  'email',
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
])

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = safeNextPath(url.searchParams.get('next'))
  const supabase = await createClient()

  let error = null
  if (code) {
    ;({ error } = await supabase.auth.exchangeCodeForSession(code))
  } else if (tokenHash && type && otpTypes.has(type)) {
    ;({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }))
  } else {
    return NextResponse.redirect(new URL('/login?status=invalid-link', url.origin))
  }

  if (error) return NextResponse.redirect(new URL('/login?status=invalid-link', url.origin))

  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email || !isAllowedStudentEmail(user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?status=invalid-domain', url.origin))
  }

  const profile = await getProfileCompletion(user.id)
  return NextResponse.redirect(new URL(profile.complete ? next : '/onboarding', url.origin))
}

