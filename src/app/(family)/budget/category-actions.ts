'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type CategoryFormState = { error: string | null }

const TX_TYPES = ['INCOME', 'EXPENSE', 'SAVING']

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireProfile()
  const txType = String(formData.get('txType') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const parentId = String(formData.get('parentId') ?? '').trim() || null

  if (!name || !TX_TYPES.includes(txType)) {
    return { error: '카테고리 이름을 입력해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('t_budget_category')
    .insert({ tx_type: txType, parent_id: parentId, name })

  if (error) return { error: '카테고리 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function updateCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireProfile()
  const categoryId = String(formData.get('categoryId') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  if (!categoryId || !name) return { error: '카테고리 이름을 입력해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_category').update({ name }).eq('category_id', categoryId)
  if (error) return { error: '카테고리 수정에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function deleteCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireProfile()
  const categoryId = String(formData.get('categoryId') ?? '')
  if (!categoryId) return { error: '카테고리를 선택해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_category').delete().eq('category_id', categoryId)
  if (error) return { error: '이 카테고리(또는 하위 카테고리)를 쓰는 거래가 있으면 삭제할 수 없어요' }

  revalidatePath('/budget')
  return { error: null }
}

export type BudgetFormState = { error: string | null }

export async function setBudget(
  _prevState: BudgetFormState,
  formData: FormData
): Promise<BudgetFormState> {
  await requireProfile()
  const categoryId = String(formData.get('categoryId') ?? '')
  const yearMonth = String(formData.get('yearMonth') ?? '')
  const amount = Number(formData.get('amount') ?? 0)

  if (!categoryId || !yearMonth || !(amount >= 0)) {
    return { error: '카테고리와 예산 금액을 확인해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('t_budget')
    .upsert({ category_id: categoryId, year_month: yearMonth, amount }, { onConflict: 'category_id,year_month' })

  if (error) return { error: '예산 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}
