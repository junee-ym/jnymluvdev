'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '@/components/toast-provider'
import { canModify } from '@/lib/auth/permissions'
import {
  addComment,
  deleteComment,
  deletePhoto,
  updateComment,
  updatePhoto,
  type CommentFormState,
  type PhotoFormState,
} from '@/app/(family)/album/actions'
import type { Comment, Photo, Profile } from '@/lib/types'

function formatCommentDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

// 댓글 한 줄: 보기 상태 / 본인이거나 운영자·관리자면 수정·삭제 가능.
function CommentItem({
  comment,
  profile,
  onUpdated,
  onDeleted,
}: {
  comment: Comment
  profile: Profile
  onUpdated: (comment: Comment) => void
  onDeleted: (commentId: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const initialState: CommentFormState = { error: null }
  const [updateState, updateFormAction, updatePending] = useActionState(updateComment, initialState)
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteComment, initialState)

  // updatePhoto/deletePhoto와 같은 이유로 pending의 true→false 전이에서만 결과를 반영한다.
  const wasUpdatePending = useRef(false)
  useEffect(() => {
    if (wasUpdatePending.current && !updatePending && !updateState.error && updateState.comment) {
      onUpdated(updateState.comment)
      setEditing(false)
    }
    wasUpdatePending.current = updatePending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatePending, updateState])

  const wasDeletePending = useRef(false)
  useEffect(() => {
    if (wasDeletePending.current && !deletePending && !deleteState.error && deleteState.deletedId) {
      onDeleted(deleteState.deletedId)
    }
    wasDeletePending.current = deletePending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletePending, deleteState])

  const canEdit = canModify(profile.userId, comment.userId, profile.role)

  if (editing) {
    return (
      <form action={updateFormAction} className="comment-item comment-editing">
        <input type="hidden" name="commentId" value={comment.id} />
        <input type="text" name="content" defaultValue={comment.content} maxLength={500} autoFocus />
        {updateState.error && <p style={{ color: 'var(--danger)', fontSize: 11 }}>{updateState.error}</p>}
        <div className="comment-edit-actions">
          <button type="button" onClick={() => setEditing(false)}>취소</button>
          <button type="submit" disabled={updatePending}>저장</button>
        </div>
      </form>
    )
  }

  return (
    <div className="comment-item">
      <div className="comment-head">
        <span className="comment-author">{comment.userName}</span>
        <span className="comment-date">{formatCommentDate(comment.createdAt)}</span>
      </div>
      <p className="comment-content">{comment.content}</p>
      {canEdit && (
        <div className="comment-item-actions">
          <button type="button" onClick={() => setEditing(true)}>수정</button>
          <form action={deleteFormAction} style={{ display: 'inline' }}>
            <input type="hidden" name="commentId" value={comment.id} />
            <button type="submit" disabled={deletePending}>삭제</button>
          </form>
        </div>
      )}
      {deleteState.error && <p style={{ color: 'var(--danger)', fontSize: 11 }}>{deleteState.error}</p>}
    </div>
  )
}

// 앨범 페이지, 대시보드 "최근 앨범"에서 공통으로 쓰는 사진 팝업.
export function PhotoLightbox({ photo, profile, onClose }: { photo: Photo; profile: Profile; onClose: () => void }) {
  const { showToast } = useToast()
  const [showFull, setShowFull] = useState(false)
  const [comments, setComments] = useState<Comment[]>(photo.comments)

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

  const addCommentInitial: CommentFormState = { error: null }
  const [addState, addFormAction, addPending] = useActionState(addComment, addCommentInitial)
  const addFormRef = useRef<HTMLFormElement>(null)

  const wasAddPending = useRef(false)
  useEffect(() => {
    if (wasAddPending.current && !addPending && !addState.error && addState.comment) {
      setComments((prev) => [...prev, addState.comment as Comment])
      addFormRef.current?.reset()
    }
    wasAddPending.current = addPending
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addPending, addState])

  return createPortal(
    <div className="lightbox-overlay open" onClick={(e) => { if (e.target === e.currentTarget) requestClose() }}>
      <div className="lightbox">
        <img
          className="lightbox-img"
          src={photo.signedUrl}
          alt=""
          onClick={() => setShowFull(true)}
          style={{ cursor: 'zoom-in' }}
        />
        <div className="lightbox-body">
          <form action={updateFormAction}>
            <input type="hidden" name="photoId" value={photo.id} />
            <div className="lightbox-row">
              <div>
                <label>등록일</label>
                <input type="text" value={photo.registeredDate} readOnly />
              </div>
              <div>
                <label>촬영일</label>
                <input type="text" value={photo.date} readOnly />
              </div>
            </div>
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

          <div className="comment-section">
            <label>댓글 {comments.length > 0 && `(${comments.length})`}</label>
            <div className="comment-list">
              {comments.length === 0 ? (
                <p className="comment-empty">아직 댓글이 없어요.</p>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    profile={profile}
                    onUpdated={(updated) =>
                      setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
                    }
                    onDeleted={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
                  />
                ))
              )}
            </div>
            <form action={addFormAction} ref={addFormRef} className="comment-add-form">
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="text" name="content" placeholder="댓글을 남겨보세요" maxLength={500} />
              <button type="submit" disabled={addPending}>등록</button>
            </form>
            {addState.error && <p style={{ color: 'var(--danger)', fontSize: 11 }}>{addState.error}</p>}
          </div>
        </div>
      </div>
      {showFull && (
        <div className="lightbox-full-overlay" onClick={() => setShowFull(false)}>
          <img className="lightbox-full-img" src={photo.signedUrl} alt="" />
        </div>
      )}
    </div>,
    document.body
  )
}
