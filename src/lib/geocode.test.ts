import { describe, expect, it } from 'vitest'
import { formatNominatimAddress } from './geocode'

describe('formatNominatimAddress', () => {
  it('display_name이 있으면 그대로 반환한다', () => {
    expect(formatNominatimAddress({ display_name: '서울특별시 강남구 테헤란로' })).toBe(
      '서울특별시 강남구 테헤란로'
    )
  })

  it('Nominatim이 에러를 반환하면(좌표 매칭 실패) null을 반환한다', () => {
    expect(formatNominatimAddress({ error: 'Unable to geocode' })).toBeNull()
  })

  it('display_name이 없으면 null을 반환한다', () => {
    expect(formatNominatimAddress({})).toBeNull()
  })
})
