'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHoliday } from '@/lib/calendar/holidays'
import { canModify } from '@/lib/auth/permissions'
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
  const [createState, createFormAction, createPending] = useActionState(createEvent, initialEventState)
  const [updateState, updateFormAction, updatePending] = useActionState(updateEvent, initialEventState)
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteEvent, initialEventState)

  const eventsFor = (dateKey: string) => events.filter((e) => e.date === dateKey)

  function openModal(dateKey: string, event?: CalendarEvent) {
    setModalDate(dateKey)
    setEditingEvent(event ?? null)
  }
  // 아래 pending 전이 감지 useEffect들의 의존성 배열에 넣기 위해 참조를 고정한다.
  const closeModal = useCallback(() => {
    setModalDate(null)
    setEditingEvent(null)
  }, [])

  // 서버(actions.ts)가 이미 막고 있는 권한을 UI에도 반영한다 —
  // 남의 일정에는 삭제 버튼 자체를 보여주지 않는다.
  const canDeleteEditing =
    editingEvent !== null && canModify(profile.userId, editingEvent.userId, profile.role)

  // useActionState의 state는 액션이 완료된 뒤의 리렌더에서만 최신값이 된다.
  // <form action={async (formData) => { await dispatch(formData); if (!state.error) ... }}>처럼
  // 디스패치 직후 곧바로 state를 읽으면 "이전 렌더의" 값(대개 초기값 error:null)을 읽게 되어
  // 실패한 요청도 항상 성공으로 표시되는 버그가 생긴다. pending이 true→false로 바뀌는
  // 렌더에서는 state가 이미 그 요청의 실제 결과로 갱신되어 있으므로, 그 전이(edge)를
  // useRef로 감지해 토스트/모달 닫기를 실행한다.
  const wasCreatePending = useRef(false)
  useEffect(() => {
    if (wasCreatePending.current && !createPending && !createState.error) {
      showToast('일정이 저장됐어요')
      closeModal()
    }
    wasCreatePending.current = createPending
  }, [createPending, createState, showToast, closeModal])

  const wasUpdatePending = useRef(false)
  useEffect(() => {
    if (wasUpdatePending.current && !updatePending && !updateState.error) {
      showToast('일정이 수정됐어요')
      closeModal()
    }
    wasUpdatePending.current = updatePending
  }, [updatePending, updateState, showToast, closeModal])

  const wasDeletePending = useRef(false)
  useEffect(() => {
    if (wasDeletePending.current && !deletePending && !deleteState.error) {
      showToast('일정을 삭제했어요')
      closeModal()
    }
    wasDeletePending.current = deletePending
  }, [deletePending, deleteState, showToast, closeModal])

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
            <form action={editingEvent ? updateFormAction : createFormAction}>
              {editingEvent && <input type="hidden" name="eventId" value={editingEvent.id} />}
              <label>날짜</label>
              <input type="date" name="date" defaultValue={editingEvent?.date ?? modalDate} required />
              <label>제목</label>
              <input type="text" name="title" defaultValue={editingEvent?.title ?? ''} placeholder="예: 가족 저녁" required />
              <label>시간 (선택)</label>
              <input type="time" name="time" defaultValue={editingEvent?.time ?? ''} />
              {(createState.error || updateState.error) && (
                <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createState.error ?? updateState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeModal}>취소</button>
                <button type="submit" className="btn-save" disabled={createPending || updatePending}>저장</button>
              </div>
            </form>
            {editingEvent && canDeleteEditing && (
              <form action={deleteFormAction}>
                <input type="hidden" name="eventId" value={editingEvent.id} />
                {deleteState.error && (
                  <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteState.error}</p>
                )}
                <button type="submit" className="btn-delete" disabled={deletePending}>이 일정 삭제하기</button>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
