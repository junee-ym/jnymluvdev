'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { isOperatorOrAdmin } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { TAG_COLORS } from '@/lib/calendar/tags'

export type TagFormState = { error: string | null }

function isValidColor(color: string): boolean {
  return (TAG_COLORS as readonly string[]).includes(color)
}

export async function createTag(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const profile = await requireProfile()
  if (!isOperatorOrAdmin(profile.role)) return { error: '태그 관리 권한이 없어요' }

  const name = String(formData.get('name') ?? '').trim()
  const color = String(formData.get('color') ?? '')
  if (!name || !isValidColor(color)) {
    return { error: '이름과 색상을 확인해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_tag').insert({ name, color, user_id: profile.userId })
  if (error) return { error: '태그 생성에 실패했어요' }

  revalidatePath('/calendar')
  return { error: null }
}

export async function updateTag(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const profile = await requireProfile()
  if (!isOperatorOrAdmin(profile.role)) return { error: '태그 관리 권한이 없어요' }

  const tagId = String(formData.get('tagId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const color = String(formData.get('color') ?? '')
  if (!tagId || !name || !isValidColor(color)) {
    return { error: '이름과 색상을 확인해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_tag').update({ name, color }).eq('tag_id', tagId)
  if (error) return { error: '태그 수정에 실패했어요' }

  revalidatePath('/calendar')
  return { error: null }
}

export async function deleteTag(
  _prevState: TagFormState,
  formData: FormData
): Promise<TagFormState> {
  const profile = await requireProfile()
  if (!isOperatorOrAdmin(profile.role)) return { error: '태그 관리 권한이 없어요' }

  const tagId = String(formData.get('tagId') ?? '')
  const supabase = await createClient()
  const { error } = await supabase.from('t_tag').delete().eq('tag_id', tagId)
  if (error) return { error: '태그 삭제에 실패했어요' }

  revalidatePath('/calendar')
  return { error: null }
}
