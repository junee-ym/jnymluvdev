export type HolidayType = 'holiday' | 'substitute'
export type Holiday = { name: string; type: HolidayType }

// 한국천문연구원_특일 정보(공공데이터포털) getRestDeInfo — 공휴일만 돌려줌.
// 설날/추석 음력 변환, 대체공휴일, 법 개정(예: 2026년 제헌절 부활)까지 정부 관보 값 그대로
// 반영되므로 더 이상 연도별로 손으로 채워둘 필요가 없다.
const API_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'

type ApiItem = { locdate: number; dateName: string; isHoliday: string }

// 서버 인스턴스가 살아있는 동안만 유효한 연도별 캐시(같은 인스턴스에서 재호출 방지용).
// 인스턴스 재시작되면 비워지지만 API를 다시 부르면 되므로 영속 캐시는 두지 않는다.
const yearCache = new Map<number, Promise<Record<string, Holiday>>>()

async function fetchFromApi(year: number): Promise<Record<string, Holiday>> {
  const serviceKey = process.env.HOLIDAY_API_SERVICE_KEY
  if (!serviceKey) throw new Error('HOLIDAY_API_SERVICE_KEY 환경변수가 없습니다')

  const params = new URLSearchParams({
    serviceKey,
    solYear: String(year),
    numOfRows: '100',
    _type: 'json',
  })
  const res = await fetch(`${API_URL}?${params}`)
  if (!res.ok) throw new Error(`특일 정보 API 응답 실패: ${res.status}`)

  const data = await res.json()
  const header = data?.response?.header
  if (header?.resultCode !== '00') {
    throw new Error(`특일 정보 API 오류: ${header?.resultMsg ?? '알 수 없는 오류'}`)
  }

  const rawItem = data?.response?.body?.items?.item
  const items: ApiItem[] = rawItem == null || rawItem === '' ? [] : Array.isArray(rawItem) ? rawItem : [rawItem]

  const result: Record<string, Holiday> = {}
  for (const item of items) {
    if (item.isHoliday !== 'Y') continue
    const key = String(item.locdate).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    // 실제 응답은 "대체공휴일" 단독이 아니라 "대체공휴일(광복절)"처럼 원래 공휴일명이 괄호로 붙어서 온다.
    result[key] = { name: item.dateName, type: item.dateName.startsWith('대체공휴일') ? 'substitute' : 'holiday' }
  }
  return result
}

// 해당 연도의 공휴일 맵을 가져온다. API 실패 시 폴백 없이 조용히 빈 맵을 반환한다
// (달력 자체는 정상 렌더되고, 공휴일 표시만 그 해에 한해 빠진다). 실패는 캐시하지 않아
// 다음 요청에서 재시도된다.
export async function fetchYearHolidays(year: number): Promise<Record<string, Holiday>> {
  const cached = yearCache.get(year)
  if (cached) return cached

  const promise = fetchFromApi(year).catch((err) => {
    console.error(`[holidays] ${year}년 공휴일 조회 실패`, err)
    yearCache.delete(year)
    return {}
  })
  yearCache.set(year, promise)
  return promise
}

// 여러 날짜(연도가 섞여 있을 수 있음, 예: 주간 뷰가 연말연시에 걸칠 때)에 대해
// 필요한 연도만 모아 한 번씩 조회하고 합친다.
export async function getHolidaysForDates(dateKeys: string[]): Promise<Record<string, Holiday>> {
  const years = [...new Set(dateKeys.map((k) => Number(k.slice(0, 4))))]
  const maps = await Promise.all(years.map(fetchYearHolidays))
  return Object.assign({}, ...maps)
}
