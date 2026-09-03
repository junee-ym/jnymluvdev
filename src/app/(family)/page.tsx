import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHolidaysForDates } from '@/lib/calendar/holidays'
import { toSignedPhotos } from '@/lib/photos'
import { calcBudgetUsage, currentYearMonthKST, formatWon, yearMonthRange } from '@/lib/budget/calc'
import { RecentAlbum } from './recent-album'

const DOWS = ['일', '월', '화', '수', '목', '금', '토']

function monthDay(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(m)}.${Number(d)}`
}

export default async function DashboardPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const week = buildWeekGrid(new Date())
  const weekDateKeys = week.map(formatDateKey)
  const weekStart = weekDateKeys[0]
  const weekEnd = weekDateKeys[6]
  const today = formatDateKey(new Date())

  const yearMonth = currentYearMonthKST()
  const { start: monthStart, end: monthEnd } = yearMonthRange(yearMonth)

  const [{ data: eventRows }, { data: photoRows }, { count: memberCount }, holidays, { data: txRows }, { data: budgetRows }, { data: categoryRows }] =
    await Promise.all([
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
      supabase
        .from('t_transaction')
        .select('transaction_id, tx_dt, tx_type, category_id, amount, memo')
        .gte('tx_dt', monthStart)
        .lte('tx_dt', monthEnd)
        .order('tx_dt', { ascending: false }),
      supabase.from('t_budget').select('amount').eq('year_month', yearMonth),
      supabase.from('t_budget_category').select('category_id, name'),
    ])

  const recentPhotos = await toSignedPhotos(supabase, photoRows ?? [])

  // 가계부 위젯: 이번 달 수입/지출/예산 합계 — 로직은 /budget 페이지와 동일하게 lib/budget/calc를 재사용한다.
  const totalIncome = (txRows ?? []).filter((t) => t.tx_type === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = (txRows ?? []).filter((t) => t.tx_type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0)
  const totalBudget = (budgetRows ?? []).reduce((sum, b) => sum + b.amount, 0)
  const maxFlow = Math.max(totalIncome, totalExpense, 1)
  const categoryNameById = new Map((categoryRows ?? []).map((c) => [c.category_id, c.name]))
  const recentTx = (txRows ?? []).slice(0, 2).map((t) => ({
    id: t.transaction_id,
    date: t.tx_dt,
    txType: t.tx_type,
    amount: t.amount,
    label: t.memo || categoryNameById.get(t.category_id) || '기타',
  }))

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
            <div className="card-title">이번 달 가계부</div>
            <Link href="/budget" className="card-link">가계부 열기 →</Link>
          </div>
          <div className="budget-top">
            <div className="budget-amt">{formatWon(totalExpense)}</div>
            <div className="budget-sub">/ 예산 {formatWon(totalBudget)}</div>
          </div>
          <div className="budget-bar">
            <div className="budget-fill" style={{ width: `${Math.min(calcBudgetUsage(totalExpense, totalBudget), 100)}%` }} />
          </div>
          <div className="budget-rows" style={{ marginTop: 14 }}>
            <div className="budget-row"><span>수입</span><b>{formatWon(totalIncome)}</b></div>
            <div className="budget-bar">
              <div className="budget-fill" style={{ width: `${(totalIncome / maxFlow) * 100}%`, background: 'var(--burgundy)' }} />
            </div>
            <div className="budget-row"><span>지출</span><b>{formatWon(totalExpense)}</b></div>
            <div className="budget-bar">
              <div className="budget-fill" style={{ width: `${(totalExpense / maxFlow) * 100}%`, background: 'var(--gold)' }} />
            </div>
          </div>
          <div className="budget-rows">
            {recentTx.map((tx) => (
              <div className="budget-row" key={tx.id}>
                <span>{monthDay(tx.date)} · {tx.label}</span>
                <b style={{ color: tx.txType === 'EXPENSE' ? 'var(--gold)' : 'var(--burgundy)' }}>
                  {tx.txType === 'EXPENSE' ? '-' : '+'}{formatWon(tx.amount)}
                </b>
              </div>
            ))}
            {recentTx.length === 0 && <div className="budget-row"><span>이번 달 거래가 없어요</span></div>}
          </div>
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
