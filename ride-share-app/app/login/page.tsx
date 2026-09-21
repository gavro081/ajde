import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { Brand } from '@/components/brand'
import { getCurrentUser, getProfileCompletion, safeNextPath } from '@/lib/auth/session'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in or sign up' }
const messages: Record<string, string> = {
  'invalid-link': 'That sign-in link is invalid or has expired. Request a new one below.',
  'signed-out': 'You have been signed out safely.',
  'invalid-domain': 'That account is not from an approved student domain.',
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null)
  const status = typeof params.status === 'string' ? params.status : ''
  const signingUp = params.mode === 'signup'
  const user = await getCurrentUser()
  const devBypassEnabled = process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === 'true'
  if (user) {
    const profile = await getProfileCompletion(user.id)
    redirect(profile.complete ? next : '/onboarding')
  }

  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6"><Brand /><Link href="/" className="btn-quiet">Home</Link></header>
    <main id="main-content" className="mx-auto grid max-w-5xl gap-10 px-4 py-8 sm:px-6 sm:py-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16">
      <aside className="max-w-md">
        <h2 className="mt-4 text-4xl font-normal leading-tight tracking-[-.05em] sm:text-5xl">The journey is better<br className="hidden sm:block" /> with good company.</h2>
        <Image src="/images/shared-journey.png" width={1254} height={1254} alt="A coral car ready for a shared journey" sizes="(max-width: 1023px) 0px, 420px" className="hidden w-full mix-blend-darken lg:block" />
      </aside>
      <section className="surface-card p-6 sm:p-9">
        <div className="mb-7 flex rounded-full bg-slate-50 p-1 text-sm font-medium" aria-label="Account access">
          <Link href={`/login?next=${encodeURIComponent(next)}`} aria-current={!signingUp ? 'page' : undefined} className={`flex min-h-11 flex-1 items-center justify-center rounded-full ${!signingUp ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'}`}>Sign in</Link>
          <Link href={`/login?mode=signup&next=${encodeURIComponent(next)}`} aria-current={signingUp ? 'page' : undefined} className={`flex min-h-11 flex-1 items-center justify-center rounded-full ${signingUp ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500'}`}>Sign up</Link>
        </div>
        <h1 className="text-3xl font-medium tracking-tight">{signingUp ? 'Your next ride starts here' : 'Welcome back'}</h1>
        <p className="mb-8 mt-4 leading-7 text-slate-500">{signingUp ? 'Start with your student email. We’ll help you set up the rest.' : 'We’ll email you a sign-in link. No password needed.'}</p>
        {messages[status] ? <p role="status" className={`mb-5 rounded-xl px-4 py-3 text-sm ${status === 'signed-out' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{messages[status]}</p> : null}
        <LoginForm next={next} devBypassEnabled={devBypassEnabled} />
        <p className="mt-6 border-t border-slate-100 pt-5 text-center text-xs leading-6 text-slate-500">One email, one account. Your first sign-in creates your account automatically.</p>
      </section>
    </main>
  </div>
}

