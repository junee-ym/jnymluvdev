import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHolidaysForDates } from '@/lib/calendar/holidays'
import { toSignedPhotos } from '@/lib/photos'
import { RecentAlbum } from './recent-album'

const DOWS = ['일', '월', '화', '수', '목', '금', '토']

export default async function DashboardPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const week = buildWeekGrid(new Date())
  const weekDateKeys = week.map(formatDateKey)
  const weekStart = weekDateKeys[0]
  const weekEnd = weekDateKeys[6]
  const today = formatDateKey(new Date())

  const [{ data: eventRows }, { data: photoRows }, { count: memberCount }, holidays] = await Promise.all([
    supabase
      .from('t_event')
      .select('event_id, event_dt, title')
      .gte('event_dt', weekStart)
      .lte('event_dt', weekEnd),
    supabase
      .from('t_photo')
      .select('photo_id, taken_dt, locatn, caption, strpath, user_id, created, t_comment(comment_id, content, created, user_id, t_user(name))')
      .order('taken_dt', { ascending: false })
      .limit(10),
    supabase
      .from('t_user')
      .select('user_id', { count: 'exact', head: true }),
    getHolidaysForDates(weekDateKeys),
  ])

  const recentPhotos = await toSignedPhotos(supabase, photoRows ?? [])

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="greet-eyebrow">오늘도 좋은 하루예요</div>
          <div className="greet"><span>{profile.name}</span>님</div>
        </div>
      </div>

      <div className="bento">
        <div className="cal-user-row">
          <div className="card w-user">
            <div className="avatar">{profile.name.slice(-2)}</div>
            <div className="name">{profile.name}</div>
            <div className="role">{profile.role}</div>
            <div className="stats">
              <div className="stat"><b>{memberCount ?? 0}</b><span>가족 구성원</span></div>
            </div>
          </div>

          <div className="card w-cal">
            <div className="card-head">
              <div className="card-title">이번 주 일정</div>
              <Link href="/calendar" className="card-link">달력 열기 →</Link>
            </div>
            <div className="week-row">
              {week.map((date, i) => {
                const key = formatDateKey(date)
                const holiday = holidays[key] ?? null
                const dayEvents = (eventRows ?? []).filter((e) => e.event_dt === key)
                return (
                  <div
                    className={[
                      'week-day',
                      key === today && 'today',
                      (i === 0 || i === 6) && 'wknd',
                      holiday?.type,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={key}
                  >
                    <div className="dow">{DOWS[i]}</div>
                    <div className="num">{date.getDate()}</div>
                    {holiday && <div className="tag">{holiday.name}</div>}
                    {dayEvents.map((e) => (
                      <div className="tag" key={e.event_id}>{e.title}</div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card w-album">
          <div className="card-head">
            <div className="card-title">최근 앨범</div>
            <Link href="/album" className="card-link">전체 보기 →</Link>
          </div>
          <RecentAlbum photos={recentPhotos} profile={profile} />
        </div>

        <div className="card w-budget">
          <div className="card-head">
            <div className="card-title">가계부</div>
            <span className="badge-soon">준비중</span>
          </div>
          <p style={{ fontSize: 12.5 }}>가계부 기능은 곧 만나보실 수 있어요.</p>
        </div>

        <div className="card w-fridge">
          <div className="card-head">
            <div className="card-title">냉장고</div>
            <span className="badge-soon">준비중</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>냉장고 기능은 곧 만나보실 수 있어요.</p>
        </div>
      </div>
    </section>
  )
}
