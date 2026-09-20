'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { saveProfile, type ProfileInput } from './actions';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function OnboardingForm({ userId }: { userId: string }) {
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

    if (!photo) {
      setError('Add a profile photo to continue.');
      return;
    }

    setSaving(true);
    const form = new FormData(event.currentTarget);
    const extension =
      photo.name.split('.').pop()?.toLocaleLowerCase('en-US') || 'jpg';
    const storagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(storagePath, photo, { contentType: photo.type, upsert: false });

    if (uploadError) {
      setError(
        'The photo could not be uploaded. Check the file and try again.',
      );
      setSaving(false);
      return;
    }

    const result = await saveProfile({
      fullName: String(form.get('fullName') ?? ''),
      university: String(form.get('university') ?? ''),
      bio: String(form.get('bio') ?? ''),
      gender: String(form.get('gender') ?? '') as ProfileInput['gender'],
      storagePath,
    });

    if (!result.ok) {
      await supabase.storage.from('profile-photos').remove([storagePath]);
      setError(result.message);
      setSaving(false);
      return;
    }

    router.replace('/rides');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-6">
      <div className="flex items-center gap-5">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl bg-emerald-50 text-sm font-semibold text-emerald-800">
          {previewUrl ? (
            // The object URL is local-only and exists solely for the pre-upload preview.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Selected profile preview"
              className="size-full object-cover"
            />
          ) : (
            'Your photo'
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
            required
            onChange={(event) => choosePhoto(event.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-emerald-100 file:px-4 file:py-2 file:font-semibold file:text-emerald-900"
          />
          <p className="mt-2 text-xs text-slate-500">
            JPEG, PNG, or WebP. Maximum 5 MB.
          </p>
        </div>
      </div>

      <Field
        label="Full name"
        name="fullName"
        minLength={2}
        maxLength={100}
        required
      />
      <Field
        label="University"
        name="university"
        minLength={2}
        maxLength={160}
        required
      />

      <div className="space-y-2">
        <label
          htmlFor="bio"
          className="block text-sm font-semibold text-slate-800"
        >
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          maxLength={500}
          rows={3}
          placeholder="A little about you (optional)"
          className="w-full resize-none rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="gender"
          className="block text-sm font-semibold text-slate-800"
        >
          Gender
        </label>
        <select
          id="gender"
          name="gender"
          defaultValue=""
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        >
          <option value="woman">Woman</option>
          <option value="man">Man</option>
        </select>
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
        className="w-full rounded-2xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? 'Creating profile…' : 'Complete profile'}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  minLength: number;
  maxLength: number;
  required?: boolean;
};

function Field({ label, name, minLength, maxLength, required }: FieldProps) {
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
        type="text"
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}
