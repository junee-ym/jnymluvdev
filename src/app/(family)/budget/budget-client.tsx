'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  buildCategoryTree,
  calcBudgetUsage,
  calcSavings,
  collectSubtreeIds,
  currentYearMonthKST,
  expenseBreakdown,
  flattenCategoryTree,
  formatWon,
  monthlyTotals,
  shiftYearMonth,
  type CategoryNode,
} from '@/lib/budget/calc'
import { BudgetBarChart, DonutChart, TrendChart } from './budget-charts'
import { formatDateKey } from '@/lib/calendar/grid'
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
const TX_TYPE_COLOR: Record<TxType, string> = { INCOME: 'var(--burgundy)', EXPENSE: 'var(--gold)', SAVING: 'var(--ink-soft)' }
const EVALUATIONS = ['소비', '낭비', '투자'] as const

function findNode(nodes: CategoryNode[], id: string): CategoryNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}

export function BudgetClient({
  yearMonth,
  categories,
  transactions,
  budgets,
  profile,
  trendMonths,
  trendTransactions,
}: {
  yearMonth: string
  categories: BudgetCategory[]
  transactions: BudgetTransaction[]
  budgets: Budget[]
  profile: Profile
  trendMonths: string[]
  trendTransactions: { date: string; txType: TxType; amount: number }[]
}) {
  const { showToast } = useToast()
  const [chartsOpen, setChartsOpen] = useState(false)
  const [breakdownLevel, setBreakdownLevel] = useState<'top' | 'leaf'>('top')
  const [budgetViewLevel, setBudgetViewLevel] = useState<'top' | 'leaf'>('top')
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<BudgetTransaction | null>(null)
  const [txType, setTxType] = useState<TxType>('EXPENSE')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [openCategoryType, setOpenCategoryType] = useState<TxType | null>('EXPENSE')
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
    if (category) setOpenCategoryType(category.txType)
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
  const totalSaving = transactions.filter((t) => t.txType === 'SAVING').reduce((sum, t) => sum + t.amount, 0)
  const savings = calcSavings(totalIncome, totalExpense)

  const categoriesByType = (type: TxType) => categories.filter((c) => c.txType === type)
  const categoryOptions = (type: TxType) => flattenCategoryTree(buildCategoryTree(categoriesByType(type)))
  const categoryName = (categoryId: string) => categories.find((c) => c.id === categoryId)?.name ?? '(삭제됨)'

  const expenseTree = buildCategoryTree(categoriesByType('EXPENSE'))
  const isCurrentMonth = yearMonth === currentYearMonthKST()

  const budgetRows = categoryOptions('EXPENSE')
    .map((opt) => {
      const budget = budgets.find((b) => b.categoryId === opt.id)
      const node = findNode(expenseTree, opt.id)
      // 상위 카테고리에 예산을 걸면 하위 카테고리 거래도 합산해서 반영한다(스펙: 어떤 노드든 예산 가능).
      const subtreeIds = node ? collectSubtreeIds(node) : [opt.id]
      const spent = transactions
        .filter((t) => t.txType === 'EXPENSE' && subtreeIds.includes(t.categoryId))
        .reduce((sum, t) => sum + t.amount, 0)
      return {
        ...opt,
        hasBudget: budget !== undefined,
        budgetAmount: budget?.amount ?? 0,
        spent,
        usage: calcBudgetUsage(spent, budget?.amount ?? 0),
      }
    })
    // 예산이 설정됐거나 지출이 있는 카테고리만 보여준다 — 81개 전 카테고리를 항상 띄우면
    // 거래 내역이 화면 아래로 밀려나 쓸 수 없어진다. 새 카테고리는 "예산 추가" 폼으로 등록.
    .filter((row) => row.hasBudget || row.spent > 0)

  return (
    <section className="budget-page">
      <div className="cal-header">
        <div className="cal-title-group">
          <div className="cal-title">{yearMonth} 가계부</div>
          <div className="cal-nav">
            <Link href={`/budget?month=${shiftYearMonth(yearMonth, -1)}`}>‹</Link>
            <Link href={`/budget?month=${shiftYearMonth(yearMonth, 1)}`}>›</Link>
          </div>
        </div>
        <div className="cal-actions">
          <button className="tag-manage-btn" onClick={() => setChartsOpen((v) => !v)}>
            {chartsOpen ? '차트 숨기기' : '차트 보기'}
          </button>
          <button className="tag-manage-btn" onClick={() => { openCategoryForm(); setCategoryModalOpen(true) }}>
            카테고리 관리
          </button>
          <button className="add-event" onClick={() => openTxModal()}>+ 거래 추가</button>
        </div>
      </div>

      <div className="budget-rows" style={{ marginBottom: 20 }}>
        <div className="budget-row"><span>총 수입</span><b>{formatWon(totalIncome)}</b></div>
        <div className="budget-row"><span>총 지출</span><b>{formatWon(totalExpense)}</b></div>
        <div className="budget-row"><span>총 저축</span><b>{formatWon(totalSaving)}</b></div>
        <div className="budget-row"><span>잉여금</span><b>{formatWon(savings.amount)}</b></div>
        <div className="budget-row"><span>저축률</span><b>{savings.rate.toFixed(1)}%</b></div>
      </div>

      {chartsOpen && (
        <div className="budget-charts">
          <div className="budget-chart-block">
            <div className="budget-chart-head">
              <h3 className="card-title" style={{ margin: 0 }}>카테고리별 지출 비중</h3>
              <div className="budget-chart-toggle">
                <button
                  type="button"
                  className={breakdownLevel === 'top' ? 'active' : ''}
                  onClick={() => setBreakdownLevel('top')}
                >
                  대분류
                </button>
                <button
                  type="button"
                  className={breakdownLevel === 'leaf' ? 'active' : ''}
                  onClick={() => setBreakdownLevel('leaf')}
                >
                  소분류
                </button>
              </div>
            </div>
            <DonutChart data={expenseBreakdown(transactions, categories, breakdownLevel, 6)} />
          </div>

          <div className="budget-chart-block">
            <h3 className="card-title" style={{ margin: 0 }}>최근 {trendMonths.length}개월 추이</h3>
            <TrendChart data={monthlyTotals(trendTransactions, trendMonths)} colors={{ income: TX_TYPE_COLOR.INCOME, expense: TX_TYPE_COLOR.EXPENSE, saving: TX_TYPE_COLOR.SAVING }} />
          </div>

          <div className="budget-chart-block">
            <h3 className="card-title" style={{ margin: 0 }}>예산 대비 실적</h3>
            <BudgetBarChart
              rows={budgetRows
                .filter((row) => row.hasBudget)
                .sort((a, b) => b.spent - a.spent)
                .slice(0, 8)}
            />
          </div>
        </div>
      )}

      <h3 className="card-title">거래 내역</h3>
      <div className="budget-rows" style={{ marginBottom: 20 }}>
        {transactions.map((tx) => (
          <div key={tx.id} className="budget-row tx-row" onClick={() => openTxModal(tx)}>
            <span>
              {tx.date} · {TX_TYPE_LABEL[tx.txType]} · {categoryName(tx.categoryId)}
              {tx.fixed && ' · 고정'}
              {tx.memo && ` · ${tx.memo}`}
            </span>
            <b style={{ color: TX_TYPE_COLOR[tx.txType] }}>
              {tx.txType === 'EXPENSE' ? '-' : '+'}{formatWon(tx.amount)}
            </b>
          </div>
        ))}
        {transactions.length === 0 && <div className="budget-row"><span>이번 달 거래가 없어요.</span></div>}
      </div>

      <div className="budget-chart-head">
        <h3 className="card-title" style={{ margin: 0 }}>카테고리별 예산</h3>
        <div className="budget-chart-toggle">
          <button
            type="button"
            className={budgetViewLevel === 'top' ? 'active' : ''}
            onClick={() => setBudgetViewLevel('top')}
          >
            대분류
          </button>
          <button
            type="button"
            className={budgetViewLevel === 'leaf' ? 'active' : ''}
            onClick={() => setBudgetViewLevel('leaf')}
          >
            소분류
          </button>
        </div>
      </div>
      {budgetRows
        .filter((row) => budgetViewLevel === 'leaf' || row.depth === 0)
        .map((row) => (
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
      {budgetRows.length === 0 && <p>설정된 예산이 없어요. 아래에서 카테고리를 골라 추가해보세요.</p>}
      {budgetState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{budgetState.error}</p>}

      <form action={budgetFormAction} style={{ display: 'flex', gap: 8, marginTop: 12, marginBottom: 20 }}>
        <select name="categoryId" defaultValue="" required style={{ flex: 1 }}>
          <option value="" disabled>예산을 추가할 카테고리 선택</option>
          {categoryOptions('EXPENSE').map((opt) => (
            <option key={opt.id} value={opt.id}>{'　'.repeat(opt.depth)}{opt.name}</option>
          ))}
        </select>
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <input type="number" name="amount" min={0} placeholder="예산 금액" style={{ width: 120 }} required />
        <button type="submit" className="btn-cancel" disabled={budgetPending}>예산 추가</button>
      </form>

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
              <input
                type="date"
                name="date"
                defaultValue={
                  editingTx?.date ?? (isCurrentMonth ? formatDateKey(new Date()) : `${yearMonth}-01`)
                }
                required
              />
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
              <div key={type} className="tag-manage-group">
                <button
                  type="button"
                  className="tag-manage-group-head"
                  aria-expanded={openCategoryType === type}
                  onClick={() => setOpenCategoryType((prev) => (prev === type ? null : type))}
                >
                  <span>{TX_TYPE_LABEL[type]}</span>
                  <span className="tag-manage-group-count">{categoryOptions(type).length}개</span>
                  <span className="tag-manage-group-caret">{openCategoryType === type ? '▲' : '▼'}</span>
                </button>
                {openCategoryType === type && (
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
                        <button
                          type="submit"
                          className="btn-delete"
                          disabled={deleteCatPending}
                          onClick={(e) => {
                            if (!window.confirm(`"${opt.name}" 카테고리를 삭제할까요? 하위 카테고리가 있다면 함께 삭제돼요.`)) {
                              e.preventDefault()
                            }
                          }}
                        >
                          삭제
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
                )}
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
