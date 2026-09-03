'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  buildCategoryTree,
  calcBudgetUsage,
  calcSavings,
  flattenCategoryTree,
  shiftYearMonth,
} from '@/lib/budget/calc'
import { canModify } from '@/lib/auth/permissions'
import type { Budget, BudgetCategory, BudgetTransaction, Profile, TxType } from '@/lib/types'
import { createTransaction, deleteTransaction, updateTransaction, type TransactionFormState } from './actions'
import {
  createCategory,
  deleteCategory,
  setBudget,
  updateCategory,
  type BudgetFormState,
  type CategoryFormState,
} from './category-actions'
import { useToast } from '@/components/toast-provider'

const TX_TYPE_LABEL: Record<TxType, string> = { INCOME: '수입', EXPENSE: '지출', SAVING: '저축' }
const EVALUATIONS = ['소비', '낭비', '투자'] as const

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function BudgetClient({
  yearMonth,
  categories,
  transactions,
  budgets,
  profile,
}: {
  yearMonth: string
  categories: BudgetCategory[]
  transactions: BudgetTransaction[]
  budgets: Budget[]
  profile: Profile
}) {
  const { showToast } = useToast()
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<BudgetTransaction | null>(null)
  const [txType, setTxType] = useState<TxType>('EXPENSE')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null)
  const [categoryFormType, setCategoryFormType] = useState<TxType>('EXPENSE')
  const [categoryFormParentId, setCategoryFormParentId] = useState('')

  const initialTxState: TransactionFormState = { error: null }
  const [createState, createFormAction, createPending] = useActionState(createTransaction, initialTxState)
  const [updateState, updateFormAction, updatePending] = useActionState(updateTransaction, initialTxState)
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteTransaction, initialTxState)

  const initialCategoryState: CategoryFormState = { error: null }
  const [createCatState, createCatFormAction, createCatPending] = useActionState(createCategory, initialCategoryState)
  const [updateCatState, updateCatFormAction, updateCatPending] = useActionState(updateCategory, initialCategoryState)
  const [deleteCatState, deleteCatFormAction, deleteCatPending] = useActionState(deleteCategory, initialCategoryState)

  const initialBudgetState: BudgetFormState = { error: null }
  const [budgetState, budgetFormAction, budgetPending] = useActionState(setBudget, initialBudgetState)

  function openTxModal(tx?: BudgetTransaction) {
    setEditingTx(tx ?? null)
    setTxType(tx?.txType ?? 'EXPENSE')
    setTxModalOpen(true)
  }
  function closeTxModal() {
    setTxModalOpen(false)
    setEditingTx(null)
  }

  function openCategoryForm(category?: BudgetCategory) {
    setEditingCategory(category ?? null)
    setCategoryFormType(category?.txType ?? 'EXPENSE')
    setCategoryFormParentId(category?.parentId ?? '')
  }
  function closeCategoryModal() {
    setCategoryModalOpen(false)
    setEditingCategory(null)
  }

  // useActionState의 state는 액션이 완료된 뒤의 리렌더에서만 최신값이 된다 — pending이
  // true→false로 바뀌는 전이를 useRef로 감지해 토스트/모달 닫기를 실행한다
  // (calendar-client.tsx와 동일한 패턴, CLAUDE.md에 기록된 과거 버그 재발 방지).
  const wasCreatePending = useRef(false)
  useEffect(() => {
    if (wasCreatePending.current && !createPending && !createState.error) {
      showToast('거래를 저장했어요')
      closeTxModal()
    }
    wasCreatePending.current = createPending
  }, [createPending, createState, showToast])

  const wasUpdatePending = useRef(false)
  useEffect(() => {
    if (wasUpdatePending.current && !updatePending && !updateState.error) {
      showToast('거래를 수정했어요')
      closeTxModal()
    }
    wasUpdatePending.current = updatePending
  }, [updatePending, updateState, showToast])

  const wasDeletePending = useRef(false)
  useEffect(() => {
    if (wasDeletePending.current && !deletePending && !deleteState.error) {
      showToast('거래를 삭제했어요')
      closeTxModal()
    }
    wasDeletePending.current = deletePending
  }, [deletePending, deleteState, showToast])

  const wasCreateCatPending = useRef(false)
  useEffect(() => {
    if (wasCreateCatPending.current && !createCatPending && !createCatState.error) {
      showToast('카테고리를 만들었어요')
      openCategoryForm()
    }
    wasCreateCatPending.current = createCatPending
  }, [createCatPending, createCatState, showToast])

  const wasUpdateCatPending = useRef(false)
  useEffect(() => {
    if (wasUpdateCatPending.current && !updateCatPending && !updateCatState.error) {
      showToast('카테고리를 수정했어요')
      openCategoryForm()
    }
    wasUpdateCatPending.current = updateCatPending
  }, [updateCatPending, updateCatState, showToast])

  const wasDeleteCatPending = useRef(false)
  useEffect(() => {
    if (wasDeleteCatPending.current && !deleteCatPending && !deleteCatState.error) {
      showToast('카테고리를 삭제했어요')
      openCategoryForm()
    }
    wasDeleteCatPending.current = deleteCatPending
  }, [deleteCatPending, deleteCatState, showToast])

  const wasBudgetPending = useRef(false)
  useEffect(() => {
    if (wasBudgetPending.current && !budgetPending && !budgetState.error) {
      showToast('예산을 저장했어요')
    }
    wasBudgetPending.current = budgetPending
  }, [budgetPending, budgetState, showToast])

  const totalIncome = transactions.filter((t) => t.txType === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.txType === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0)
  const savings = calcSavings(totalIncome, totalExpense)

  const categoriesByType = (type: TxType) => categories.filter((c) => c.txType === type)
  const categoryOptions = (type: TxType) => flattenCategoryTree(buildCategoryTree(categoriesByType(type)))
  const categoryName = (categoryId: string) => categories.find((c) => c.id === categoryId)?.name ?? '(삭제됨)'

  const budgetRows = categoryOptions('EXPENSE').map((opt) => {
    const budget = budgets.find((b) => b.categoryId === opt.id)
    const spent = transactions
      .filter((t) => t.txType === 'EXPENSE' && t.categoryId === opt.id)
      .reduce((sum, t) => sum + t.amount, 0)
    return { ...opt, budgetAmount: budget?.amount ?? 0, spent, usage: calcBudgetUsage(spent, budget?.amount ?? 0) }
  })

  return (
    <section>
      <div className="cal-header">
        <div className="cal-title-group">
          <div className="cal-title">{yearMonth} 가계부</div>
          <div className="cal-nav">
            <Link href={`/budget?month=${shiftYearMonth(yearMonth, -1)}`}>‹</Link>
            <Link href={`/budget?month=${shiftYearMonth(yearMonth, 1)}`}>›</Link>
          </div>
        </div>
        <div className="cal-actions">
          <button className="tag-manage-btn" onClick={() => { openCategoryForm(); setCategoryModalOpen(true) }}>
            카테고리 관리
          </button>
          <button className="add-event" onClick={() => openTxModal()}>+ 거래 추가</button>
        </div>
      </div>

      <div className="budget-rows" style={{ marginBottom: 20 }}>
        <div className="budget-row"><span>총 수입</span><b>{formatWon(totalIncome)}</b></div>
        <div className="budget-row"><span>총 지출</span><b>{formatWon(totalExpense)}</b></div>
        <div className="budget-row"><span>저축액</span><b>{formatWon(savings.amount)}</b></div>
        <div className="budget-row"><span>저축률</span><b>{savings.rate.toFixed(1)}%</b></div>
      </div>

      <h3>카테고리별 예산</h3>
      {budgetRows.map((row) => (
        <div key={row.id} style={{ marginBottom: 10 }}>
          <div className="budget-row">
            <span style={{ paddingLeft: row.depth * 12 }}>{row.name}</span>
            <b>{formatWon(row.spent)} / {formatWon(row.budgetAmount)}</b>
          </div>
          <div className="budget-bar">
            <div className="budget-fill" style={{ width: `${Math.min(row.usage, 100)}%` }} />
          </div>
          <form action={budgetFormAction} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input type="hidden" name="categoryId" value={row.id} />
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <input type="number" name="amount" min={0} defaultValue={row.budgetAmount} style={{ width: 120 }} />
            <button type="submit" className="btn-cancel" disabled={budgetPending}>예산 저장</button>
          </form>
        </div>
      ))}
      {budgetState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{budgetState.error}</p>}

      <h3>거래 내역</h3>
      <ul>
        {transactions.map((tx) => (
          <li key={tx.id} onClick={() => openTxModal(tx)} style={{ cursor: 'pointer' }}>
            {tx.date} · {TX_TYPE_LABEL[tx.txType]} · {categoryName(tx.categoryId)} · {formatWon(tx.amount)}
            {tx.fixed && ' · 고정'}
            {tx.memo && ` · ${tx.memo}`}
          </li>
        ))}
        {transactions.length === 0 && <li>이번 달 거래가 없어요.</li>}
      </ul>

      {txModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeTxModal() }}>
          <div className="modal">
            <h3>{editingTx ? '거래 수정' : '거래 추가'}</h3>
            <form action={editingTx ? updateFormAction : createFormAction}>
              {editingTx && <input type="hidden" name="transactionId" value={editingTx.id} />}
              <label>종류</label>
              <select name="txType" value={txType} onChange={(e) => setTxType(e.target.value as TxType)}>
                <option value="INCOME">수입</option>
                <option value="EXPENSE">지출</option>
                <option value="SAVING">저축</option>
              </select>
              <label>날짜</label>
              <input type="date" name="date" defaultValue={editingTx?.date ?? `${yearMonth}-01`} required />
              <label>카테고리</label>
              <select name="categoryId" defaultValue={editingTx?.categoryId ?? ''} required>
                <option value="" disabled>선택해주세요</option>
                {categoryOptions(txType).map((opt) => (
                  <option key={opt.id} value={opt.id}>{'　'.repeat(opt.depth)}{opt.name}</option>
                ))}
              </select>
              <label>금액</label>
              <input type="number" name="amount" min={1} defaultValue={editingTx?.amount ?? ''} required />
              <label>
                <input type="checkbox" name="fixed" defaultChecked={editingTx?.fixed ?? false} /> 고정 지출/수입
              </label>
              <label>거래출처 (선택)</label>
              <input type="text" name="source" defaultValue={editingTx?.source ?? ''} placeholder="예: 신용카드1, 현금" />
              {txType === 'EXPENSE' && (
                <>
                  <label>지출 평가 (선택)</label>
                  <select name="evaluation" defaultValue={editingTx?.evaluation ?? ''}>
                    <option value="">선택 안 함</option>
                    {EVALUATIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </>
              )}
              <label>메모 (선택)</label>
              <input type="text" name="memo" defaultValue={editingTx?.memo ?? ''} />
              {(createState.error || updateState.error) && (
                <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createState.error ?? updateState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeTxModal}>취소</button>
                <button type="submit" className="btn-save" disabled={createPending || updatePending}>저장</button>
              </div>
            </form>
            {editingTx && canModify(profile.userId, editingTx.userId, profile.role) && (
              <form action={deleteFormAction}>
                <input type="hidden" name="transactionId" value={editingTx.id} />
                {deleteState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteState.error}</p>}
                <button type="submit" className="btn-delete" disabled={deletePending}>이 거래 삭제하기</button>
              </form>
            )}
          </div>
        </div>
      )}

      {categoryModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeCategoryModal() }}>
          <div className="modal">
            <h3>카테고리 관리</h3>
            {(['INCOME', 'EXPENSE', 'SAVING'] as const).map((type) => (
              <div key={type}>
                <h4 style={{ fontSize: 13, marginTop: 12 }}>{TX_TYPE_LABEL[type]}</h4>
                <ul className="tag-manage-list">
                  {categoryOptions(type).map((opt) => (
                    <li key={opt.id}>
                      <span className="tag-manage-name" style={{ paddingLeft: opt.depth * 12 }}>{opt.name}</span>
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => openCategoryForm(categories.find((c) => c.id === opt.id))}
                      >
                        수정
                      </button>
                      <form action={deleteCatFormAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="categoryId" value={opt.id} />
                        <button type="submit" className="btn-delete" disabled={deleteCatPending}>삭제</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {deleteCatState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteCatState.error}</p>}

            <form key={editingCategory?.id ?? 'new'} action={editingCategory ? updateCatFormAction : createCatFormAction}>
              <h3 style={{ fontSize: 13, marginTop: 18 }}>{editingCategory ? '카테고리 수정' : '새 카테고리'}</h3>
              {editingCategory && <input type="hidden" name="categoryId" value={editingCategory.id} />}
              <label>구분</label>
              <select
                name="txType"
                value={categoryFormType}
                disabled={!!editingCategory}
                onChange={(e) => { setCategoryFormType(e.target.value as TxType); setCategoryFormParentId('') }}
              >
                <option value="INCOME">수입</option>
                <option value="EXPENSE">지출</option>
                <option value="SAVING">저축</option>
              </select>
              {categoryFormType === 'EXPENSE' && !editingCategory && (
                <>
                  <label>상위 카테고리 (선택 안 하면 대분류)</label>
                  <select
                    name="parentId"
                    value={categoryFormParentId}
                    onChange={(e) => setCategoryFormParentId(e.target.value)}
                  >
                    <option value="">(대분류로 추가)</option>
                    {categoryOptions('EXPENSE').map((opt) => (
                      <option key={opt.id} value={opt.id}>{'　'.repeat(opt.depth)}{opt.name}</option>
                    ))}
                  </select>
                </>
              )}
              <label>이름</label>
              <input type="text" name="name" defaultValue={editingCategory?.name ?? ''} placeholder="예: 외식" required />
              {(createCatState.error || updateCatState.error) && (
                <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createCatState.error ?? updateCatState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeCategoryModal}>닫기</button>
                <button type="submit" className="btn-save" disabled={createCatPending || updateCatPending}>
                  {editingCategory ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
