'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type CardFormState = { error: string | null }

export async function createCard(_prevState: CardFormState, formData: FormData): Promise<CardFormState> {
  await requireProfile()
  const name = String(formData.get('name') ?? '').trim()
  const ownerId = String(formData.get('ownerId') ?? '').trim() || null

  if (!name) return { error: '카드 이름을 입력해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_card').insert({ name, owner_id: ownerId })
  if (error) return { error: '카드 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function updateCard(_prevState: CardFormState, formData: FormData): Promise<CardFormState> {
  await requireProfile()
  const cardId = String(formData.get('cardId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const ownerId = String(formData.get('ownerId') ?? '').trim() || null

  if (!cardId || !name) return { error: '카드 이름을 입력해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_card').update({ name, owner_id: ownerId }).eq('card_id', cardId)
  if (error) return { error: '카드 수정에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function deleteCard(_prevState: CardFormState, formData: FormData): Promise<CardFormState> {
  await requireProfile()
  const cardId = String(formData.get('cardId') ?? '')
  if (!cardId) return { error: '카드를 선택해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_card').delete().eq('card_id', cardId)
  if (error) return { error: '이 카드를 쓰는 거래가 있으면 삭제할 수 없어요' }

  revalidatePath('/budget')
  return { error: null }
}
