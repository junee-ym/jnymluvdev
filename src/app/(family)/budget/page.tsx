import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { currentYearMonthKST, shiftYearMonth, yearMonthRange } from '@/lib/budget/calc'
import { BudgetClient } from './budget-client'
import type { Budget, BudgetCard, BudgetCategory, BudgetTransaction, TxType } from '@/lib/types'

const TREND_MONTHS = 6

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const profile = await requireProfile()
  const monthParam = (await searchParams).month
  const yearMonth = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : currentYearMonthKST()
  const { start, end } = yearMonthRange(yearMonth)
  const trendMonths = Array.from({ length: TREND_MONTHS }, (_, i) => shiftYearMonth(yearMonth, i - (TREND_MONTHS - 1)))
  const trendStart = yearMonthRange(trendMonths[0]).start
  const supabase = await createClient()

  const [{ data: categoryRows }, { data: transactionRows }, { data: budgetRows }, { data: trendRows }, { data: cardRows }, { data: memberRows }] =
    await Promise.all([
      supabase
        .from('t_budget_category')
        .select('category_id, tx_type, parent_id, name')
        .order('created', { ascending: true }),
      supabase
        .from('t_transaction')
        .select('transaction_id, tx_dt, tx_type, fixed, category_id, amount, card_id, evaluation, memo, user_id')
        .gte('tx_dt', start)
        .lte('tx_dt', end)
        .order('tx_dt', { ascending: false }),
      supabase.from('t_budget').select('budget_id, category_id, year_month, amount').eq('year_month', yearMonth),
      // 월별 추이 차트용 — 이번 달 목록과 별개로 최근 6개월치를 금액/날짜/종류만 가볍게 조회.
      supabase.from('t_transaction').select('tx_dt, tx_type, amount').gte('tx_dt', trendStart).lte('tx_dt', end),
      supabase.from('t_budget_card').select('card_id, name, owner_id, owner_name').order('created', { ascending: true }),
      supabase.from('t_user').select('user_id, name'),
    ])

  const categories: BudgetCategory[] = (categoryRows ?? []).map((row) => ({
    id: row.category_id,
    txType: row.tx_type,
    parentId: row.parent_id,
    name: row.name,
  }))

  const transactions: BudgetTransaction[] = (transactionRows ?? []).map((row) => ({
    id: row.transaction_id,
    date: row.tx_dt,
    txType: row.tx_type,
    fixed: row.fixed,
    categoryId: row.category_id,
    amount: row.amount,
    cardId: row.card_id,
    evaluation: row.evaluation,
    memo: row.memo,
    userId: row.user_id,
  }))

  const cards: BudgetCard[] = (cardRows ?? []).map((row) => ({
    id: row.card_id,
    name: row.name,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
  }))

  const familyMembers: { userId: string; name: string }[] = (memberRows ?? []).map((row) => ({
    userId: row.user_id,
    name: row.name,
  }))

  const budgets: Budget[] = (budgetRows ?? []).map((row) => ({
    id: row.budget_id,
    categoryId: row.category_id,
    yearMonth: row.year_month,
    amount: row.amount,
  }))

  const trendTransactions: { date: string; txType: TxType; amount: number }[] = (trendRows ?? []).map((row) => ({
    date: row.tx_dt,
    txType: row.tx_type,
    amount: row.amount,
  }))

  return (
    <BudgetClient
      yearMonth={yearMonth}
      categories={categories}
      transactions={transactions}
      budgets={budgets}
      cards={cards}
      familyMembers={familyMembers}
      profile={profile}
      trendMonths={trendMonths}
      trendTransactions={trendTransactions}
    />
  )
}
