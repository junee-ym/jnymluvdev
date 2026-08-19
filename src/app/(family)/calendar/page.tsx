import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { CalendarClient } from './calendar-client'
import type { CalendarEvent } from '@/lib/types'

export default async function CalendarPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('t_event')
    .select('event_id, event_dt, event_tm, title, categry, user_id')
    .order('event_dt', { ascending: true })

  const events: CalendarEvent[] = (data ?? []).map((row) => ({
    id: row.event_id,
    date: row.event_dt,
    time: row.event_tm,
    title: row.title,
    category: row.categry,
    userId: row.user_id,
  }))

  return <CalendarClient events={events} profile={profile} />
}
