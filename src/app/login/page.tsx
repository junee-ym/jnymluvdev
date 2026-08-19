import { LoginClient } from './login-client'

// 리다이렉트로 넘어오는 ?error= 코드별 안내 문구.
// (auth/confirm의 confirm·not_invited, requireProfile의 not_member, loginWithGoogle의 google)
const ERROR_MESSAGES: Record<string, string> = {
  google: '구글 로그인을 시작하지 못했어요. 다시 시도해주세요',
  confirm: '로그인 링크가 만료됐거나 올바르지 않아요. 다시 시도해주세요',
  not_invited: '초대받은 가족 계정이 아니에요. 운영자에게 초대를 요청해주세요',
  not_member: '가족 구성원 정보를 찾을 수 없어요. 운영자에게 문의해주세요',
}

// searchParams는 서버에서 읽는다. 클라이언트에서 useSearchParams()를 쓰면
// 프리렌더 시 Suspense 경계를 요구해 빌드가 깨진다.
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams
  const code = Array.isArray(error) ? error[0] : error
  const redirectError = code
    ? (ERROR_MESSAGES[code] ?? '로그인에 실패했어요. 다시 시도해주세요')
    : null

  return <LoginClient redirectError={redirectError} />
}
