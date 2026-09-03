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
  const tagIds = formData.getAll('tagIds').map(String)

  if (!date || !title) {
    return { error: '날짜와 제목을 입력해주세요' }
  }

  const supabase = await createClient()
  const { data: event, error } = await supabase
    .from('t_event')
    .insert({ event_dt: date, event_tm: time, title, user_id: profile.userId })
    .select('event_id')
    .single()

  if (error || !event) return { error: '일정 저장에 실패했어요' }

  if (tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from('t_event_tag')
      .insert(tagIds.map((tagId) => ({ event_id: event.event_id, tag_id: tagId })))
    if (tagError) return { error: '태그 저장에 실패했어요' }
  }

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
  const tagIds = formData.getAll('tagIds').map(String)

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

  // 태그는 diff 계산 없이 전체 삭제 후 다시 넣는다 — 일정당 태그 수가 적어 비용이 미미하다.
  const { error: unlinkError } = await supabase.from('t_event_tag').delete().eq('event_id', eventId)
  if (unlinkError) return { error: '태그 수정에 실패했어요' }
  if (tagIds.length > 0) {
    const { error: tagError } = await supabase
      .from('t_event_tag')
      .insert(tagIds.map((tagId) => ({ event_id: eventId, tag_id: tagId })))
    if (tagError) return { error: '태그 수정에 실패했어요' }
  }

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
