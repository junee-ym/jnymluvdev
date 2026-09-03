'use client'

import { useActionState, useCallback, useEffect, useRef, useState } from 'react'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import type { Holiday } from '@/lib/calendar/holidays'
import { canModify, isOperatorOrAdmin } from '@/lib/auth/permissions'
import { TAG_COLORS, filterEventsByTags } from '@/lib/calendar/tags'
import type { CalendarEvent, Profile, Tag } from '@/lib/types'
import { createEvent, deleteEvent, updateEvent, type EventFormState } from './actions'
import { createTag, deleteTag, updateTag, type TagFormState } from './tag-actions'
import { useToast } from '@/components/toast-provider'

const DOWS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarClient({
  events,
  tags,
  profile,
}: {
  events: CalendarEvent[]
  tags: Tag[]
  profile: Profile
}) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [cursor, setCursor] = useState(new Date())
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [activeTagIds, setActiveTagIds] = useState<string[]>([])
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [tagFormColor, setTagFormColor] = useState<string>(TAG_COLORS[0])
  const { showToast } = useToast()
  const canManageTags = isOperatorOrAdmin(profile.role)

  const filteredEvents = filterEventsByTags(events, activeTagIds)
  function toggleTagFilter(tagId: string) {
    setActiveTagIds((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]))
  }

  // 서비스키를 클라이언트에 노출하지 않으려고 /api/holidays를 거쳐 연도별로 받아온다.
  // 사용자가 월/주를 넘기며 걸치는 연도가 늘어날 때마다 캐시에 채운다.
  const [holidaysByYear, setHolidaysByYear] = useState<Record<number, Record<string, Holiday>>>({})
  useEffect(() => {
    const years =
      viewMode === 'month'
        ? buildMonthGrid(cursor.getFullYear(), cursor.getMonth()).map((c) => c.date.getFullYear())
        : buildWeekGrid(cursor).map((d) => d.getFullYear())
    const missing = [...new Set(years)].filter((y) => !(y in holidaysByYear))
    if (missing.length === 0) return
    Promise.all(missing.map((y) => fetch(`/api/holidays?year=${y}`).then((r) => r.json())))
      .then((results) => {
        setHolidaysByYear((prev) => {
          const next = { ...prev }
          missing.forEach((y, i) => { next[y] = results[i] })
          return next
        })
      })
      .catch(() => {}) // 실패하면 그냥 공휴일 표시 없이 렌더 (달력 자체는 정상 동작)
  }, [cursor, viewMode, holidaysByYear])
  const getHoliday = (dateKey: string): Holiday | null =>
    holidaysByYear[Number(dateKey.slice(0, 4))]?.[dateKey] ?? null
  const initialEventState: EventFormState = { error: null }
  const [createState, createFormAction, createPending] = useActionState(createEvent, initialEventState)
  const [updateState, updateFormAction, updatePending] = useActionState(updateEvent, initialEventState)
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteEvent, initialEventState)

  const initialTagState: TagFormState = { error: null }
  const [createTagState, createTagFormAction, createTagPending] = useActionState(createTag, initialTagState)
  const [updateTagState, updateTagFormAction, updateTagPending] = useActionState(updateTag, initialTagState)
  const [deleteTagState, deleteTagFormAction, deleteTagPending] = useActionState(deleteTag, initialTagState)

  const eventsFor = (dateKey: string) => filteredEvents.filter((e) => e.date === dateKey)

  function openModal(dateKey: string, event?: CalendarEvent) {
    setModalDate(dateKey)
    setEditingEvent(event ?? null)
  }
  // 아래 pending 전이 감지 useEffect들의 의존성 배열에 넣기 위해 참조를 고정한다.
  const closeModal = useCallback(() => {
    setModalDate(null)
    setEditingEvent(null)
  }, [])

  function openTagForm(tag?: Tag) {
    setEditingTag(tag ?? null)
    setTagFormColor(tag?.color ?? TAG_COLORS[0])
  }
  const closeTagModal = useCallback(() => {
    setTagModalOpen(false)
    setEditingTag(null)
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

  const wasCreateTagPending = useRef(false)
  useEffect(() => {
    if (wasCreateTagPending.current && !createTagPending && !createTagState.error) {
      showToast('태그를 만들었어요')
      openTagForm()
    }
    wasCreateTagPending.current = createTagPending
  }, [createTagPending, createTagState, showToast])

  const wasUpdateTagPending = useRef(false)
  useEffect(() => {
    if (wasUpdateTagPending.current && !updateTagPending && !updateTagState.error) {
      showToast('태그를 수정했어요')
      openTagForm()
    }
    wasUpdateTagPending.current = updateTagPending
  }, [updateTagPending, updateTagState, showToast])

  const wasDeleteTagPending = useRef(false)
  useEffect(() => {
    if (wasDeleteTagPending.current && !deleteTagPending && !deleteTagState.error) {
      showToast('태그를 삭제했어요')
      openTagForm()
    }
    wasDeleteTagPending.current = deleteTagPending
  }, [deleteTagPending, deleteTagState, showToast])

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
          {canManageTags && (
            <button className="tag-manage-btn" onClick={() => { openTagForm(); setTagModalOpen(true) }}>태그 관리</button>
          )}
          <button className="add-event" onClick={() => openModal(formatDateKey(cursor))}>+ 일정 추가</button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="tag-filter-row">
          {tags.map((tag) => {
            const active = activeTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                className="tag-chip"
                style={
                  active
                    ? { background: tag.color, borderColor: tag.color, color: '#fff' }
                    : { background: `${tag.color}1f`, borderColor: tag.color, color: tag.color }
                }
                onClick={() => toggleTagFilter(tag.id)}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

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
                  {dayEvents.map((ev) => (
                    <div
                      className="evt"
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openModal(cell.dateKey, ev) }}
                    >
                      {ev.tags[0] && <span className="tag-dot" style={{ background: ev.tags[0].color }} />}
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
                      {ev.tags[0] && <span className="tag-dot" style={{ background: ev.tags[0].color }} />}
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
              {tags.length > 0 && (
                <>
                  <label>태그 (선택)</label>
                  <div className="tag-checkbox-row">
                    {tags.map((tag) => (
                      <label key={tag.id} className="tag-checkbox" style={{ borderColor: tag.color, color: tag.color }}>
                        <input
                          type="checkbox"
                          name="tagIds"
                          value={tag.id}
                          defaultChecked={editingEvent?.tags.some((t) => t.id === tag.id) ?? false}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                </>
              )}
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

      {tagModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeTagModal() }}>
          <div className="modal">
            <h3>태그 관리</h3>
            {tags.length > 0 && (
              <ul className="tag-manage-list">
                {tags.map((tag) => (
                  <li key={tag.id}>
                    <span className="tag-dot" style={{ background: tag.color }} />
                    <span className="tag-manage-name">{tag.name}</span>
                    <button type="button" className="btn-cancel" onClick={() => openTagForm(tag)}>수정</button>
                    <form action={deleteTagFormAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="tagId" value={tag.id} />
                      <button type="submit" className="btn-delete" disabled={deleteTagPending}>삭제</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {deleteTagState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteTagState.error}</p>}

            <form key={editingTag?.id ?? 'new'} action={editingTag ? updateTagFormAction : createTagFormAction}>
              <h3 style={{ fontSize: 13, marginTop: 18 }}>{editingTag ? '태그 수정' : '새 태그'}</h3>
              {editingTag && <input type="hidden" name="tagId" value={editingTag.id} />}
              <label>이름</label>
              <input type="text" name="name" defaultValue={editingTag?.name ?? ''} placeholder="예: 학교" required />
              <label>색상</label>
              <input type="hidden" name="color" value={tagFormColor} />
              <div className="tag-color-palette">
                {TAG_COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`tag-color-swatch${tagFormColor === color ? ' selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setTagFormColor(color)}
                    aria-label={color}
                  />
                ))}
              </div>
              {(createTagState.error || updateTagState.error) && (
                <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createTagState.error ?? updateTagState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeTagModal}>닫기</button>
                <button type="submit" className="btn-save" disabled={createTagPending || updateTagPending}>
                  {editingTag ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
