'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { isOperatorOrAdmin } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type InviteState = { error: string | null; success: string | null }

export async function createInvite(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const profile = await requireProfile()

  if (!isOperatorOrAdmin(profile.role)) {
    return { error: '초대 권한이 없어요', success: null }
  }

  // Supabase는 auth.users.email을 소문자로 정규화한다. 초대 이메일을 입력값 그대로
  // 저장하면 대문자가 섞였을 때 가입 시 조회(.eq('email', user.email))가 어긋난다.
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const rawRole = String(formData.get('role') ?? 'USER')

  if (!email) {
    return { error: '이메일을 입력해주세요', success: null }
  }

  // ADMIN은 이 흐름으로 부여하지 않는다 (스펙상 DB 콘솔 수준의 수동 작업).
  // UI가 USER/OPERATOR만 노출하더라도 서버가 직접 막아야 한다.
  if (rawRole !== 'USER' && rawRole !== 'OPERATOR') {
    return { error: '잘못된 역할이에요', success: null }
  }
  const role: 'USER' | 'OPERATOR' = rawRole

  const supabase = await createClient()
  const { data: inserted, error: insertError } = await supabase
    .from('t_invite')
    .insert({ email, role, inv_by: profile.userId })
    .select('invite_id')
    .single()

  if (insertError) {
    // 23505 = unique_violation (t_invite_pending_email_idx)
    if (insertError.code === '23505') {
      return { error: '이미 대기 중인 초대가 있어요', success: null }
    }
    return { error: '초대 기록 저장에 실패했어요', success: null }
  }

  const admin = createAdminClient()
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  })

  if (inviteError) {
    // 메일 발송이 실패했는데 t_invite 행만 남으면 PENDING 고아 행이 되어
    // 이후 재초대를 유니크 인덱스가 막아버린다. 방금 넣은 행을 되돌린다.
    // (t_invite에는 DELETE 정책이 없어 사용자 세션으로는 지울 수 없으므로 admin 클라이언트를 쓴다.)
    await admin.from('t_invite').delete().eq('invite_id', inserted.invite_id)
    return { error: '초대 메일 발송에 실패했어요', success: null }
  }

  revalidatePath('/')
  return { error: null, success: `${email} 님에게 초대 메일을 보냈어요` }
}
