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

  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? 'USER') as 'USER' | 'OPERATOR' | 'ADMIN'

  if (!email) {
    return { error: '이메일을 입력해주세요', success: null }
  }

  const supabase = await createClient()
  const { error: insertError } = await supabase
    .from('t_invite')
    .insert({ email, role, inv_by: profile.userId })

  if (insertError) {
    return { error: '초대 기록 저장에 실패했어요', success: null }
  }

  const admin = createAdminClient()
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  })

  if (inviteError) {
    return { error: '초대 메일 발송에 실패했어요', success: null }
  }

  revalidatePath('/')
  return { error: null, success: `${email} 님에게 초대 메일을 보냈어요` }
}
