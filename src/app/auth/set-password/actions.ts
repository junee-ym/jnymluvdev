'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/invites'

export type SetPasswordState = { error: string | null }

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  if (password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 해요' }
  }
  if (!name) {
    return { error: '이름을 입력해주세요' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return { error: '초대 세션이 만료됐어요. 초대 메일을 다시 요청해주세요' }
  }

  // maybeSingle()은 2행 이상이면 에러를 던진다. 같은 이메일로 초대를 다시 보낸
  // 경우(가장 흔한 운영 동작) 원래 초대까지 못 쓰게 되므로, 항상 가장 최근
  // PENDING 초대 1건으로 좁혀서 읽는다.
  const { data: invite } = await supabase
    .from('t_invite')
    .select('invite_id, role, status')
    .eq('email', user.email)
    .eq('status', 'PENDING')
    .order('created', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!invite) {
    return { error: '유효한 초대 정보를 찾을 수 없어요' }
  }

  acceptInvite(invite.status as 'PENDING' | 'ACCEPTED')

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return { error: '비밀번호 설정에 실패했어요' }
  }

  const { error: userInsertError } = await supabase.from('t_user').insert({
    user_id: user.id,
    email: user.email,
    name,
    role: invite.role,
  })

  if (userInsertError) {
    return { error: '가입 처리에 실패했어요' }
  }

  await supabase.from('t_invite').update({ status: 'ACCEPTED' }).eq('invite_id', invite.invite_id)

  redirect('/')
}
