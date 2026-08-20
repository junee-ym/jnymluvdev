export type HolidayType = 'holiday' | 'substitute'
export type Holiday = { name: string; type: HolidayType }

// 매년 반복되는 양력 고정 공휴일(국경일 포함). 제헌절은 2008년부터 공휴일(휴무)은 아니지만
// 국경일이라 함께 표시한다.
const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '신정',
  '03-01': '삼일절',
  '05-05': '어린이날',
  '06-06': '현충일',
  '07-17': '제헌절',
  '08-15': '광복절',
  '10-03': '개천절',
  '10-09': '한글날',
  '12-25': '크리스마스',
}

// 대체공휴일 대상(관공서의 공휴일에 관한 규정 제3조): 삼일절/어린이날/광복절/개천절/한글날 + 설날/추석.
// 신정·현충일·크리스마스·제헌절은 대상 아님.
const SUBSTITUTE_ELIGIBLE_FIXED = ['03-01', '05-05', '08-15', '10-03', '10-09']

// 설날·추석은 음력 기준이라 매년 정부가 관보로 고시하는 양력 날짜를 미리 알 수 없다.
// ponytail: 확인된 연도만 채워둠. 새 연도가 다가오면 관보 고시값으로 추가할 것.
const LUNAR_HOLIDAYS: Record<number, { seollal: string; chuseok: string }> = {
  2024: { seollal: '02-10', chuseok: '09-17' },
  2025: { seollal: '01-29', chuseok: '10-06' },
  2026: { seollal: '02-17', chuseok: '09-25' },
  2027: { seollal: '02-06', chuseok: '09-15' },
}

function toDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

// 해당 연도의 공휴일(대체공휴일 포함)을 한 번에 계산한다.
function buildYearHolidays(year: number): Record<string, Holiday> {
  const result: Record<string, Holiday> = {}

  for (const [mmdd, name] of Object.entries(FIXED_HOLIDAYS)) {
    result[`${year}-${mmdd}`] = { name, type: 'holiday' }
  }

  const lunar = LUNAR_HOLIDAYS[year]
  const lunarSpans: { name: string; days: string[] }[] = []
  if (lunar) {
    for (const [name, mmdd] of [['설날', lunar.seollal], ['추석', lunar.chuseok]] as const) {
      const days = [-1, 0, 1].map((n) => toKey(addDays(toDate(`${year}-${mmdd}`), n)))
      days.forEach((key) => { result[key] = { name, type: 'holiday' } })
      lunarSpans.push({ name, days })
    }
  }

  // 대상 공휴일이 토·일요일이거나 다른 공휴일과 겹치면, 마지막 날 다음의 첫 평일(비공휴일)로 대체.
  const eligible = [
    ...SUBSTITUTE_ELIGIBLE_FIXED.map((mmdd) => ({ name: FIXED_HOLIDAYS[mmdd], days: [`${year}-${mmdd}`] })),
    ...lunarSpans,
  ]
  for (const { name, days } of eligible) {
    const triggered = days.some((key) => isWeekend(toDate(key)) || result[key]?.name !== name)
    if (!triggered) continue
    let cursor = addDays(toDate(days[days.length - 1]), 1)
    while (isWeekend(cursor) || result[toKey(cursor)]) {
      cursor = addDays(cursor, 1)
    }
    result[toKey(cursor)] = { name: `${name} 대체공휴일`, type: 'substitute' }
  }

  return result
}

export function getHoliday(dateKey: string): Holiday | null {
  const year = Number(dateKey.slice(0, 4))
  return buildYearHolidays(year)[dateKey] ?? null
}
