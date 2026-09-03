import { describe, expect, it } from 'vitest'
import { filterEventsByTags } from './tags'
import type { CalendarEvent } from '@/lib/types'

function ev(id: string, tagIds: string[]): CalendarEvent {
  return {
    id,
    date: '2026-09-03',
    time: null,
    title: id,
    category: null,
    userId: 'u1',
    tags: tagIds.map((tid) => ({ id: tid, name: tid, color: '#0072DE' })),
  }
}

describe('filterEventsByTags', () => {
  it('활성 태그가 없으면 전체를 그대로 반환한다', () => {
    const events = [ev('a', ['t1']), ev('b', [])]
    expect(filterEventsByTags(events, [])).toEqual(events)
  })

  it('활성 태그 중 하나라도 달린 일정만 남긴다', () => {
    const events = [ev('a', ['t1']), ev('b', ['t2']), ev('c', [])]
    expect(filterEventsByTags(events, ['t1']).map((e) => e.id)).toEqual(['a'])
  })

  it('일정에 여러 태그가 있어도 활성 태그와 하나만 겹치면 포함한다', () => {
    const events = [ev('a', ['t1', 't2'])]
    expect(filterEventsByTags(events, ['t2']).map((e) => e.id)).toEqual(['a'])
  })
})
