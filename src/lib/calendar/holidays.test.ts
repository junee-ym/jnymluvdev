import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchYearHolidays, getHolidaysForDates } from './holidays'

// getRestDeInfo 응답 형태. yearCache가 모듈 레벨(연도별)이라 테스트마다 서로 다른
// 연도를 써서 캐시 충돌(=fetch가 실제로 호출 안 되는 것)을 피한다.
function apiResponse(items: { locdate: number; dateName: string; isHoliday: string }[]) {
  return {
    response: {
      header: { resultCode: '00', resultMsg: 'OK' },
      body: { items: { item: items }, totalCount: items.length },
    },
  }
}

describe('fetchYearHolidays / getHolidaysForDates', () => {
  beforeEach(() => {
    process.env.HOLIDAY_API_SERVICE_KEY = 'test-key'
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('공휴일 항목을 dateKey로 정규화한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => apiResponse([
        { locdate: 20200101, dateName: '1월1일', isHoliday: 'Y' },
        { locdate: 20200815, dateName: '광복절', isHoliday: 'Y' },
      ]),
    } as Response)

    const holidays = await fetchYearHolidays(2020)
    expect(holidays['2020-01-01']).toEqual({ name: '1월1일', type: 'holiday' })
    expect(holidays['2020-08-15']).toEqual({ name: '광복절', type: 'holiday' })
  })

  it('dateName이 "대체공휴일(...)"로 시작하면 substitute 타입으로 표시한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => apiResponse([
        { locdate: 20210817, dateName: '대체공휴일(광복절)', isHoliday: 'Y' },
      ]),
    } as Response)

    const holidays = await fetchYearHolidays(2021)
    expect(holidays['2021-08-17']).toEqual({ name: '대체공휴일(광복절)', type: 'substitute' })
  })

  it('isHoliday가 N인 항목(기념일 등)은 제외한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => apiResponse([
        { locdate: 20220505, dateName: '어린이날', isHoliday: 'Y' },
        { locdate: 20221009, dateName: '스승의날', isHoliday: 'N' },
      ]),
    } as Response)

    const holidays = await fetchYearHolidays(2022)
    expect(Object.keys(holidays)).toEqual(['2022-05-05'])
  })

  it('결과가 0건이면 item이 빈 문자열로 와도 빈 맵을 반환한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: { header: { resultCode: '00' }, body: { items: { item: '' }, totalCount: 0 } } }),
    } as Response)

    expect(await fetchYearHolidays(2099)).toEqual({})
  })

  it('결과가 1건이면 item이 배열이 아니라 단일 객체로 와도 처리한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: {
          header: { resultCode: '00' },
          body: { items: { item: { locdate: 20230301, dateName: '삼일절', isHoliday: 'Y' } }, totalCount: 1 },
        },
      }),
    } as Response)

    const holidays = await fetchYearHolidays(2023)
    expect(holidays['2023-03-01']).toEqual({ name: '삼일절', type: 'holiday' })
  })

  it('API 호출 실패 시 폴백 없이 빈 맵을 반환한다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    expect(await fetchYearHolidays(2100)).toEqual({})
  })

  it('여러 날짜가 두 해에 걸치면 각 연도를 한 번씩만 조회해서 합친다', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => apiResponse([{ locdate: 20241231, dateName: '연말', isHoliday: 'Y' }]) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => apiResponse([{ locdate: 20250101, dateName: '신정', isHoliday: 'Y' }]) } as Response)

    const holidays = await getHolidaysForDates(['2024-12-31', '2025-01-01', '2025-01-02'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(holidays['2024-12-31']).toEqual({ name: '연말', type: 'holiday' })
    expect(holidays['2025-01-01']).toEqual({ name: '신정', type: 'holiday' })
  })
})
