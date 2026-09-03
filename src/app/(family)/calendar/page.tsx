import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { CalendarClient } from './calendar-client'
import type { CalendarEvent, Tag } from '@/lib/types'

export default async function CalendarPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const [{ data: eventRows }, { data: tagRows }] = await Promise.all([
    supabase
      .from('t_event')
      .select('event_id, event_dt, event_tm, title, categry, user_id, t_event_tag(t_tag(tag_id, name, color))')
      .order('event_dt', { ascending: true }),
    supabase.from('t_tag').select('tag_id, name, color').order('created', { ascending: true }),
  ])

  const tags: Tag[] = (tagRows ?? []).map((row) => ({ id: row.tag_id, name: row.name, color: row.color }))

  const events: CalendarEvent[] = (eventRows ?? []).map((row) => ({
    id: row.event_id,
    date: row.event_dt,
    time: row.event_tm,
    title: row.title,
    category: row.categry,
    userId: row.user_id,
    tags: (row.t_event_tag ?? [])
      .flatMap((link) => link.t_tag)
      .map((t) => ({ id: t.tag_id, name: t.name, color: t.color })),
  }))

  return <CalendarClient events={events} tags={tags} profile={profile} />
}
