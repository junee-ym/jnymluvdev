'use client'

import type { Photo, Profile } from '@/lib/types'

function formatDateKR(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dows = ['일', '월', '화', '수', '목', '금', '토']
  const date = new Date(y, m - 1, d)
  return `${y}년 ${m}월 ${d}일 (${dows[date.getDay()]})`
}

function groupByDate(photos: Photo[]): [string, Photo[]][] {
  const byDate = new Map<string, Photo[]>()
  for (const photo of photos) {
    const list = byDate.get(photo.date) ?? []
    list.push(photo)
    byDate.set(photo.date, list)
  }
  return Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

export function AlbumClient({ photos }: { photos: Photo[]; profile: Profile }) {
  const sections = groupByDate(photos)

  if (sections.length === 0) {
    return (
      <div className="placeholder-page">
        <div className="ic">🖼</div>
        <h2>아직 추가된 사진이 없어요</h2>
        <p>가족과의 순간을 올려보세요.</p>
      </div>
    )
  }

  return (
    <div>
      {sections.map(([date, group]) => (
        <div className="album-section" key={date}>
          <div className="album-section-title">{formatDateKR(date)}</div>
          <div className="photo-grid">
            {group.map((photo) => (
              <div className="photo-thumb" key={photo.id}>
                <img src={photo.signedUrl} alt={photo.caption ?? ''} />
                {photo.caption && <div className="cap">{photo.caption}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
