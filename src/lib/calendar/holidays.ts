export type HolidayType = 'holiday' | 'substitute'
export type Holiday = { name: string; type: HolidayType }

const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일',
  '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '크리스마스',
}

const SUBSTITUTE_HOLIDAYS: Record<string, string> = {
  '2026-08-17': '대체공휴일',
}

export function getHoliday(dateKey: string): Holiday | null {
  if (SUBSTITUTE_HOLIDAYS[dateKey]) {
    return { name: SUBSTITUTE_HOLIDAYS[dateKey], type: 'substitute' }
  }
  const mmdd = dateKey.slice(5)
  if (FIXED_HOLIDAYS[mmdd]) {
    return { name: FIXED_HOLIDAYS[mmdd], type: 'holiday' }
  }
  return null
}
