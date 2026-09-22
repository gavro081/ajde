import { getCurrentUser } from '@/lib/auth/session'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getPublicProfile } from '@/lib/profiles/public-profile'
import { ProfileRatingSummary } from '@/components/ratings/profile-rating-summary'
import { UiIcon } from '@/components/ui-icon'

const genderLabels = {
  woman: 'Woman',
  man: 'Man',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
} as const

export default async function ProfilePage({ params }: PageProps<'/profile/[id]'>) {
  const { id } = await params
  const viewer = await getCurrentUser()
  const profile = await getPublicProfile(id)

  if (!profile) notFound()

  return (
    <main id="main-content" className="px-5 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link href="/rides" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-950">
          <UiIcon name="arrow" size={18} className="rotate-180" />
          Back to rides
        </Link>
        <article className="surface-card mt-20" aria-labelledby="profile-name">
          <div className="px-6 pb-8 sm:px-8 sm:pb-10">
            <div className="flex justify-center">
              <div className="-mt-14 size-28 shrink-0 overflow-hidden rounded-full bg-slate-100 ring-[6px] ring-white sm:-mt-16 sm:size-32">
              {/* Remote profile-photo hosts are user/project specific, so this cannot use a fixed Next Image allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photoUrl}
                alt={`${profile.fullName}'s profile photo`}
                width={128}
                height={128}
                className="size-full object-cover"
              />
              </div>
            </div>
            <div className="mt-6 text-center">
              <h1 id="profile-name" className="break-words font-display text-3xl font-extrabold leading-tight tracking-[-.04em] text-slate-950 sm:text-4xl">
                {profile.fullName}
              </h1>
              <p className="mt-3 flex items-start justify-center gap-2.5 text-base leading-relaxed text-slate-600">
                <UiIcon name="city" size={20} className="mt-1 shrink-0 text-brand-700" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{profile.university}</span>
              </p>
              {viewer?.id === id ? (
                <Link href="/onboarding" className="btn-secondary mt-5 max-w-full">
                  Edit profile & contacts
                </Link>
              ) : null}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 border-t border-slate-200 pt-8">
              <section aria-labelledby="about-heading" className="min-w-0">
                <h2 id="about-heading" className="font-display text-xl font-bold tracking-tight text-slate-950">About</h2>
                <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-slate-600">
                  {profile.bio || 'This student hasn’t added a bio yet.'}
                </p>
                {profile.gender ? (
                  <dl className="mt-6">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <dt className="text-sm text-slate-500">Gender</dt>
                      <dd className="text-sm font-medium text-slate-900">{genderLabels[profile.gender]}</dd>
                    </div>
                  </dl>
                ) : null}
              </section>
              <ProfileRatingSummary profileId={profile.id} />
            </div>
          </div>
        </article>
        <div className="mx-auto mt-6 flex max-w-2xl items-start gap-3 px-1 text-sm leading-6 text-slate-600 sm:px-4">
          <UiIcon name="shield" size={20} className="mt-1 shrink-0" />
          <p>Phone numbers are shared with drivers receiving a booking request. Ride-room members can see each other’s contact details.</p>
        </div>
      </div>
    </main>
  )
}

