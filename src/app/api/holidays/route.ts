import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth/session'
import { fetchYearHolidays } from '@/lib/calendar/holidays'

// calendar-client.tsx(클라이언트 컴포넌트)가 사용자가 넘겨보는 연도의 공휴일을
// 가져오는 창구. 서비스키를 클라이언트에 노출하지 않으려고 서버에서 대신 호출한다.
export async function GET(request: Request) {
  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  const year = Number(new URL(request.url).searchParams.get('year'))
  if (!Number.isInteger(year)) {
    return NextResponse.json({ error: 'year 파라미터가 필요합니다' }, { status: 400 })
  }

  const holidays = await fetchYearHolidays(year)
  return NextResponse.json(holidays)
}
