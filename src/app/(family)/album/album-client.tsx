'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateKey } from '@/lib/calendar/grid'
import { getExifDate, getExifGps } from '@/lib/exif'
import { useToast } from '@/components/toast-provider'
import { PhotoLightbox } from '@/components/photo-lightbox'
import { savePhotoMeta } from './actions'
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

export function AlbumClient({ photos, profile }: { photos: Photo[]; profile: Profile }) {
  const sections = groupByDate(photos)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const supabase = createClient()
    // toISOString()은 UTC 기준이라 한국 시간 오전 9시 이전에는 어제 날짜가 된다.
    // 이 앱의 다른 날짜 처리와 동일하게 로컬 시간 기준 formatDateKey를 쓴다.
    const today = formatDateKey(new Date())

    let succeeded = 0
    let failed = 0

    for (const file of Array.from(files)) {
      const path = `${profile.userId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file)
      if (uploadError) {
        failed++
        continue
      }
      // 촬영일 기본값: EXIF DateTimeOriginal -> 파일 수정일 -> 오늘 순으로 시도.
      const exifDate = await getExifDate(file)
      const date = exifDate ?? (file.lastModified ? formatDateKey(new Date(file.lastModified)) : today)
      // EXIF GPS가 있으면 좌표를 같이 보내 서버에서 역지오코딩(위치명 자동 채움)한다.
      const gps = await getExifGps(file)
      const formData = new FormData()
      formData.set('path', path)
      formData.set('date', date)
      if (gps) {
        formData.set('lat', String(gps.lat))
        formData.set('lng', String(gps.lng))
      }
      // savePhotoMeta는 'use server' 함수이므로 이벤트 핸들러에서 직접 호출해
      // 반환값을 그대로 받을 수 있다 (useActionState의 dispatch를 거치지 않음 —
      // 그 dispatch는 호출 직후 결과를 안전하게 읽을 방법이 없다는 게 Task 20
      // 리뷰에서 드러났다: 업로드가 storage에는 성공했는데 메타데이터 저장은
      // 실패해도 항상 "추가했어요" 토스트가 떴다).
      const result = await savePhotoMeta({ error: null }, formData)
      if (result.error) {
        failed++
      } else {
        succeeded++
      }
    }

    setUploading(false)
    if (failed === 0) {
      showToast('사진을 추가했어요')
    } else if (succeeded === 0) {
      showToast('사진 업로드에 실패했어요')
    } else {
      showToast(`사진 ${succeeded}장을 추가했어요 (${failed}장 실패)`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <div className="cal-header">
        <div className="cal-title-group"><div className="cal-title">앨범</div></div>
        <div className="cal-actions">
          <label className="add-event" style={{ cursor: 'pointer' }}>
            {uploading ? '업로드 중...' : '+ 사진 추가'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="placeholder-page">
          <div className="ic">🖼</div>
          <h2>아직 추가된 사진이 없어요</h2>
          <p>위 &quot;+ 사진 추가&quot; 버튼으로 첫 사진을 올려보세요.</p>
        </div>
      ) : (
        sections.map(([date, group]) => (
          <div className="album-section" key={date}>
            <div className="album-section-title">{formatDateKR(date)}</div>
            <div className="photo-grid">
              {group.map((photo) => (
                <div className="photo-thumb" key={photo.id} onClick={() => setLightboxPhoto(photo)}>
                  <img src={photo.signedUrl} alt={photo.caption ?? ''} />
                  {photo.caption && <div className="cap">{photo.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {lightboxPhoto && (
        <PhotoLightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  )
}
