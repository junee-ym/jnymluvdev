'use client'

import { useActionState } from 'react'
import { loginWithGoogle, loginWithPassword, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export function LoginClient({ redirectError }: { redirectError: string | null }) {
  const [state, formAction, pending] = useActionState(loginWithPassword, initialState)

  return (
    <div id="loginScreen">
      <div className="login-card">
        <div className="login-mark">우</div>
        <div className="login-title">우리집</div>
        <p className="login-sub">
          가족만의 공간이에요.
          <br />
          이메일과 비밀번호로 로그인하세요.
        </p>

        {redirectError && (
          <p style={{ color: 'var(--burgundy)', fontSize: 12.5, marginBottom: 12 }}>{redirectError}</p>
        )}

        <form action={formAction} className="member-list">
          <input type="email" name="email" placeholder="이메일" required />
          <input type="password" name="password" placeholder="비밀번호" required />
          {state.error && <p style={{ color: 'var(--burgundy)', fontSize: 12.5 }}>{state.error}</p>}
          <button type="submit" className="invite-btn" disabled={pending}>
            {pending ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <form action={loginWithGoogle} style={{ marginTop: 8 }}>
          <button type="submit" className="member-btn" style={{ width: '100%', justifyContent: 'center' }}>
            Google로 로그인
          </button>
        </form>

        <p className="login-note" style={{ marginTop: 18 }}>
          회원가입은 없어요. 운영자·관리자가 보낸 초대 메일로만 가입할 수 있어요.
        </p>
      </div>
    </div>
  )
}
