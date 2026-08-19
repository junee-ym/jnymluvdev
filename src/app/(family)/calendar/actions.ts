'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EventFormState = { error: string | null }

export async function createEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await requireProfile()
  const date = String(formData.get('date') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const time = String(formData.get('time') ?? '') || null

  if (!date || !title) {
    return { error: '날짜와 제목을 입력해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_event').insert({
    event_dt: date,
    event_tm: time,
    title,
    user_id: profile.userId,
  })

  if (error) return { error: '일정 저장에 실패했어요' }

  revalidatePath('/calendar')
  revalidatePath('/')
  return { error: null }
}

export async function updateEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await requireProfile()
  const eventId = String(formData.get('eventId') ?? '')
  const date = String(formData.get('date') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const time = String(formData.get('time') ?? '') || null

  if (!eventId || !date || !title) {
    return { error: '날짜와 제목을 입력해주세요' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_event')
    .select('user_id')
    .eq('event_id', eventId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { error } = await supabase
    .from('t_event')
    .update({ event_dt: date, event_tm: time, title, updated: new Date().toISOString() })
    .eq('event_id', eventId)

  if (error) return { error: '일정 수정에 실패했어요' }

  revalidatePath('/calendar')
  revalidatePath('/')
  return { error: null }
}

export async function deleteEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await requireProfile()
  const eventId = String(formData.get('eventId') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_event')
    .select('user_id')
    .eq('event_id', eventId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  const { error } = await supabase.from('t_event').delete().eq('event_id', eventId)
  if (error) return { error: '일정 삭제에 실패했어요' }

  revalidatePath('/calendar')
  revalidatePath('/')
  return { error: null }
}
