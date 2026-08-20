import { describe, expect, it } from 'vitest'
import { getHoliday } from './holidays'

describe('getHoliday', () => {
  it('매년 반복되는 고정 공휴일을 인식한다', () => {
    expect(getHoliday('2026-01-01')).toEqual({ name: '신정', type: 'holiday' })
    expect(getHoliday('2030-01-01')).toEqual({ name: '신정', type: 'holiday' })
  })
  it('제헌절을 인식한다', () => {
    expect(getHoliday('2026-07-17')).toEqual({ name: '제헌절', type: 'holiday' })
  })
  it('설날/추석 연휴 3일을 인식한다', () => {
    expect(getHoliday('2026-02-16')).toEqual({ name: '설날', type: 'holiday' })
    expect(getHoliday('2026-02-17')).toEqual({ name: '설날', type: 'holiday' })
    expect(getHoliday('2026-02-18')).toEqual({ name: '설날', type: 'holiday' })
    expect(getHoliday('2025-10-05')).toEqual({ name: '추석', type: 'holiday' })
    expect(getHoliday('2025-10-06')).toEqual({ name: '추석', type: 'holiday' })
    expect(getHoliday('2025-10-07')).toEqual({ name: '추석', type: 'holiday' })
  })
  it('국경일이 토요일과 겹치면 다음 평일로 대체공휴일이 생긴다 (2026 광복절)', () => {
    expect(getHoliday('2026-08-17')).toEqual({ name: '광복절 대체공휴일', type: 'substitute' })
  })
  it('추석 연휴가 일요일과 겹치면 연휴 다음 첫 평일로 대체공휴일이 생긴다 (2025 추석)', () => {
    expect(getHoliday('2025-10-08')).toEqual({ name: '추석 대체공휴일', type: 'substitute' })
  })
  it('요일이 겹치지 않으면 대체공휴일이 생기지 않는다 (2026 설날)', () => {
    expect(getHoliday('2026-02-19')).toBeNull()
  })
  it('공휴일이 아닌 날은 null', () => {
    expect(getHoliday('2026-08-19')).toBeNull()
  })
})
