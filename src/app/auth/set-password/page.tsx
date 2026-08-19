'use client'

import { useActionState } from 'react'
import { setPassword, type SetPasswordState } from './actions'

const initialState: SetPasswordState = { error: null }

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(setPassword, initialState)

  return (
    <div id="loginScreen">
      <div className="login-card">
        <div className="login-mark">우</div>
        <div className="login-title">환영해요!</div>
        <p className="login-sub">이름과 비밀번호를 설정하고 우리집에 들어오세요.</p>

        <form action={formAction} className="member-list">
          <input type="text" name="name" placeholder="이름" required />
          <input type="password" name="password" placeholder="비밀번호 (8자 이상)" required minLength={8} />
          {state.error && <p style={{ color: 'var(--burgundy)', fontSize: 12.5 }}>{state.error}</p>}
          <button type="submit" className="invite-btn" disabled={pending}>
            {pending ? '설정 중...' : '시작하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
