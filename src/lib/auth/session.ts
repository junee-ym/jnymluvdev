import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('t_user')
    .select('user_id, email, name, role, avatar')
    .eq('user_id', user.id)
    .single()

  if (!data) return null

  return {
    userId: data.user_id,
    email: data.email,
    name: data.name,
    role: data.role,
    avatar: data.avatar,
  }
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}
