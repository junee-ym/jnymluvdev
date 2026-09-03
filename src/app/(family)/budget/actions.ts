'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type TransactionFormState = { error: string | null }

const TX_TYPES = ['INCOME', 'EXPENSE', 'SAVING']

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const profile = await requireProfile()
  const date = String(formData.get('date') ?? '')
  const txType = String(formData.get('txType') ?? '')
  const categoryId = String(formData.get('categoryId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const fixed = formData.get('fixed') === 'on'
  const source = String(formData.get('source') ?? '').trim() || null
  const evaluation = String(formData.get('evaluation') ?? '').trim() || null
  const memo = String(formData.get('memo') ?? '').trim() || null

  if (!date || !categoryId || !(amount > 0) || !TX_TYPES.includes(txType)) {
    return { error: '날짜, 카테고리, 금액을 확인해주세요' }
  }

  const supabase = await createClient()

  const { data: category } = await supabase
    .from('t_budget_category')
    .select('tx_type')
    .eq('category_id', categoryId)
    .single()

  if (!category || category.tx_type !== txType) {
    return { error: '카테고리와 거래 종류가 일치하지 않아요' }
  }

  const { error } = await supabase.from('t_transaction').insert({
    tx_dt: date,
    tx_type: txType,
    fixed,
    category_id: categoryId,
    amount,
    source,
    evaluation,
    memo,
    user_id: profile.userId,
  })

  if (error) return { error: '거래 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function updateTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const profile = await requireProfile()
  const transactionId = String(formData.get('transactionId') ?? '')
  const date = String(formData.get('date') ?? '')
  const txType = String(formData.get('txType') ?? '')
  const categoryId = String(formData.get('categoryId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const fixed = formData.get('fixed') === 'on'
  const source = String(formData.get('source') ?? '').trim() || null
  const evaluation = String(formData.get('evaluation') ?? '').trim() || null
  const memo = String(formData.get('memo') ?? '').trim() || null

  if (!transactionId || !date || !categoryId || !(amount > 0) || !TX_TYPES.includes(txType)) {
    return { error: '날짜, 카테고리, 금액을 확인해주세요' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_transaction')
    .select('user_id')
    .eq('transaction_id', transactionId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { data: category } = await supabase
    .from('t_budget_category')
    .select('tx_type')
    .eq('category_id', categoryId)
    .single()

  if (!category || category.tx_type !== txType) {
    return { error: '카테고리와 거래 종류가 일치하지 않아요' }
  }

  const { error } = await supabase
    .from('t_transaction')
    .update({
      tx_dt: date,
      tx_type: txType,
      fixed,
      category_id: categoryId,
      amount,
      source,
      evaluation,
      memo,
      updated: new Date().toISOString(),
    })
    .eq('transaction_id', transactionId)

  if (error) return { error: '거래 수정에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function deleteTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const profile = await requireProfile()
  const transactionId = String(formData.get('transactionId') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_transaction')
    .select('user_id')
    .eq('transaction_id', transactionId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  const { error } = await supabase.from('t_transaction').delete().eq('transaction_id', transactionId)
  if (error) return { error: '거래 삭제에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}
