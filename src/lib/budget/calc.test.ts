import { describe, expect, it } from 'vitest'
import {
  buildCategoryTree,
  calcBudgetUsage,
  calcSavings,
  flattenCategoryTree,
  shiftYearMonth,
  yearMonthRange,
} from './calc'
import type { BudgetCategory } from '@/lib/types'

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

describe('yearMonthRange', () => {
  it('9월은 30일까지다', () => {
    expect(yearMonthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('윤년 2월은 29일까지다', () => {
    expect(yearMonthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
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
