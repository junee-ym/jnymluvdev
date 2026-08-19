'use client'

import { useActionState, useState } from 'react'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHoliday } from '@/lib/calendar/holidays'
import type { CalendarEvent, Profile } from '@/lib/types'
import { createEvent, deleteEvent, updateEvent, type EventFormState } from './actions'
import { useToast } from '@/components/toast-provider'

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
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const { showToast } = useToast()
  const initialEventState: EventFormState = { error: null }
  const [createState, createFormAction] = useActionState(createEvent, initialEventState)
  const [updateState, updateFormAction] = useActionState(updateEvent, initialEventState)
  const [deleteState, deleteFormAction] = useActionState(deleteEvent, initialEventState)

  const eventsFor = (dateKey: string) => events.filter((e) => e.date === dateKey)

  function openModal(dateKey: string, event?: CalendarEvent) {
    setModalDate(dateKey)
    setEditingEvent(event ?? null)
  }
  function closeModal() {
    setModalDate(null)
    setEditingEvent(null)
  }

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
          <button className="add-event" onClick={() => openModal(formatDateKey(cursor))}>+ 일정 추가</button>
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
                  onClick={() => openModal(cell.dateKey)}
                >
                  <div className="day-num">{cell.date.getDate()}</div>
                  {holiday && <div className={`evt ${holiday.type}`}>{holiday.name}</div>}
                  {dayEvents.slice(0, holiday ? 1 : 2).map((ev) => (
                    <div
                      className="evt"
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openModal(cell.dateKey, ev) }}
                    >
                      {ev.title}
                    </div>
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
              <div
                key={dateKey}
                className={[
                  'week-col',
                  isToday && 'today',
                  (i === 0 || i === 6) && 'wknd',
                  holiday?.type,
                ].filter(Boolean).join(' ')}
                onClick={() => openModal(dateKey)}
              >
                <div className="week-col-head">
                  <div className="dow">{DOWS[i]}</div>
                  <div className="num">{date.getDate()}</div>
                </div>
                <div className="week-events">
                  {holiday && <div className="week-evt holiday">{holiday.name}</div>}
                  {dayEvents.map((ev) => (
                    <div
                      className="week-evt"
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openModal(dateKey, ev) }}
                    >
                      {ev.title}{ev.time ? ` ${ev.time}` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalDate && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="modal">
            <h3>{editingEvent ? '일정 수정' : '일정 추가'}</h3>
            <form
              action={async (formData) => {
                const result = editingEvent
                  ? await updateFormAction(formData)
                  : await createFormAction(formData)
                if (!(editingEvent ? updateState.error : createState.error)) {
                  showToast(editingEvent ? '일정이 수정됐어요' : '일정이 저장됐어요')
                  closeModal()
                }
              }}
            >
              {editingEvent && <input type="hidden" name="eventId" value={editingEvent.id} />}
              <label>날짜</label>
              <input type="date" name="date" defaultValue={editingEvent?.date ?? modalDate} required />
              <label>제목</label>
              <input type="text" name="title" defaultValue={editingEvent?.title ?? ''} placeholder="예: 가족 저녁" required />
              <label>시간 (선택)</label>
              <input type="time" name="time" defaultValue={editingEvent?.time ?? ''} />
              {(createState.error || updateState.error) && (
                <p style={{ color: 'var(--burgundy)', fontSize: 12 }}>{createState.error ?? updateState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>취소</button>
                <button type="submit" className="btn-save">저장</button>
              </div>
            </form>
            {editingEvent && (
              <form
                action={async (formData) => {
                  await deleteFormAction(formData)
                  if (!deleteState.error) {
                    showToast('일정을 삭제했어요')
                    closeModal()
                  }
                }}
              >
                <input type="hidden" name="eventId" value={editingEvent.id} />
                <button type="submit" className="btn-delete">이 일정 삭제하기</button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
