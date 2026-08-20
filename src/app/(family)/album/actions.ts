'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { reverseGeocode } from '@/lib/geocode'

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

  // path는 클라이언트가 보낸 값이다. 업로드는 항상 `<본인 user_id>/...` 경로로
  // 이루어지므로, 남의 폴더(또는 임의 경로)를 자기 사진으로 등록하지 못하게 막는다.
  if (!path.startsWith(`${profile.userId}/`)) {
    return { error: '사진 정보가 올바르지 않아요' }
  }

  const rawLat = formData.get('lat')
  const rawLng = formData.get('lng')
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  const locatn =
    rawLat && rawLng && Number.isFinite(lat) && Number.isFinite(lng)
      ? await reverseGeocode(lat, lng)
      : null

  const supabase = await createClient()
  const { error } = await supabase.from('t_photo').insert({
    taken_dt: date,
    strpath: path,
    user_id: profile.userId,
    locatn,
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
    .update({ caption, locatn: location, updated: new Date().toISOString() })
    .eq('photo_id', photoId)

  if (error) return { error: '사진 정보 저장에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null }
}

export async function deletePhoto(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const photoId = String(formData.get('photoId') ?? '')

  const supabase = await createClient()
  // 삭제할 스토리지 경로는 반드시 DB의 strpath에서 가져온다. 클라이언트가 보낸
  // path를 그대로 remove()에 넘기면, 운영자/관리자 세션에서는 버킷 안의 아무 객체나
  // 지울 수 있는 임의 삭제 통로가 된다.
  const { data: existing } = await supabase
    .from('t_photo')
    .select('user_id, strpath')
    .eq('photo_id', photoId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  const { error: removeError } = await supabase.storage.from('photos').remove([existing.strpath])
  if (removeError) return { error: '사진 삭제에 실패했어요' }

  const { error } = await supabase.from('t_photo').delete().eq('photo_id', photoId)
  if (error) return { error: '사진 삭제에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null }
}
