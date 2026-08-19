@AGENTS.md

# 우리집 (jnymluvdev)

가족 전용 일상 기록/관리 사이트. 초대받은 가족만 로그인할 수 있고(회원가입 없음), 달력·앨범을 공유한다. Phase 1(로그인/대시보드/달력/앨범)까지 구현·배포 완료. 가계부/냉장고/여행일기/게시판은 사이드바에 "준비중"으로만 존재하는 다음 단계.

- **배포 주소**: https://jnymluvdev.vercel.app (Vercel, `main` 브랜치 push 시 자동 배포)
- **Supabase 프로젝트**: `jnymluvdev`, ref `tfcgmolcduavcevqdoof` (ap-northeast-2)
- **스펙/계획 문서**: `docs/superpowers/specs/2026-08-19-family-hub-phase1-design.md`, `docs/superpowers/plans/2026-08-19-family-hub-phase1.md` (21개 태스크 전체 구현 과정과 발견된 버그·보안 이슈 및 수정 내역이 상세히 남아있음 — 히스토리 필요할 때 참고)
- **디자인 레퍼런스**: `docs/design/mockups/` (실제 동작하는 HTML 프로토타입, 프로덕션 CSS는 여기서 그대로 이식됨)

## 스택

Next.js 16.3.1 (App Router) · React 19 · TypeScript · Supabase (Postgres + Auth + Storage) · Vitest · 순수 CSS (Tailwind는 미사용 — `globals.css`에 프로토타입 CSS를 그대로 이식, `tailwindcss`/`@tailwindcss/postcss` 의존성 제거됨)

**이 저장소의 Next.js는 특수 버전이다.** `AGENTS.md`(자동 생성/갱신됨, 건드리지 말 것) 참고 — 학습 데이터와 다른 breaking change가 있으니 `node_modules/next/dist/docs/`를 먼저 확인할 것. 실제로 겪은 예: `middleware.ts`가 아니라 **`src/proxy.ts`** + `export async function proxy(...)` (미들웨어는 deprecated).

## 아키텍처

- Server Component가 Supabase에서 직접 데이터를 읽고, 변경은 Server Actions(`'use server'`)로 처리. `cacheComponents`는 켜지 않음(전 페이지가 로그인 필요한 동적 데이터).
- 인증 라우트 보호: `src/proxy.ts`가 세션 쿠키를 확인해 리다이렉트. 실제 접근 제어는 Postgres RLS가 최종 방어선(클라이언트/서버 로직이 뚫려도 DB 레벨에서 막히도록 설계).
- `src/app/(family)/`가 보호된 라우트 그룹 — `layout.tsx`가 `requireProfile()`로 세션을 강제하고 사이드바/상단바/토스트를 렌더링한다. **`src/app/page.tsx`를 만들면 안 됨** — 대시보드는 반드시 `src/app/(family)/page.tsx`에 있어야 이 레이아웃이 적용된다 (한 번 실수했다가 발견해서 고친 이력 있음).
- Supabase 클라이언트 3종, 용도별로 분리: `src/lib/supabase/client.ts`(브라우저), `server.ts`(서버, 쿠키 기반 세션 — Server Component/Action에서 사용), `admin.ts`(service-role, `server-only`, 초대 발송 전용 — 절대 클라이언트에 노출 금지).

## 인증 흐름 (실제로 겪은 함정들)

- **가입 방법**: 공개 회원가입 없음. 운영자/관리자가 이메일을 입력하면 `t_invite`에 PENDING 행이 생기고 Supabase가 초대 메일을 발송한다.
- **초대/비밀번호 재설정 메일 링크는 PKCE(`?code=`)가 아니다.** Admin API(`inviteUserByEmail`, `resetPasswordForEmail`)로 서버가 대신 트리거하는 메일은 브라우저 세션이 없어서 PKCE를 쓸 수 없고, Supabase의 `/auth/v1/verify`가 세션 토큰을 **URL 해시**(`#access_token=...&refresh_token=...`)로 실어 돌려준다 — 해시는 서버로 절대 전송되지 않으므로 반드시 **클라이언트 컴포넌트**에서 처리해야 한다. → `src/app/auth/confirm/page.tsx` (client)가 이 역할, `window.location.hash`를 읽어 `supabase.auth.setSession()` 호출.
- **Google OAuth는 다르다** — 브라우저가 직접 시작하는 흐름이라 PKCE(`?code=`)를 쓸 수 있고, `src/app/auth/callback/route.ts` (server Route Handler)가 처리한다. 여기서 실제 초대받은 멤버(`t_user` 행 존재)인지 확인 후 아니면 세션을 지우고 돌려보낸다 — 안 그러면 구글 계정만 있으면 아무나 로그인 가능해짐.
- 정리: **로그인 페이지의 "Google로 로그인" → `/auth/callback`**, **초대/비번재설정 메일 링크 → `/auth/confirm`**. 둘을 헷갈리면 안 됨.
- `t_user` 행 INSERT는 RLS로 "본인 + 실제 PENDING 초대(같은 role) 존재"를 요구한다(`has_pending_invite()` security definer 함수, 이메일은 `lower()` 비교 — 대소문자 불일치로 가입이 막히는 문제를 방지). `t_invite`/`t_user`의 UPDATE는 컬럼 단위로 grant를 제한해서 `role` 컬럼을 클라이언트가 직접 못 바꾼다 — RLS의 `using`/`with check`만으로는 안 막히는 컬럼 단위 위조를 막기 위함(자기 자신을 ADMIN으로 승격시키는 실제 취약점이 있었고 고쳤음).

