'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateKey } from '@/lib/calendar/grid'
import { useToast } from '@/components/toast-provider'
import { deletePhoto, savePhotoMeta, updatePhoto, type PhotoFormState } from './actions'
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

  const initialState: PhotoFormState = { error: null }
  const [updateState, updateFormAction, updatePending] = useActionState(updatePhoto, initialState)
  const [deleteState, deleteFormAction, deletePending] = useActionState(deletePhoto, initialState)

  // Task 18(달력 CRUD) 리뷰에서 발견된 버그와 동일한 함정을 피한다: <form action={...}>를
  // async 래퍼로 감싸 디스패치 직후 *State를 읽으면 아직 이전 렌더의 값(초기값)이라
  // 실패한 요청도 항상 성공으로 표시된다. pending이 true→false로 바뀌는 렌더에서만
  // state가 이 요청의 실제 결과로 갱신돼 있으므로, 그 전이를 감지해서 처리한다.
  const wasUpdatePending = useRef(false)
  useEffect(() => {
    if (wasUpdatePending.current && !updatePending && !updateState.error) {
      showToast('사진 정보를 저장했어요')
      setLightboxPhoto(null)
    }
    wasUpdatePending.current = updatePending
  }, [updatePending, updateState, showToast])

  const wasDeletePending = useRef(false)
  useEffect(() => {
    if (wasDeletePending.current && !deletePending && !deleteState.error) {
      showToast('사진을 삭제했어요')
      setLightboxPhoto(null)
    }
    wasDeletePending.current = deletePending
  }, [deletePending, deleteState, showToast])

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
      const formData = new FormData()
      formData.set('path', path)
      formData.set('date', today)
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
        <div className="lightbox-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setLightboxPhoto(null) }}>
          <div className="lightbox">
            <img className="lightbox-img" src={lightboxPhoto.signedUrl} alt="" />
            <div className="lightbox-body">
              <form action={updateFormAction}>
                <input type="hidden" name="photoId" value={lightboxPhoto.id} />
                <label>날짜</label>
                <input type="date" name="date" defaultValue={lightboxPhoto.date} required />
                <label>메모</label>
                <input type="text" name="caption" defaultValue={lightboxPhoto.caption ?? ''} placeholder="예: 거실에서" />
                <label>장소 (선택)</label>
                <input type="text" name="location" defaultValue={lightboxPhoto.location ?? ''} placeholder="예: 제주도" />
                {updateState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{updateState.error}</p>}
                <div className="lightbox-actions">
                  <button type="button" className="btn-cancel" onClick={() => setLightboxPhoto(null)}>닫기</button>
                  <button type="submit" className="btn-save" disabled={updatePending}>저장</button>
                </div>
              </form>
              <form action={deleteFormAction}>
                <input type="hidden" name="photoId" value={lightboxPhoto.id} />
                {deleteState.error && (
                  <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteState.error}</p>
                )}
                <button type="submit" className="btn-delete" disabled={deletePending}>이 사진 삭제하기</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
