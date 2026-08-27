'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { reverseGeocode } from '@/lib/geocode'
import type { Comment } from '@/lib/types'

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
  const hasGps = rawLat && rawLng && Number.isFinite(lat) && Number.isFinite(lng)
  if (!hasGps) console.error(`savePhotoMeta: GPS 없음 (path=${path}) — 클라이언트가 EXIF에서 위경도를 못 찾음`)
  const locatn = hasGps ? await reverseGeocode(lat, lng) : null

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

export type CommentFormState = { error: string | null; comment?: Comment; deletedId?: string }

function normalizeComment(raw: FormDataEntryValue | null): string | null {
  const content = String(raw ?? '').trim()
  if (!content || content.length > 500) return null
  return content
}

// 댓글 목록은 page.tsx의 전체 조인 쿼리로만 채워지고, 라이트박스는 열려 있는 동안
// 그 서버 조회를 다시 타지 않는다(모달을 닫지 않고 계속 보고 있어야 하므로).
// 그래서 각 액션이 화면에 바로 반영할 수 있게 결과 댓글(또는 삭제된 id)을 함께 돌려준다.
// revalidatePath는 다음 방문/다른 화면(대시보드 등)에서 정확한 데이터를 보장하기 위함.
export async function addComment(
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const profile = await requireProfile()
  const photoId = String(formData.get('photoId') ?? '')
  const content = normalizeComment(formData.get('content'))
  if (!photoId || !content) return { error: '댓글 내용을 입력해주세요' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('t_comment')
    .insert({ photo_id: photoId, content, user_id: profile.userId })
    .select('comment_id, content, created')
    .single()

  if (error || !data) return { error: '댓글 등록에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return {
    error: null,
    comment: {
      id: data.comment_id,
      content: data.content,
      createdAt: data.created,
      userId: profile.userId,
      userName: profile.name,
    },
  }
}

export async function updateComment(
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const profile = await requireProfile()
  const commentId = String(formData.get('commentId') ?? '')
  const content = normalizeComment(formData.get('content'))
  if (!content) return { error: '댓글 내용을 입력해주세요' }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_comment')
    .select('user_id, created, t_user(name)')
    .eq('comment_id', commentId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { error } = await supabase
    .from('t_comment')
    .update({ content, updated: new Date().toISOString() })
    .eq('comment_id', commentId)

  if (error) return { error: '댓글 저장에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  const author = Array.isArray(existing.t_user) ? existing.t_user[0] : existing.t_user
  return {
    error: null,
    comment: {
      id: commentId,
      content,
      createdAt: existing.created,
      userId: existing.user_id,
      userName: author?.name ?? '(알 수 없음)',
    },
  }
}

export async function deleteComment(
  _prevState: CommentFormState,
  formData: FormData
): Promise<CommentFormState> {
  const profile = await requireProfile()
  const commentId = String(formData.get('commentId') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_comment')
    .select('user_id')
    .eq('comment_id', commentId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  const { error } = await supabase.from('t_comment').delete().eq('comment_id', commentId)
  if (error) return { error: '댓글 삭제에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null, deletedId: commentId }
}
