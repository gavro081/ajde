import { redirect } from 'next/navigation'

import { getCurrentUser, getProfileCompletion, safeNextPath } from '@/lib/auth/session'

import { LoginForm } from './login-form'

const messages: Record<string, string> = {
  'invalid-link': 'That sign-in link is invalid or has expired. Request a new one below.',
  'signed-out': 'You have been signed out safely.',
  'invalid-domain': 'That account is not from an approved student domain.',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null)
  const status = typeof params.status === 'string' ? params.status : ''
  const user = await getCurrentUser()

  if (user) {
    const profile = await getProfileCompletion(user.id)
    redirect(profile.complete ? next : '/onboarding')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mb-8">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Student ride share
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Welcome aboard</h1>
          <p className="mt-3 leading-7 text-slate-600">
            Sign in without a password. We will send a one-time link to your student inbox.
          </p>
        </div>
        {messages[status] ? (
          <p role="status" className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {messages[status]}
          </p>
        ) : null}
        <LoginForm next={next} />
      </section>
    </main>
  )
}

