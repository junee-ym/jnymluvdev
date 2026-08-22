'use client'

import { useRef, useState } from 'react'
import { PhotoLightbox } from '@/components/photo-lightbox'
import type { Photo } from '@/lib/types'

function formatDateKR(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}

// 대시보드 "최근 앨범" 카드 — 사진을 누르면 앨범으로 이동하는 대신 팝업으로 바로 보여준다.
// 항목이 5개보다 많아 가로 캐러셀로 표시(모바일은 스와이프, PC는 화살표 버튼).
export function RecentAlbum({ photos }: { photos: Photo[] }) {
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  function scrollByCard(dir: 1 | -1) {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: dir * (track.clientWidth / 3), behavior: 'smooth' })
  }

  return (
    <>
      <div className="album-carousel">
        <div className="album-track" ref={trackRef}>
          {photos.map((photo) => (
            <div className="ph" key={photo.id} onClick={() => setLightboxPhoto(photo)} style={{ cursor: 'pointer' }}>
              <img src={photo.signedUrl} alt={photo.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <span className="ph-date">{formatDateKR(photo.date)}</span>
              {photo.location && <span className="ph-loc">{photo.location}</span>}
            </div>
          ))}
        </div>
        <button type="button" className="album-nav prev" onClick={() => scrollByCard(-1)} aria-label="이전 사진">‹</button>
        <button type="button" className="album-nav next" onClick={() => scrollByCard(1)} aria-label="다음 사진">›</button>
      </div>
      {lightboxPhoto && (
        <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </>
  )
}
