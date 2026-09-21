import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getPublicProfile } from '@/lib/profiles/public-profile'
import { ProfileRatingSummary } from '@/components/ratings/profile-rating-summary'

const genderLabels = {
  woman: 'Woman',
  man: 'Man',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say',
} as const

export default async function ProfilePage({ params }: PageProps<'/profile/[id]'>) {
  const { id } = await params
  const profile = await getPublicProfile(id)

  if (!profile) notFound()

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/rides" className="text-sm font-semibold text-emerald-800 hover:underline">
          ← Back to rides
        </Link>
        <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="h-32 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500" />
          <div className="px-7 pb-9 sm:px-10">
            <div className="-mt-16 size-32 overflow-hidden rounded-3xl border-4 border-white bg-emerald-50 shadow-lg">
              {/* Remote profile-photo hosts are user/project specific, so this cannot use a fixed Next Image allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.photoUrl}
                alt={`${profile.fullName}'s profile photo`}
                className="size-full object-cover"
              />
            </div>
            <div className="mt-6">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
                Student profile
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                {profile.fullName}
              </h1>
              <p className="mt-2 text-lg text-slate-600">{profile.university}</p>
            </div>

            <ProfileRatingSummary profileId={profile.id} />

            <dl className="mt-8 grid gap-5 border-t border-slate-200 pt-7 sm:grid-cols-2">
              {profile.gender ? (
                <div>
                  <dt className="text-sm font-semibold text-slate-500">Gender</dt>
                  <dd className="mt-1 text-slate-900">{genderLabels[profile.gender]}</dd>
                </div>
              ) : null}
              {profile.bio ? (
                <div className={profile.gender ? '' : 'sm:col-span-2'}>
                  <dt className="text-sm font-semibold text-slate-500">About</dt>
                  <dd className="mt-1 whitespace-pre-wrap leading-7 text-slate-900">{profile.bio}</dd>
                </div>
              ) : null}
            </dl>

            {!profile.bio && !profile.gender ? (
              <p className="mt-8 border-t border-slate-200 pt-7 text-slate-500">
                This student has not added more public details yet.
              </p>
            ) : null}
          </div>
        </article>
        <p className="mt-5 text-center text-sm leading-6 text-slate-500">
          Contact details are private and become available only for confirmed rides.
        </p>
      </div>
    </main>
  )
}

