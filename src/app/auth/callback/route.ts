import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Google OAuth 콜백 전용. Supabase JS 클라이언트는 브라우저가 시작하는
// OAuth 로그인에는 PKCE(?code=...) 방식을 쓰므로, 서버에서 code를 세션으로
// 교환할 수 있다. 초대/비밀번호 재설정 링크(Admin API로 발송)는 이 방식을
// 쓰지 않는다 — 그건 /auth/confirm(클라이언트 컴포넌트)이 처리한다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Google 계정만 있으면 아무나 들어올 수 있는 구멍을 막는다: 실제 가족
      // 구성원(t_user 행 보유)인지 확인하고, 아니면 세션을 지우고 돌려보낸다.
      const { data: { user } } = await supabase.auth.getUser()
      const { data: member } = user
        ? await supabase.from('t_user').select('user_id').eq('user_id', user.id).maybeSingle()
        : { data: null }

      if (!member) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=not_invited`)
      }

      return NextResponse.redirect(origin)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`)
}
