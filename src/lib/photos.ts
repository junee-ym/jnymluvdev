import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDateKey } from './calendar/grid'
import type { Photo } from './types'

type CommentRow = {
  comment_id: string
  content: string
  created: string
  user_id: string
  t_user: { name: string } | { name: string }[] | null
}

type PhotoRow = {
  photo_id: string
  taken_dt: string
  locatn: string | null
  caption: string | null
  strpath: string
  thumb_path: string | null
  user_id: string
  created: string
  t_comment?: CommentRow[] | null
}

export async function toSignedPhotos(
  supabase: SupabaseClient,
  rows: PhotoRow[]
): Promise<Photo[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(row.strpath, 3600)

      // thumb_path 없는 옛날 사진(마이그레이션 이전 업로드)은 원본을 그대로 쓴다.
      const { data: signedThumb } = row.thumb_path
        ? await supabase.storage.from('photos').createSignedUrl(row.thumb_path, 3600)
        : { data: null }

      const comments = (row.t_comment ?? [])
        .map((c) => {
          const user = Array.isArray(c.t_user) ? c.t_user[0] : c.t_user
          return {
            id: c.comment_id,
            content: c.content,
            createdAt: c.created,
            userId: c.user_id,
            userName: user?.name ?? '(알 수 없음)',
          }
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

      return {
        id: row.photo_id,
        date: row.taken_dt,
        // created는 UTC 타임스탬프라 formatDateKey로 로컬(KST) 날짜로 변환한다.
        registeredDate: formatDateKey(new Date(row.created)),
        location: row.locatn,
        caption: row.caption,
        userId: row.user_id,
        signedUrl: signed?.signedUrl ?? '',
        thumbnailUrl: signedThumb?.signedUrl ?? signed?.signedUrl ?? '',
        comments,
      }
    })
  )
}
