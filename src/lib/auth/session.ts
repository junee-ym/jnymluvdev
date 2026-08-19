import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

async function loadProfile(supabase: ServerClient): Promise<Profile | null> {
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

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  return loadProfile(supabase)
}

export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient()
  const profile = await loadProfile(supabase)

  if (!profile) {
    // 세션은 있는데 t_user 행이 없는 상태(예: 초대받지 않은 구글 계정)에서
    // 그냥 /login으로 보내면 proxy.ts가 "세션이 있으니" 다시 /로 돌려보내 무한 루프가 된다.
    // 세션 자체를 서버에서 무효화해서 루프를 끊는다.
    await supabase.auth.signOut()
    redirect('/login?error=not_member')
  }

  return profile
}
