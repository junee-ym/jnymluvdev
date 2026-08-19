'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type PhotoFormState = { error: string | null }

export async function savePhotoMeta(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const path = String(formData.get('path') ?? '')
  const date = String(formData.get('date') ?? '')

  if (!path || !date) {
    return { error: '사진 정보가 올바르지 않아요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_photo').insert({
    taken_dt: date,
    strpath: path,
    user_id: profile.userId,
  })

  if (error) return { error: '사진 저장에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null }
}

export async function updatePhoto(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const photoId = String(formData.get('photoId') ?? '')
  const date = String(formData.get('date') ?? '')
  const caption = String(formData.get('caption') ?? '')
  const location = String(formData.get('location') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_photo')
    .select('user_id')
    .eq('photo_id', photoId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { error } = await supabase
    .from('t_photo')
    .update({ taken_dt: date, caption, locatn: location, updated: new Date().toISOString() })
    .eq('photo_id', photoId)

  if (error) return { error: '사진 정보 저장에 실패했어요' }

  revalidatePath('/album')
  return { error: null }
}

export async function deletePhoto(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const photoId = String(formData.get('photoId') ?? '')
  const path = String(formData.get('path') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_photo')
    .select('user_id')
    .eq('photo_id', photoId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  await supabase.storage.from('photos').remove([path])
  const { error } = await supabase.from('t_photo').delete().eq('photo_id', photoId)
  if (error) return { error: '사진 삭제에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null }
}
