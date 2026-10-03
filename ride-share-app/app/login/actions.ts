'use server'

import { headers } from 'next/headers'

import { isAllowedStudentEmail } from '@/lib/auth/email-domain'
import { safeNextPath } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type LoginState = {
  status: 'idle' | 'error' | 'sent'
  message?: string
  email?: string
}

export async function requestMagicLink(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLocaleLowerCase('en-US')
  const next = safeNextPath(String(formData.get('next') ?? ''), '/rides')

  if (!isAllowedStudentEmail(email)) {
    return {
      status: 'error',
      message: 'Use an approved student email address to continue.',
      email,
    }
  }

  const requestHeaders = await headers()
  const origin = requestHeaders.get('origin')
  if (!origin) {
    return { status: 'error', message: 'Could not determine the application URL.', email }
  }

  const callback = new URL('/auth/callback', origin)
  callback.searchParams.set('next', next)

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
    },
  })

  if (error) {
    const rateLimited = error.status === 429 || error.code === 'over_email_send_rate_limit'
    return {
      status: 'error',
      message: rateLimited
        ? 'Email sending is temporarily rate-limited. Wait a minute before requesting another link.'
        : 'We could not send the sign-in link. Please try again.',
      email,
    }
  }

  return {
    status: 'sent',
    message: `A secure sign-in link was sent to ${email}.`,
    email,
  }
}
