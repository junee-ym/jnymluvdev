import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCategoryTree,
  calcBudgetUsage,
  calcSavings,
  collectSubtreeIds,
  currentYearMonthKST,
  expenseBreakdown,
  flattenCategoryTree,
  monthlyTotals,
  shiftYearMonth,
  yearMonthRange,
} from './calc'
import type { BudgetCategory, BudgetTransaction } from '@/lib/types'

describe('calcSavings', () => {
  it('수입에서 지출을 뺀 금액과 저축률을 계산한다', () => {
    expect(calcSavings(5_000_000, 3_000_000)).toEqual({ amount: 2_000_000, rate: 40 })
  })

  it('수입이 0이면 저축률은 0이다(0으로 나누기 방지)', () => {
    expect(calcSavings(0, 0)).toEqual({ amount: 0, rate: 0 })
  })
})

describe('calcBudgetUsage', () => {
  it('예산 대비 지출 비율을 계산한다', () => {
    expect(calcBudgetUsage(215_000, 300_000)).toBeCloseTo(71.6667, 3)
  })

  it('예산이 0이면 0을 반환한다(0으로 나누기 방지)', () => {
    expect(calcBudgetUsage(10_000, 0)).toBe(0)
  })
})

function cat(id: string, name: string, parentId: string | null = null): BudgetCategory {
  return { id, txType: 'EXPENSE', parentId, name }
}

describe('buildCategoryTree', () => {
  it('parentId 기준으로 대→중 트리를 구성한다', () => {
    const categories = [cat('food', '식비'), cat('food-out', '외식', 'food'), cat('life', '생활')]
    const tree = buildCategoryTree(categories)
    expect(tree.map((n) => n.id)).toEqual(['food', 'life'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['food-out'])
  })

  it('parentId가 없는 카테고리는 모두 루트로 취급한다(수입/저축)', () => {
    const categories = [cat('salary', '남편급여'), cat('bonus', '기타부수입')]
    const tree = buildCategoryTree(categories)
    expect(tree.length).toBe(2)
    expect(tree[0].children).toEqual([])
  })
})

describe('flattenCategoryTree', () => {
  it('트리를 깊이 정보와 함께 평탄화한다', () => {
    const tree = buildCategoryTree([cat('food', '식비'), cat('food-out', '외식', 'food')])
    expect(flattenCategoryTree(tree)).toEqual([
      { id: 'food', name: '식비', depth: 0 },
      { id: 'food-out', name: '외식', depth: 1 },
    ])
  })
})

describe('collectSubtreeIds', () => {
  it('자기 자신과 모든 하위 카테고리 id를 모은다', () => {
    const tree = buildCategoryTree([cat('food', '식비'), cat('food-out', '외식', 'food'), cat('food-deliv', '배달', 'food')])
    expect(collectSubtreeIds(tree[0]).sort()).toEqual(['food', 'food-deliv', 'food-out'])
  })

  it('자식이 없으면 자기 자신만 반환한다', () => {
    const tree = buildCategoryTree([cat('salary', '남편급여')])
    expect(collectSubtreeIds(tree[0])).toEqual(['salary'])
  })
})

describe('currentYearMonthKST', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('UTC 자정 직후에도 KST 기준 달을 반환한다', () => {
    vi.setSystemTime(new Date('2026-08-31T15:30:00Z')) // KST로는 2026-09-01 00:30
    expect(currentYearMonthKST()).toBe('2026-09')
  })

  it('평범한 시각에는 그대로 그 달을 반환한다', () => {
    vi.setSystemTime(new Date('2026-09-15T03:00:00Z')) // KST 정오
    expect(currentYearMonthKST()).toBe('2026-09')
  })
})

