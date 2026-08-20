'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useToast } from '@/components/toast-provider'
import { deletePhoto, updatePhoto, type PhotoFormState } from '@/app/(family)/album/actions'
import type { Photo } from '@/lib/types'

// 앨범 페이지, 대시보드 "최근 앨범"에서 공통으로 쓰는 사진 팝업.
export function PhotoLightbox({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { showToast } = useToast()

  // 모바일 뒤로가기(제스처/하드웨어 버튼)를 누르면 페이지를 벗어나는 대신 팝업만 닫히게 한다.
  // 팝업을 열 때(마운트 시) history entry를 하나 쌓아두고, popstate(뒤로가기)가 오면
  // 그걸 닫기 신호로 쓴다.
  const pushedHistoryRef = useRef(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    window.history.pushState({ lightbox: true }, '')
    pushedHistoryRef.current = true
    function onPopState() {
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false
        onCloseRef.current()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function requestClose() {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false
      window.history.back()
    }
    onClose()
  }

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
      requestClose()
    }
    wasUpdatePending.current = updatePending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePending, updateState, showToast])

  const wasDeletePending = useRef(false)
  useEffect(() => {
    if (wasDeletePending.current && !deletePending && !deleteState.error) {
      showToast('사진을 삭제했어요')
      requestClose()
    }
    wasDeletePending.current = deletePending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletePending, deleteState, showToast])

  return (
    <div className="lightbox-overlay open" onClick={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="lightbox">
        <img className="lightbox-img" src={photo.signedUrl} alt="" />
        <div className="lightbox-body">
          <form action={updateFormAction}>
            <input type="hidden" name="photoId" value={photo.id} />
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
              촬영일 {photo.date} · 등록일 {photo.registeredDate}
            </p>
            <label>메모</label>
            <input type="text" name="caption" defaultValue={photo.caption ?? ''} placeholder="예: 거실에서" />
            <label>장소 (선택)</label>
            <input type="text" name="location" defaultValue={photo.location ?? ''} placeholder="예: 제주도" />
            {updateState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{updateState.error}</p>}
            <div className="lightbox-actions">
              <button type="button" className="btn-cancel" onClick={requestClose}>닫기</button>
              <button type="submit" className="btn-save" disabled={updatePending}>저장</button>
            </div>
          </form>
          <form action={deleteFormAction}>
            <input type="hidden" name="photoId" value={photo.id} />
            {deleteState.error && (
              <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteState.error}</p>
            )}
            <button type="submit" className="btn-delete" disabled={deletePending}>이 사진 삭제하기</button>
          </form>
        </div>
      </div>
    </div>
  )
}
