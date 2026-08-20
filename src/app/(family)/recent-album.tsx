'use client'

import { useState } from 'react'
import { PhotoLightbox } from '@/components/photo-lightbox'
import type { Photo } from '@/lib/types'

// 대시보드 "최근 앨범" 카드 — 사진을 누르면 앨범으로 이동하는 대신 팝업으로 바로 보여준다.
export function RecentAlbum({ photos }: { photos: Photo[] }) {
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

  return (
    <>
      <div className="album-grid">
        {photos.map((photo) => (
          <div className="ph" key={photo.id} onClick={() => setLightboxPhoto(photo)} style={{ cursor: 'pointer' }}>
            <img src={photo.signedUrl} alt={photo.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ))}
      </div>
      {lightboxPhoto && (
        <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </>
  )
}
