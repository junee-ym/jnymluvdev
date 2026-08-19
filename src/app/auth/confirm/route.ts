import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 초대/비밀번호 재설정 링크는 아직 t_user 행이 없는 게 정상이다.
      // set-password가 초대(t_invite) 검증을 직접 하므로 여기서는 통과시킨다.
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/set-password`)
      }

      // 그 외 경로(= Google OAuth)는 "구글 계정만 있으면 아무나 들어올 수 있는"
      // 구멍이 된다. 실제 가족 구성원(t_user 행 보유)인지 확인하고, 아니면
      // 세션을 지우고 돌려보낸다.
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
