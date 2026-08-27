import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { toSignedPhotos } from '@/lib/photos'
import { AlbumClient } from './album-client'

export default async function AlbumPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('t_photo')
    .select('photo_id, taken_dt, locatn, caption, strpath, user_id, created, t_comment(comment_id, content, created, user_id, t_user(name))')
    .order('taken_dt', { ascending: false })

  const photos = await toSignedPhotos(supabase, data ?? [])

  return <AlbumClient photos={photos} profile={profile} />
}
