import { describe, expect, it } from 'vitest'
import { getHoliday } from './holidays'

describe('getHoliday', () => {
  it('매년 반복되는 고정 공휴일을 인식한다', () => {
    expect(getHoliday('2026-01-01')).toEqual({ name: '신정', type: 'holiday' })
    expect(getHoliday('2030-01-01')).toEqual({ name: '신정', type: 'holiday' })
  })
  it('대체공휴일을 인식한다', () => {
    expect(getHoliday('2026-08-17')).toEqual({ name: '대체공휴일', type: 'substitute' })
  })
  it('공휴일이 아닌 날은 null', () => {
    expect(getHoliday('2026-08-19')).toBeNull()
  })
})
