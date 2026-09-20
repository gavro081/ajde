'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { isAllowedStudentEmail } from '@/lib/auth/email-domain'
import { getProfileCompletion, safeNextPath } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
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
  const intent = String(formData.get('intent') ?? 'magic-link')

  if (!isAllowedStudentEmail(email)) {
    return {
      status: 'error',
      message: 'Use an approved student email address to continue.',
      email,
    }
  }

  if (intent === 'dev-bypass') {
    return developmentSignIn(email, next)
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
        ? 'Email sending is temporarily rate-limited. Wait before requesting another link, or use the development bypass below.'
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

async function developmentSignIn(email: string, next: string): Promise<LoginState> {
  if (process.env.NODE_ENV === 'production' || process.env.DEV_AUTH_BYPASS !== 'true') {
    return {
      status: 'error',
      message: 'The development sign-in bypass is disabled.',
      email,
    }
  }

  let userId: string

  try {
    const admin = createAdminClient()
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkError) {
      return { status: 'error', message: `Development sign-in failed: ${linkError.message}`, email }
    }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: link.properties.hashed_token,
      type: 'magiclink',
    })

    if (error || !data.user) {
      return {
        status: 'error',
        message: `Development sign-in failed: ${error?.message ?? 'No user was returned.'}`,
        email,
      }
    }

    userId = data.user.id
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Development sign-in failed.',
      email,
    }
  }

  const profile = await getProfileCompletion(userId)
  redirect(profile.complete ? next : '/onboarding')
}

