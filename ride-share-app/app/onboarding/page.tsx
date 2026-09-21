import { Brand } from '@/components/brand'
import { SignOutButton } from '@/components/sign-out-button'
import { requireUser } from '@/lib/auth/session'
import { OnboardingForm } from './onboarding-form'

export const metadata = { title: 'Complete your profile' }

export default async function OnboardingPage() {
  const user = await requireUser('/onboarding')
  return <div className="min-h-screen">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6"><Brand /><SignOutButton /></header>
    <main id="main-content" className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14">
      <aside>
        <h1 className="mt-4 text-4xl font-medium leading-tight tracking-tight">A face to go<br className="hidden lg:block" /> with the name.</h1>
        <p className="mt-5 max-w-md text-slate-500">Help fellow students recognise you at pickup.</p>
        <ol className="mt-7 flex flex-wrap gap-4 text-sm lg:flex-col lg:gap-5" aria-label="Signup progress">
          <li className="flex items-center gap-3 text-emerald-700"><span className="grid size-7 place-items-center rounded-full bg-emerald-100" aria-hidden="true">✓</span> Student email verified</li>
          <li className="flex items-center gap-3 font-semibold" aria-current="step"><span className="grid size-7 place-items-center rounded-full bg-coral-600 text-white" aria-hidden="true">2</span> Complete your profile</li>
        </ol>
        <p className="mt-8 hidden text-sm leading-6 text-slate-500 lg:block">Your name, photo and university are visible to other students. Contact details are shared only after a booking is confirmed.</p>
      </aside>
      <section aria-labelledby="profile-heading" className="rounded-3xl border border-white bg-white p-6 shadow-sm sm:p-8">
        <h2 id="profile-heading" className="text-xl font-semibold">Create your trusted profile</h2>
        <p className="mt-2 text-sm text-slate-500">Fields marked * are required.</p>
        <OnboardingForm userId={user.id} />
      </section>
    </main>
  </div>
}

