import type { SupabaseClient } from '@supabase/supabase-js'
import type { Photo } from './types'

type PhotoRow = {
  photo_id: string
  taken_dt: string
  locatn: string | null
  caption: string | null
  strpath: string
  user_id: string
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
        location: row.locatn,
        caption: row.caption,
        path: row.strpath,
        userId: row.user_id,
        signedUrl: signed?.signedUrl ?? '',
      }
    })
  )
}
