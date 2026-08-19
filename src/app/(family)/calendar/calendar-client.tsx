'use client'

import { useState } from 'react'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHoliday } from '@/lib/calendar/holidays'
import type { CalendarEvent, Profile } from '@/lib/types'

const DOWS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarClient({
  events,
  profile,
}: {
  events: CalendarEvent[]
  profile: Profile
}) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [cursor, setCursor] = useState(new Date())

  const eventsFor = (dateKey: string) => events.filter((e) => e.date === dateKey)

  function shift(dir: number) {
    if (viewMode === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
    } else {
      const d = new Date(cursor)
      d.setDate(d.getDate() + dir * 7)
      setCursor(d)
    }
  }

  return (
    <section>
      <div className="cal-header">
        <div className="cal-title-group">
          <div className="cal-title">
            {viewMode === 'month'
              ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
              : `${formatDateKey(buildWeekGrid(cursor)[0])} ~ ${formatDateKey(buildWeekGrid(cursor)[6])}`}
          </div>
          <div className="cal-nav">
            <button onClick={() => shift(-1)}>‹</button>
            <button onClick={() => shift(1)}>›</button>
          </div>
          <button className="today-btn" onClick={() => setCursor(new Date())}>오늘</button>
        </div>
        <div className="cal-actions">
          <div className="view-toggle">
            <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>월</button>
            <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>주</button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="month-grid">
          <div className="weekday-row">
            {DOWS.map((d, i) => (
              <div key={d} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{d}</div>
            ))}
          </div>
          <div className="day-rows">
            {buildMonthGrid(cursor.getFullYear(), cursor.getMonth()).map((cell) => {
              const holiday = getHoliday(cell.dateKey)
              const dayEvents = eventsFor(cell.dateKey)
              const isToday = cell.dateKey === formatDateKey(new Date())
              const dow = cell.date.getDay()
              return (
                <div
                  key={cell.dateKey}
                  className={[
                    'day-cell',
                    !cell.inCurrentMonth && 'muted',
                    isToday && 'today',
                    (dow === 0 || dow === 6) && 'wknd',
                    holiday?.type,
                  ].filter(Boolean).join(' ')}
                >
                  <div className="day-num">{cell.date.getDate()}</div>
                  {holiday && <div className={`evt ${holiday.type}`}>{holiday.name}</div>}
                  {dayEvents.slice(0, holiday ? 1 : 2).map((ev) => (
                    <div className="evt" key={ev.id}>{ev.title}</div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="week-view active">
          {buildWeekGrid(cursor).map((date, i) => {
            const dateKey = formatDateKey(date)
            const holiday = getHoliday(dateKey)
            const dayEvents = eventsFor(dateKey)
            const isToday = dateKey === formatDateKey(new Date())
            return (
              <div key={dateKey} className={`week-col${isToday ? ' today' : ''}`}>
                <div className="week-col-head">
                  <div className="dow">{DOWS[i]}</div>
                  <div className="num">{date.getDate()}</div>
                </div>
                <div className="week-events">
                  {holiday && <div className="week-evt holiday">{holiday.name}</div>}
                  {dayEvents.map((ev) => (
                    <div className="week-evt" key={ev.id}>{ev.title}{ev.time ? ` ${ev.time}` : ''}</div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
