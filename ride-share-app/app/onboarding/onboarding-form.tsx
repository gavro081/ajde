'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { contactSchema } from '@/lib/profiles/contact';
import type { Tables } from '@/lib/supabase/database.types';
import { createClient } from '@/lib/supabase/client';

import { saveProfile, type ProfileInput } from './actions';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type InitialProfile = Pick<Tables<'profiles'>, 'full_name' | 'university' | 'photo_url' | 'bio' | 'gender' | 'phone' | 'social_url'>;

export function OnboardingForm({ userId, initial }: { userId: string; initial: InitialProfile | null }) {
  const router = useRouter();
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function choosePhoto(file: File | null) {
    setError(null);
    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('The profile photo must be 5 MB or smaller.');
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!photo && !initial?.photo_url) {
      setError('Add a profile photo to continue.');
      return;
    }

    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const contacts = contactSchema.safeParse({ phone: form.get('phone'), socialUrl: form.get('socialUrl') });
      if (!contacts.success) { setError(contacts.error.issues[0].message); setSaving(false); return; }
      const supabase = createClient();
      let storagePath = '';
      if (photo) {
        const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
        storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('profile-photos')
          .upload(storagePath, photo, { contentType: photo.type, upsert: false });
        if (uploadError) { setError('The photo could not be uploaded. Please try again.'); setSaving(false); return; }
      }

      const result = await saveProfile({
        fullName: String(form.get('fullName') ?? ''),
        university: String(form.get('university') ?? ''),
        bio: String(form.get('bio') ?? ''),
        gender: String(form.get('gender') ?? '') as ProfileInput['gender'],
        storagePath,
        phone: contacts.data.phone,
        socialUrl: contacts.data.socialUrl,
      });

      if (!result.ok) {
        if (storagePath) await supabase.storage.from('profile-photos').remove([storagePath]);
        setError(result.message);
        setSaving(false);
        return;
      }

      router.replace('/rides?welcome=1');
      router.refresh();
    } catch {
      setError('We could not finish your profile. Check your connection and try again.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-6" aria-busy={saving}>
      <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-800">
          {(previewUrl || initial?.photo_url) ? (
            // The object URL is local-only and exists solely for the pre-upload preview.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl || initial?.photo_url || undefined}
              alt="Selected profile preview"
              className="size-full object-cover"
            />
          ) : (
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4" /><path d="M4 22v-2a8 8 0 0 1 16 0v2" /></svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="photo"
            className="block text-sm font-semibold text-slate-800"
          >
            Profile photo <span className="text-rose-600">*</span>
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={!initial?.photo_url}
            aria-describedby="photo-help"
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-semibold file:text-emerald-900"
          />
          <p id="photo-help" className="field-help">
            A clear photo of you. JPEG, PNG, or WebP, up to 5 MB.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
      <Field
        label="Full name"
        name="fullName"
        defaultValue={initial?.full_name}
        placeholder="Your first and last name"
        autoComplete="name"
        minLength={2}
        maxLength={100}
        required
      />
      <Field
        label="University"
        name="university"
        defaultValue={initial?.university}
        placeholder="e.g. UKIM · FINKI"
        autoComplete="organization"
        minLength={2}
        maxLength={160}
        required
      />
      </div>

      <div className="space-y-5 border-t border-slate-100 pt-6">
        <Field label="Phone number" name="phone" type="tel" autoComplete="tel" minLength={7} maxLength={40} required defaultValue={initial?.phone ?? ''} placeholder="e.g. +389 70 123 456" />
        <p className="field-help">Shared with a driver when you request a seat and with fellow members of your ride room.</p>
        <Field label="Social profile (optional)" name="socialUrl" type="url" minLength={0} maxLength={500} defaultValue={initial?.social_url ?? ''} placeholder="https://instagram.com/yourname" />
        <p className="field-help">Facebook, Instagram, X, or another HTTPS profile link. Visible to members of your ride room.</p>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-6">
        <label
          htmlFor="bio"
          className="block text-sm font-semibold text-slate-800"
        >
          Bio <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initial?.bio ?? ""}
          maxLength={500}
          rows={3}
          placeholder="What are you studying? Where do you usually travel?"
          aria-describedby="bio-help"
          className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <p id="bio-help" className="field-help">A short introduction for your fellow travellers. Up to 500 characters.</p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gender"
          className="block text-sm font-semibold text-slate-800"
        >
          Gender <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <select
          id="gender"
          name="gender"
          defaultValue={initial?.gender === "woman" || initial?.gender === "man" ? initial.gender : ""}
          aria-describedby="gender-help"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        >
          <option value="">Choose an option</option>
          <option value="woman">Female</option>
          <option value="man">Male</option>
        </select>
        <p id="gender-help" className="field-help">Shown on your profile and used for same-gender ride preferences. You can leave this blank.</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="w-full btn-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Creating profile…' : 'Complete profile & find a ride'}
      </button>
    </form>
  );
}

type FieldProps = {
  defaultValue?: string;
  type?: "text" | "tel" | "url";
  label: string;
  name: string;
  minLength: number;
  maxLength: number;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
};

function Field({ defaultValue, type = "text", label, name, minLength, maxLength, required, placeholder, autoComplete }: FieldProps) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={name}
        className="block text-sm font-semibold text-slate-800"
      >
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}
