import { SignOutButton } from '@/components/sign-out-button'
import { requireUser } from '@/lib/auth/session'

import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const user = await requireUser('/onboarding')

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Student ride share
          </p>
          <SignOutButton />
        </header>
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-10">
          <p className="text-sm font-semibold text-emerald-700">One last step</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Create your trusted profile
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-slate-600">
            Your real name, university, and photo help students know who they will share a ride with.
          </p>
          <OnboardingForm userId={user.id} />
        </section>
      </div>
    </main>
  )
}

