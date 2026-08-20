import type { SupabaseClient } from '@supabase/supabase-js'
import { formatDateKey } from './calendar/grid'
import type { Photo } from './types'

type PhotoRow = {
  photo_id: string
  taken_dt: string
  locatn: string | null
  caption: string | null
  strpath: string
  user_id: string
  created: string
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

      return {
        id: row.photo_id,
        date: row.taken_dt,
        // created는 UTC 타임스탬프라 formatDateKey로 로컬(KST) 날짜로 변환한다.
        registeredDate: formatDateKey(new Date(row.created)),
        location: row.locatn,
        caption: row.caption,
        userId: row.user_id,
        signedUrl: signed?.signedUrl ?? '',
      }
    })
  )
}