describe('yearMonthRange', () => {
  it('9월은 30일까지다', () => {
    expect(yearMonthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('윤년 2월은 29일까지다', () => {
    expect(yearMonthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

function tx(date: string, txType: BudgetTransaction['txType'], categoryId: string, amount: number): BudgetTransaction {
  return { id: `${date}-${categoryId}-${amount}`, date, txType, fixed: false, categoryId, amount, cardId: null, evaluation: null, memo: null, userId: 'u1' }
}

describe('monthlyTotals', () => {
  it('월별로 수입/지출/저축을 합산한다', () => {
    const transactions = [
      tx('2026-08-05', 'INCOME', 'salary', 3_000_000),
      tx('2026-08-10', 'EXPENSE', 'food', 500_000),
      tx('2026-09-05', 'INCOME', 'salary', 3_000_000),
      tx('2026-09-10', 'EXPENSE', 'food', 700_000),
      tx('2026-09-10', 'SAVING', 'fund', 200_000),
    ]
    expect(monthlyTotals(transactions, ['2026-08', '2026-09'])).toEqual([
      { month: '2026-08', income: 3_000_000, expense: 500_000, saving: 0 },
      { month: '2026-09', income: 3_000_000, expense: 700_000, saving: 200_000 },
    ])
  })

  it('거래가 없는 달은 0으로 채운다', () => {
    expect(monthlyTotals([], ['2026-07'])).toEqual([{ month: '2026-07', income: 0, expense: 0, saving: 0 }])
  })
})

describe('expenseBreakdown', () => {
  const categories: BudgetCategory[] = [
    cat('food', '식비'),
    cat('food-out', '외식', 'food'),
    cat('food-deliv', '배달', 'food'),
    cat('life', '생활'),
    cat('transport', '교통'),
  ]

  it('leaf 레벨은 거래에 찍힌 카테고리 그대로 묶는다', () => {
    const transactions = [
      tx('2026-09-01', 'EXPENSE', 'food-out', 30_000),
      tx('2026-09-02', 'EXPENSE', 'food-out', 20_000),
      tx('2026-09-03', 'EXPENSE', 'food-deliv', 15_000),
    ]
    expect(expenseBreakdown(transactions, categories, 'leaf', 6)).toEqual([
      { id: 'food-out', name: '외식', amount: 50_000 },
      { id: 'food-deliv', name: '배달', amount: 15_000 },
    ])
  })

  it('top 레벨은 대분류 조상까지 올려서 묶는다', () => {
    const transactions = [
      tx('2026-09-01', 'EXPENSE', 'food-out', 30_000),
      tx('2026-09-02', 'EXPENSE', 'food-deliv', 15_000),
      tx('2026-09-03', 'EXPENSE', 'transport', 10_000),
    ]
    expect(expenseBreakdown(transactions, categories, 'top', 6)).toEqual([
      { id: 'food', name: '식비', amount: 45_000 },
      { id: 'transport', name: '교통', amount: 10_000 },
    ])
  })

  it('limit을 넘으면 나머지를 기타로 접는다', () => {
    const many: BudgetCategory[] = ['a', 'b', 'c', 'd'].map((id) => cat(id, id))
    const transactions = [
      tx('2026-09-01', 'EXPENSE', 'a', 40),
      tx('2026-09-01', 'EXPENSE', 'b', 30),
      tx('2026-09-01', 'EXPENSE', 'c', 20),
      tx('2026-09-01', 'EXPENSE', 'd', 10),
    ]
    expect(expenseBreakdown(transactions, many, 'leaf', 2)).toEqual([
      { id: 'a', name: 'a', amount: 40 },
      { id: 'b', name: 'b', amount: 30 },
      { id: '__other__', name: '기타', amount: 30 },
    ])
  })

  it('EXPENSE가 아닌 거래는 무시한다', () => {
    const transactions = [tx('2026-09-01', 'INCOME', 'food', 100_000)]
    expect(expenseBreakdown(transactions, categories, 'leaf', 6)).toEqual([])
  })
})

describe('shiftYearMonth', () => {
  it('다음 달로 이동한다', () => {
    expect(shiftYearMonth('2026-09', 1)).toBe('2026-10')
  })

  it('12월에서 다음 달로 가면 해가 바뀐다', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01')
  })

  it('이전 달로 이동한다', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12')
  })
})
