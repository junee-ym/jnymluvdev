'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 초대/비밀번호 재설정 메일은 Admin API(inviteUserByEmail 등)로 발송되는데,
// 이 방식은 브라우저 세션이 없는 상태에서 서버가 대신 트리거하는 것이라
// PKCE(?code=...)를 쓸 수 없다 — Supabase의 /auth/v1/verify 엔드포인트는
// 검증 후 세션 토큰을 URL 해시(#access_token=...&refresh_token=...)로 실어
// 돌려준다. 해시는 브라우저 밖으로(서버로) 절대 전송되지 않으므로, 이 처리는
// 반드시 클라이언트 컴포넌트에서 해야 한다.
export default function ConfirmPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')
    const errorDescription = params.get('error_description')

    if (errorDescription || !accessToken || !refreshToken) {
      router.replace('/login?error=confirm')
      return
    }

    const supabase = createClient()
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        if (sessionError) {
          setError('로그인 처리에 실패했어요. 초대 링크가 만료됐을 수 있어요.')
          return
        }
        if (type === 'invite' || type === 'recovery') {
          router.replace('/auth/set-password')
        } else {
          router.replace('/')
        }
      })
  }, [router])

  return (
    <div id="loginScreen">
      <div className="login-card">
        <div className="login-mark">우</div>
        <div className="login-title">확인하는 중이에요...</div>
        {error ? (
          <p style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</p>
        ) : (
          <p className="login-sub">잠시만 기다려주세요.</p>
        )}
      </div>
    </div>
  )
}
