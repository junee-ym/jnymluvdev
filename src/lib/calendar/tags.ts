import type { CalendarEvent } from '@/lib/types'

// DB(t_tag.color check 제약)와 동일한 목록을 유지해야 한다.
export const TAG_COLORS = [
  '#0072DE', '#12B76A', '#F79009', '#D92D20', '#7A5AF8',
  '#EE46BC', '#06AED4', '#EAAA08', '#667085',
] as const

// activeTagIds가 비어있으면(필터 없음) 전체를 보여준다. 아니면 활성 태그 중
// 하나라도 달린 일정만 남긴다.
export function filterEventsByTags(
  events: CalendarEvent[],
  activeTagIds: string[]
): CalendarEvent[] {
  if (activeTagIds.length === 0) return events
  return events.filter((e) => e.tags.some((t) => activeTagIds.includes(t.id)))
}
