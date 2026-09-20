import 'server-only'

import { createClient } from '@/lib/supabase/server'

export type PublicProfile = {
  id: string
  fullName: string
  photoUrl: string
  university: string
  bio: string | null
  gender: 'woman' | 'man' | 'non_binary' | 'prefer_not_to_say' | null
}

export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, photo_url, university, bio, gender')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error('Could not load the public profile.', { cause: error })
  if (!data) return null

  return {
    id: data.id,
    fullName: data.full_name,
    photoUrl: data.photo_url,
    university: data.university,
    bio: data.bio,
    gender: data.gender,
  }
}

