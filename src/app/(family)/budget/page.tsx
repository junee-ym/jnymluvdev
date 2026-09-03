import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { currentYearMonthKST, yearMonthRange } from '@/lib/budget/calc'
import { BudgetClient } from './budget-client'
import type { Budget, BudgetCategory, BudgetTransaction } from '@/lib/types'

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const profile = await requireProfile()
  const monthParam = (await searchParams).month
  const yearMonth = monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam) ? monthParam : currentYearMonthKST()
  const { start, end } = yearMonthRange(yearMonth)
  const supabase = await createClient()

  const [{ data: categoryRows }, { data: transactionRows }, { data: budgetRows }] = await Promise.all([
    supabase
      .from('t_budget_category')
      .select('category_id, tx_type, parent_id, name')
      .order('created', { ascending: true }),
    supabase
      .from('t_transaction')
      .select('transaction_id, tx_dt, tx_type, fixed, category_id, amount, source, evaluation, memo, user_id')
      .gte('tx_dt', start)
      .lte('tx_dt', end)
      .order('tx_dt', { ascending: false }),
    supabase.from('t_budget').select('budget_id, category_id, year_month, amount').eq('year_month', yearMonth),
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
    source: row.source,
    evaluation: row.evaluation,
    memo: row.memo,
    userId: row.user_id,
  }))

  const budgets: Budget[] = (budgetRows ?? []).map((row) => ({
    id: row.budget_id,
    categoryId: row.category_id,
    yearMonth: row.year_month,
    amount: row.amount,
  }))

  return (
    <BudgetClient
      yearMonth={yearMonth}
      categories={categories}
      transactions={transactions}
      budgets={budgets}
      profile={profile}
    />
  )
}
