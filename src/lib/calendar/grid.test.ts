import { describe, expect, it } from 'vitest'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from './grid'

describe('formatDateKey', () => {
  it('YYYY-MM-DD 형식으로 0-padding한다', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('buildMonthGrid', () => {
  it('7의 배수(주 단위) 셀 개수를 반환한다', () => {
    const cells = buildMonthGrid(2026, 7) // 2026년 8월
    expect(cells.length % 7).toBe(0)
  })
  it('해당 월의 모든 날짜가 inCurrentMonth=true로 포함된다', () => {
    const cells = buildMonthGrid(2026, 7) // 8월 = 31일
    const inMonth = cells.filter((c) => c.inCurrentMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0].dateKey).toBe('2026-08-01')
    expect(inMonth[30].dateKey).toBe('2026-08-31')
  })
})

describe('buildWeekGrid', () => {
  it('일요일부터 토요일까지 7일을 반환한다', () => {
    const week = buildWeekGrid(new Date(2026, 7, 19)) // 2026-08-19(수)
    expect(week).toHaveLength(7)
    expect(week[0].getDay()).toBe(0)
    expect(week[6].getDay()).toBe(6)
    expect(formatDateKey(week[0])).toBe('2026-08-16')
  })
})