## 역할 모델

`t_user.role`: `USER` / `OPERATOR` / `ADMIN`. 관리자는 "사이트 전체 최상위(DB 콘솔 접근)"이고 앱 UI 권한은 운영자와 동일하게 취급. 운영자가 가족을 초대할 수 있음(단, 초대 시 ADMIN 역할은 부여 불가 — 앱단 allowlist + DB 정책 양쪽에서 제한). 로그인한 가족은 역할과 무관하게 모든 일정/사진을 열람 가능, 수정/삭제는 본인 소유 또는 운영자/관리자만(`canModify()`, `src/lib/auth/permissions.ts`).

## 데이터 모델

`supabase/migrations/`에 순서대로: 스키마(`T_USER`/`T_INVITE`/`T_EVENT`/`T_PHOTO`, 소문자 unquoted 식별자로 실제 생성됨) → t_user insert 정책 보완 → Storage `photos` 버킷(private) → 권한 상승 취약점 수정. 사진은 무조건 서명 URL로만 노출(private 버킷), Storage 업로드 경로는 `<user_id>/...` 프리픽스로 소유자 검증.

## 로컬 개발

```bash
npm install
npm run dev      # localhost:3000
npm run test     # vitest, 순수 로직만 커버 (권한판정/공휴일/달력그리드/초대상태)
npm run build    # 실제 타입체크는 반드시 이걸로 — bare `tsc --noEmit`은 .next/types가 없으면 오탐 발생
```

`.env.local` 필요 항목: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`(절대 `NEXT_PUBLIC_` 접두사 금지), `NEXT_PUBLIC_SITE_URL`.

DB 마이그레이션은 `npx supabase link --project-ref tfcgmolcduavcevqdoof` 후 `npx supabase db push`.

## 배포 시 잊지 말 것

- Vercel 프로덕션 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`(=`https://jnymluvdev.vercel.app`) 전부 있어야 함 — 초대 발송(service role)과 OAuth/초대 리다이렉트(site url)가 이걸 씀.
- Supabase 대시보드 → Authentication → URL Configuration: Site URL과 Redirect URLs가 실제 배포 주소로 되어있어야 함(기본값 localhost로 두면 초대 메일 링크가 로컬로 감).
- Supabase 기본 이메일 발송은 시간당 몇 통 수준으로 매우 제한적(테스트용). 실사용하려면 Authentication → Emails → SMTP Settings에서 커스텀 SMTP 필요 — 현재 Gmail SMTP(`smtp.gmail.com:587`)로 설정됨, 발신 계정은 2단계 인증 + 앱 비밀번호 필요(계정 비밀번호 그대로 쓰면 `535 BadCredentials`로 거부됨).

## Notion 패치노트 (배포할 때마다 필수)

`main`에 push해서 Vercel 배포가 나가면(=사용자가 "배포해줘"라고 하거나 직접 push할 때마다), **매번** 아래 Notion 페이지에 그 배포분의 패치노트를 자동으로 기록한다. 사용자에게 다시 물어보지 않고 진행.

- **페이지**: [우리집 (jnymluvdev) 패치노트](https://app.notion.com/p/3c13b8f518fc81cdae94fce6cf8e9cfe) (`notion-fetch`/`notion-update-page`로 접근, page_id `3c13b8f5-18fc-81cd-ae94-fce6cf8e9cfe`)
- **형식**: 날짜는 **제목1(Heading 1) 토글**, 그 아래 들여쓴 자식으로 패치 내용 bullet. Notion-flavored Markdown에서는 진짜 토글 헤딩이어야 함 — 텍스트로 "▶" 붙이는 게 아니라 `# 2026-08-20 {toggle="true"}` 문법을 쓰고 그 아래 줄들을 tab으로 들여쓸 것 (자세한 문법은 `notion://docs/enhanced-markdown-spec` 참고).
- 같은 날짜에 배포가 여러 번 나가면 새 토글을 또 만들지 말고 **기존 그 날짜 토글 안에 bullet을 추가**한다.
- 각 항목은 무엇을 왜 고쳤는지 한 줄 요약 + 관련 커밋 해시 표기.
- 새 페이지가 아니라 이 기존 페이지를 계속 갱신하는 것 — 매번 새로 만들지 말 것.

## 현재 상태 / 알려진 미해결 항목

- 첫 관리자(jn.ym.luv.dev@gmail.com)까지 초대 메일 발송 및 SMTP 정상 동작 확인됨. 운영자(evilet12@gmail.com)는 관리자 가입 확인 후 이어서 초대 예정.
- 초대가 대기중(PENDING) 상태에서 재초대/취소하는 앱 내 UI 없음 — 잘못 보낸 초대는 Supabase 콘솔에서 `t_invite` 행을 직접 지워야 함.
- `has_pending_invite()` RPC가 `anon`도 호출 가능(정보 노출만 있고 쓰기 경로는 없음, `revoke execute ... from public`로 정리 권장 — 아직 미적용).
- 실제 초대 메일 전체 흐름은 이번에 처음 실제 검증됨. 이전에 다른 유사 패턴(Server Action 결과를 비동기 클로저에서 바로 읽기)에서 실제 버그가 2번 나왔던 적 있음 — 비슷한 패턴 새로 짤 때 주의(`useActionState`의 dispatch 함수는 호출 직후 결과를 반환하지 않는다, `pending` 전이를 `useEffect`로 감지해야 함).
