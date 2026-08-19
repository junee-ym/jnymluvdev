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
          <p style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 12 }}>{redirectError}</p>
        )}

        <form action={formAction} className="member-list">
          <input type="email" name="email" placeholder="이메일" required />
          <input type="password" name="password" placeholder="비밀번호" required />
          {state.error && <p style={{ color: 'var(--danger)', fontSize: 12.5 }}>{state.error}</p>}
          <button type="submit" className="invite-btn" disabled={pending}>
            {pending ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <form action={loginWithGoogle} style={{ marginTop: 8 }}>
          <button type="submit" className="member-btn google-btn" style={{ width: '100%', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            Google로 로그인
          </button>
        </form>

        <p className="login-note" style={{ marginTop: 18 }}>
          회원가입은 없어요.
          <br />
          운영자·관리자가 보낸 초대 메일로만 가입할 수 있어요.
        </p>
      </div>
    </div>
  )
}
