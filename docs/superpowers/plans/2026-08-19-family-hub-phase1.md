# 우리집 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초대 기반 로그인, 대시보드, 달력, 앨범을 실제 Supabase 백엔드(Postgres + Auth + Storage)로 동작하는 Next.js 앱으로 구현한다.

**Architecture:** Next.js 16 App Router. Server Component가 Supabase에서 직접 데이터를 읽고, 변경은 Server Actions(`'use server'`)로 처리한다. 인증 라우트 보호는 `proxy.ts`(Next.js 16에서 `middleware.ts`를 대체)가 담당하고, 실제 접근 제어는 Postgres RLS가 최종 방어선이다. 사진은 클라이언트에서 Supabase Storage(private 버킷)로 직접 업로드한 뒤 메타데이터만 Server Action으로 저장한다. `cacheComponents`는 켜지 않는다 — 전 페이지가 로그인 필요한 개인 데이터라 정적 셸의 이점이 없다.

**Tech Stack:** Next.js 16.3.1 (App Router), React 19, TypeScript, `@supabase/ssr`, `@supabase/supabase-js`, Vitest(핵심 로직 단위 테스트)

**Spec:** `docs/superpowers/specs/2026-08-19-family-hub-phase1-design.md`

## Global Constraints

- 테이블/컬럼명은 Postgres 관례상 **소문자 unquoted 식별자**로 만든다 (`t_user`, `event_dt` 등). PRD의 "대문자 T_ 접두사" 의도는 유지하되, Postgres가 unquoted 대문자를 자동으로 소문자로 접기 때문에 처음부터 소문자로 정의한다. (스펙 §데이터 모델)
- 컬럼명은 7자 이내 약어를 우선한다: `event_dt`, `event_tm`, `categry`, `locatn`, `strpath`, `inv_by` 등. (스펙 §데이터 모델)
- `cacheComponents`는 켜지 않는다. (스펙 §렌더링/데이터 흐름)
- `middleware.ts`가 아니라 `src/proxy.ts` + `export async function proxy(...)`를 사용한다 — Next.js 16에서 middleware는 deprecated. (스펙 §인증)
- 사진은 Supabase Storage `photos` 버킷(**private**) + 서명 URL로만 노출한다. (스펙 §파일 저장)
- 자동화 테스트는 순수 로직(권한 판정 / 공휴일 계산 / 날짜 그리드 / 초대 상태 전이)만 Vitest로 커버한다. UI·DB 연동은 `npm run dev`로 수동 확인한다. (스펙 §테스트 범위)
- 단일 가족 전용이다 — `FAMILY_ID` 등 멀티테넌시 컬럼을 추가하지 않는다. (스펙 §범위 밖)
- Server Action은 항상 시작 시 `requireProfile()`로 세션을 재검증한다 (클라이언트 UI 제약만으로 권한을 걸지 않는다).

---

### Task 1: 프로젝트 설정 (의존성 · 테스트 러너 · 환경변수)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `npm run test` (vitest run), `@supabase/ssr` 사용 가능

- [ ] **Step 1: 의존성 설치**

```bash
npm install @supabase/ssr
npm install -D vitest
```

- [ ] **Step 2: `vitest.config.ts` 작성**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: `package.json`에 test 스크립트 추가**

`scripts`에 다음을 추가:

```json
"test": "vitest run"
```

- [ ] **Step 4: `.env.example`에 새 환경변수 추가**

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local`에도 같은 키를 추가해야 한다. `SUPABASE_SERVICE_ROLE_KEY`는 Supabase 대시보드 → Project Settings → API → `service_role` 키에서 가져온다 (절대 `NEXT_PUBLIC_` 접두사를 붙이지 않는다 — 브라우저에 노출되면 안 됨).

- [ ] **Step 5: 커밋**

```bash
git add package.json package-lock.json vitest.config.ts .env.example
git commit -m "chore: add @supabase/ssr, vitest, new env vars"
```

---

### Task 2: 디자인 토큰 이식 (프로토타입 CSS → globals.css)

**Files:**
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: 이후 모든 컴포넌트가 사용하는 CSS 클래스(`.login-screen`, `.shell`, `.side`, `.main`, `.bento`, `.card`, `.w-cal`, `.w-user`, `.w-album`, `.w-budget`, `.w-fridge`, `.cal-header`, `.month-grid`, `.week-view`, `.modal-overlay`, `.toast`, `.photo-grid`, `.lightbox-overlay` 등)와 CSS 변수(`--bg`, `--surface`, `--ink`, `--burgundy`, `--gold`, `--sage`, `--line` 등)

프로토타입(`docs/design/mockups/03-우리집_작동프로토타입_통합본.html`)의 `<style>` 블록을 거의 그대로 이식한다. Tailwind 유틸리티로 재작성하지 않고 순수 CSS로 유지한다 — 이미 완성도 높은 디자인 시스템이고, 재작성은 불필요한 리스크(YAGNI).

- [ ] **Step 1: `src/app/globals.css`를 프로토타입 CSS로 교체**

프로토타입 HTML의 `<style>...</style>` 내용 전체(라인 8~260, `:root` 변수부터 미디어쿼리까지)를 `src/app/globals.css` 최상단에 복사한다. 기존 `create-next-app` 기본 스타일은 제거한다. 파일 맨 위에 Pretendard 폰트 import를 CSS `@import`로 추가:

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css');

:root {
  --bg: #F7F1EA; --surface: #FFFEFC; --surface-2: #EFE2D6; --ink: #2A211D; --ink-soft: #8A7A6E;
  --line: #E4D5C4; --burgundy: #A11627; --burgundy-deep: #6E0E1C; --burgundy-bright: #D6293C;
  --burgundy-tint: #F7DEDD; --gold: #B9884A; --sage: #62744F; --radius-lg: 10px; --radius-md: 8px;
}
html.dark {
  --bg: #17100F; --surface: #221715; --surface-2: #2C1E1B; --ink: #F6ECE6; --ink-soft: #B8A196;
  --line: #3A2723; --burgundy: #E14C57; --burgundy-deep: #F17F86; --burgundy-bright: #FF6470;
  --burgundy-tint: #2C1719; --gold: #E0B67D; --sage: #9CB183;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased; transition: background-color .3s, color .3s;
}
button { font-family: inherit; }

/* 이하 프로토타입의 .login-screen, .shell, .side, .main, .bento, .card,
   .cal-header, .month-grid, .week-view, .modal-overlay, .toast,
   .photo-grid, .lightbox-overlay 등 클래스 정의를 그대로 붙여넣는다.
   출처: docs/design/mockups/03-우리집_작동프로토타입_통합본.html (라인 24~260) */
```

전체 CSS 블록을 프로토타입 파일에서 그대로 복사해 붙여넣는다 (이미 검증된 스타일이므로 재작성하지 않는다).

- [ ] **Step 2: 다크모드는 `html.dark` 클래스 토글 방식임을 확인**

Task 15(레이아웃)에서 `document.documentElement.classList.toggle('dark')`로 이 변수들을 전환한다. 별도 작업 불필요, 확인만.

- [ ] **Step 3: `npm run dev`로 홈(`/`)을 열어 배경색이 `--bg` 톤(아이보리)으로 보이는지 확인**

이 시점에는 아직 페이지 내용이 이전 커넥션 체크 화면이라도 배경/폰트만 확인하면 된다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/globals.css
git commit -m "style: port design tokens and component CSS from prototype"
```

---

### Task 3: Supabase 클라이언트 3종 (browser / server / admin)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/types.ts`
- Delete: `src/lib/supabase.ts`
- Delete: `src/components/connection-check.tsx`
- Delete: `src/app/page.tsx` (대시보드는 Task 21에서 `src/app/(family)/page.tsx`로 새로 생성됨 — Task 15의 보호 레이아웃이 `(family)` 라우트 그룹만 감싸므로, 최상위 `src/app/page.tsx`에 두면 사이드바/상단바 없이 렌더링된다)

**Interfaces:**
- Produces: `createClient()` (browser, `src/lib/supabase/client.ts`), `createClient()` (server, async, `src/lib/supabase/server.ts`), `createAdminClient()` (`src/lib/supabase/admin.ts`), `Role`/`Profile`/`CalendarEvent`/`Photo` 타입 (`src/lib/types.ts`)

- [ ] **Step 1: 공용 타입 정의**

```ts
// src/lib/types.ts
export type Role = 'USER' | 'OPERATOR' | 'ADMIN'

export type Profile = {
  userId: string
  email: string
  name: string
  role: Role
  avatar: string | null
}

export type CalendarEvent = {
  id: string
  date: string // YYYY-MM-DD
  time: string | null
  title: string
  category: string | null
  userId: string
}

export type Photo = {
  id: string
  date: string
  location: string | null
  caption: string | null
  path: string
  userId: string
  signedUrl: string
}
```

- [ ] **Step 2: 브라우저 클라이언트**

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: 서버 클라이언트 (쿠키 기반 세션)**

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서 호출되면 쿠키를 쓸 수 없다 — proxy.ts가 세션 갱신을 대신 처리하므로 무시
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: 관리자 클라이언트 (초대 발송 전용, service role)**

```ts
// src/lib/supabase/admin.ts
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

- [ ] **Step 5: 옛 부트스트랩 파일 제거**

```bash
rm src/lib/supabase.ts src/components/connection-check.tsx src/app/page.tsx
```

`src/app/page.tsx`는 완전히 삭제한다 (되살리지 않는다). 대시보드는 Task 21에서 `src/app/(family)/page.tsx`로 새로 만든다 — Task 15에서 만들 보호 레이아웃(`src/app/(family)/layout.tsx`)이 `(family)` 라우트 그룹 안의 페이지만 감싸기 때문에, 최상위 `src/app/page.tsx`에 두면 사이드바/상단바 없이 렌더링되어 버린다. 이 시점부터 Task 15가 끝나기 전까지 `/`는 404가 뜨는 게 정상이다 (다음 태스크들이 순서대로 채워나간다).

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: add supabase client/server/admin helpers, remove bootstrap connection check"
```

---

### Task 4: DB 스키마 마이그레이션 (T_USER / T_INVITE / T_EVENT / T_PHOTO + RLS)

**Files:**
- Create: `supabase/migrations/20260819120000_family_hub_phase1_schema.sql`

**Interfaces:**
- Produces: `t_user`, `t_invite`, `t_event`, `t_photo` 테이블, `public.is_operator_or_admin()` 함수

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- supabase/migrations/20260819120000_family_hub_phase1_schema.sql

create extension if not exists pgcrypto;

create table public.t_user (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'USER' check (role in ('USER','OPERATOR','ADMIN')),
  avatar text,
  created timestamptz not null default now()
);

create table public.t_invite (
  invite_id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('USER','OPERATOR','ADMIN')),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED')),
  inv_by uuid references public.t_user(user_id),
  created timestamptz not null default now()
);

create table public.t_event (
  event_id uuid primary key default gen_random_uuid(),
  event_dt date not null,
  event_tm time,
  title text not null,
  categry text,
  user_id uuid not null references public.t_user(user_id),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create table public.t_photo (
  photo_id uuid primary key default gen_random_uuid(),
  taken_dt date not null,
  locatn text,
  caption text,
  strpath text not null,
  user_id uuid not null references public.t_user(user_id),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

alter table public.t_user enable row level security;
alter table public.t_invite enable row level security;
alter table public.t_event enable row level security;
alter table public.t_photo enable row level security;

create or replace function public.is_operator_or_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.t_user
    where user_id = auth.uid() and role in ('OPERATOR','ADMIN')
  );
$$;

-- t_user
create policy "가족 전체 열람" on public.t_user for select using (auth.uid() is not null);
create policy "본인 초대 수락시 가입" on public.t_user for insert with check (user_id = auth.uid());
create policy "본인 정보만 수정" on public.t_user for update using (user_id = auth.uid());

-- t_invite
create policy "운영자 초대 조회" on public.t_invite for select
  using (public.is_operator_or_admin() or email = auth.jwt() ->> 'email');
create policy "운영자 초대 생성" on public.t_invite for insert
  with check (public.is_operator_or_admin());
create policy "가입 확정시 상태 갱신" on public.t_invite for update
  using (email = auth.jwt() ->> 'email');

-- t_event
create policy "가족 전체 열람" on public.t_event for select using (auth.uid() is not null);
create policy "본인 작성" on public.t_event for insert with check (user_id = auth.uid());
create policy "본인 또는 운영자 수정" on public.t_event for update
  using (user_id = auth.uid() or public.is_operator_or_admin());
create policy "본인 또는 운영자 삭제" on public.t_event for delete
  using (user_id = auth.uid() or public.is_operator_or_admin());

-- t_photo
create policy "가족 전체 열람" on public.t_photo for select using (auth.uid() is not null);
create policy "본인 업로드" on public.t_photo for insert with check (user_id = auth.uid());
create policy "본인 또는 운영자 수정" on public.t_photo for update
  using (user_id = auth.uid() or public.is_operator_or_admin());
create policy "본인 또는 운영자 삭제" on public.t_photo for delete
  using (user_id = auth.uid() or public.is_operator_or_admin());
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
npx supabase db push
```

Supabase CLI가 로그인/링크되어 있지 않다면 `npx supabase login` 후 `npx supabase link --project-ref <프로젝트 ref>`를 먼저 실행한다 (`supabase/.temp/linked-project.json`에 기존 링크 정보가 있으므로 대부분 바로 `db push`가 될 것이다). CLI를 쓸 수 없는 환경이면 Supabase 대시보드 → SQL Editor에 위 SQL을 그대로 붙여넣어 실행한다.

- [ ] **Step 3: 테이블 생성 확인**

Supabase 대시보드 → Table Editor에서 `t_user`, `t_invite`, `t_event`, `t_photo` 4개 테이블이 보이는지, 각 테이블의 RLS가 활성화(자물쇠 아이콘)되어 있는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260819120000_family_hub_phase1_schema.sql
git commit -m "feat(db): add t_user/t_invite/t_event/t_photo tables with RLS"
```

---

### Task 5: Storage 버킷 마이그레이션 (photos, private)

**Files:**
- Create: `supabase/migrations/20260819120100_family_hub_phase1_storage.sql`

**Interfaces:**
- Produces: `photos` 버킷 (private) + storage.objects 정책

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- supabase/migrations/20260819120100_family_hub_phase1_storage.sql

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "가족 로그인 사용자 업로드" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid() is not null);

create policy "가족 로그인 사용자 조회" on storage.objects for select
  using (bucket_id = 'photos' and auth.uid() is not null);

create policy "업로더 또는 운영자 삭제" on storage.objects for delete
  using (
    bucket_id = 'photos'
    and (owner = auth.uid() or public.is_operator_or_admin())
  );
```

- [ ] **Step 2: 마이그레이션 적용**

```bash
npx supabase db push
```

- [ ] **Step 3: 버킷 생성 확인**

Supabase 대시보드 → Storage에서 `photos` 버킷이 보이고 Public 토글이 꺼져 있는지(private) 확인.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260819120100_family_hub_phase1_storage.sql
git commit -m "feat(storage): add private photos bucket with RLS policies"
```

---

### Task 6: 권한 판정 로직 (`permissions.ts`) — TDD

**Files:**
- Create: `src/lib/auth/permissions.ts`
- Test: `src/lib/auth/permissions.test.ts`

**Interfaces:**
- Consumes: `Role` (`src/lib/types.ts`, Task 3)
- Produces: `isOperatorOrAdmin(role: Role): boolean`, `canModify(currentUserId: string, ownerUserId: string, role: Role): boolean`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/auth/permissions.test.ts
import { describe, expect, it } from 'vitest'
import { canModify, isOperatorOrAdmin } from './permissions'

describe('isOperatorOrAdmin', () => {
  it('USER는 false', () => {
    expect(isOperatorOrAdmin('USER')).toBe(false)
  })
  it('OPERATOR는 true', () => {
    expect(isOperatorOrAdmin('OPERATOR')).toBe(true)
  })
  it('ADMIN은 true', () => {
    expect(isOperatorOrAdmin('ADMIN')).toBe(true)
  })
})

describe('canModify', () => {
  it('본인 소유 데이터는 USER도 수정 가능', () => {
    expect(canModify('u1', 'u1', 'USER')).toBe(true)
  })
  it('타인 소유 데이터는 USER가 수정 불가', () => {
    expect(canModify('u1', 'u2', 'USER')).toBe(false)
  })
  it('타인 소유 데이터도 OPERATOR는 수정 가능', () => {
    expect(canModify('u1', 'u2', 'OPERATOR')).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/auth/permissions.test.ts`
Expected: FAIL (`permissions.ts` 파일 없음)

- [ ] **Step 3: 구현**

```ts
// src/lib/auth/permissions.ts
import type { Role } from '@/lib/types'

export function isOperatorOrAdmin(role: Role): boolean {
  return role === 'OPERATOR' || role === 'ADMIN'
}

export function canModify(
  currentUserId: string,
  ownerUserId: string,
  role: Role
): boolean {
  return currentUserId === ownerUserId || isOperatorOrAdmin(role)
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/permissions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/permissions.ts src/lib/auth/permissions.test.ts
git commit -m "feat: add permission check logic with tests"
```

---

### Task 7: 공휴일 계산 로직 (`holidays.ts`) — TDD

**Files:**
- Create: `src/lib/calendar/holidays.ts`
- Test: `src/lib/calendar/holidays.test.ts`

**Interfaces:**
- Produces: `type Holiday = { name: string; type: 'holiday' | 'substitute' }`, `getHoliday(dateKey: string): Holiday | null`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/calendar/holidays.test.ts
import { describe, expect, it } from 'vitest'
import { getHoliday } from './holidays'

describe('getHoliday', () => {
  it('매년 반복되는 고정 공휴일을 인식한다', () => {
    expect(getHoliday('2026-01-01')).toEqual({ name: '신정', type: 'holiday' })
    expect(getHoliday('2030-01-01')).toEqual({ name: '신정', type: 'holiday' })
  })
  it('대체공휴일을 인식한다', () => {
    expect(getHoliday('2026-08-17')).toEqual({ name: '대체공휴일', type: 'substitute' })
  })
  it('공휴일이 아닌 날은 null', () => {
    expect(getHoliday('2026-08-19')).toBeNull()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/calendar/holidays.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 (프로토타입의 FIXED_HOLIDAYS/SUBSTITUTE_HOLIDAYS 이식)**

```ts
// src/lib/calendar/holidays.ts
export type HolidayType = 'holiday' | 'substitute'
export type Holiday = { name: string; type: HolidayType }

const FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일',
  '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '크리스마스',
}

const SUBSTITUTE_HOLIDAYS: Record<string, string> = {
  '2026-08-17': '대체공휴일',
}

export function getHoliday(dateKey: string): Holiday | null {
  if (SUBSTITUTE_HOLIDAYS[dateKey]) {
    return { name: SUBSTITUTE_HOLIDAYS[dateKey], type: 'substitute' }
  }
  const mmdd = dateKey.slice(5)
  if (FIXED_HOLIDAYS[mmdd]) {
    return { name: FIXED_HOLIDAYS[mmdd], type: 'holiday' }
  }
  return null
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/calendar/holidays.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/calendar/holidays.ts src/lib/calendar/holidays.test.ts
git commit -m "feat: add Korean holiday lookup with tests"
```

---

### Task 8: 달력 그리드 로직 (`grid.ts`) — TDD

**Files:**
- Create: `src/lib/calendar/grid.ts`
- Test: `src/lib/calendar/grid.test.ts`

**Interfaces:**
- Produces: `type DayCell = { date: Date; dateKey: string; inCurrentMonth: boolean }`, `buildMonthGrid(year: number, month: number): DayCell[]`, `buildWeekGrid(referenceDate: Date): Date[]`, `formatDateKey(date: Date): string`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/calendar/grid.test.ts
import { describe, expect, it } from 'vitest'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from './grid'

describe('formatDateKey', () => {
  it('YYYY-MM-DD 형식으로 0-padding한다', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('buildMonthGrid', () => {
  it('7의 배수(주 단위) 셀 개수를 반환한다', () => {
    const cells = buildMonthGrid(2026, 7) // 2026년 8월
    expect(cells.length % 7).toBe(0)
  })
  it('해당 월의 모든 날짜가 inCurrentMonth=true로 포함된다', () => {
    const cells = buildMonthGrid(2026, 7) // 8월 = 31일
    const inMonth = cells.filter((c) => c.inCurrentMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0].dateKey).toBe('2026-08-01')
    expect(inMonth[30].dateKey).toBe('2026-08-31')
  })
})

describe('buildWeekGrid', () => {
  it('일요일부터 토요일까지 7일을 반환한다', () => {
    const week = buildWeekGrid(new Date(2026, 7, 19)) // 2026-08-19(수)
    expect(week).toHaveLength(7)
    expect(week[0].getDay()).toBe(0)
    expect(week[6].getDay()).toBe(6)
    expect(formatDateKey(week[0])).toBe('2026-08-16')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/calendar/grid.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 (프로토타입의 renderMonth/renderWeek 날짜 계산 로직을 순수 함수로 이식)**

```ts
// src/lib/calendar/grid.ts
export type DayCell = {
  date: Date
  dateKey: string
  inCurrentMonth: boolean
}

export function formatDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const cells: DayCell[] = []

  for (let i = firstDow - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i)
    cells.push({ date, dateKey: formatDateKey(date), inCurrentMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    cells.push({ date, dateKey: formatDateKey(date), inCurrentMonth: true })
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    cells.push({ date, dateKey: formatDateKey(date), inCurrentMonth: false })
  }

  return cells
}

export function buildWeekGrid(referenceDate: Date): Date[] {
  const start = new Date(referenceDate)
  start.setDate(referenceDate.getDate() - referenceDate.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/calendar/grid.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/calendar/grid.ts src/lib/calendar/grid.test.ts
git commit -m "feat: add pure month/week grid builders with tests"
```

---

### Task 9: 초대 상태 전이 로직 (`invites.ts`) — TDD

**Files:**
- Create: `src/lib/invites.ts`
- Test: `src/lib/invites.test.ts`

**Interfaces:**
- Produces: `type InviteStatus = 'PENDING' | 'ACCEPTED'`, `acceptInvite(status: InviteStatus): InviteStatus` (이미 처리된 초대면 throw)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/invites.test.ts
import { describe, expect, it } from 'vitest'
import { acceptInvite } from './invites'

describe('acceptInvite', () => {
  it('PENDING이면 ACCEPTED로 전이한다', () => {
    expect(acceptInvite('PENDING')).toBe('ACCEPTED')
  })
  it('이미 ACCEPTED면 에러를 던진다', () => {
    expect(() => acceptInvite('ACCEPTED')).toThrow('이미 처리된 초대입니다')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/invites.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/invites.ts
export type InviteStatus = 'PENDING' | 'ACCEPTED'

export function acceptInvite(status: InviteStatus): InviteStatus {
  if (status !== 'PENDING') {
    throw new Error('이미 처리된 초대입니다')
  }
  return 'ACCEPTED'
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/invites.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/invites.ts src/lib/invites.test.ts
git commit -m "feat: add invite status transition logic with tests"
```

---

### Task 10: 세션/프로필 헬퍼 (`session.ts`)

**Files:**
- Create: `src/lib/auth/session.ts`

**Interfaces:**
- Consumes: `createClient()` (server, Task 3), `Profile` (Task 3)
- Produces: `getProfile(): Promise<Profile | null>`, `requireProfile(): Promise<Profile>` (미인증 시 `/login`으로 redirect)

- [ ] **Step 1: 구현**

```ts
// src/lib/auth/session.ts
import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('t_user')
    .select('user_id, email, name, role, avatar')
    .eq('user_id', user.id)
    .single()

  if (!data) return null

  return {
    userId: data.user_id,
    email: data.email,
    name: data.name,
    role: data.role,
    avatar: data.avatar,
  }
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  return profile
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/auth/session.ts
git commit -m "feat: add getProfile/requireProfile session helpers"
```

---

### Task 11: `proxy.ts` 라우트 보호

**Files:**
- Create: `src/proxy.ts`

**Interfaces:**
- 없음 (독립 실행되는 Next.js 파일 컨벤션)

- [ ] **Step 1: 구현**

```ts
// src/proxy.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth')

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: 수동 확인**

`npm run dev` 실행 후 브라우저에서 `http://localhost:3000/`에 접속 → 아직 `/login` 페이지가 없으므로 404가 뜨더라도, 리다이렉트가 `/login`으로 일어났는지 네트워크 탭에서 확인 (Task 12에서 로그인 페이지가 생기면 완전히 검증됨).

- [ ] **Step 3: 커밋**

```bash
git add src/proxy.ts
git commit -m "feat: add proxy.ts session refresh and route protection"
```

---

### Task 12: 로그인 페이지 + Server Actions (이메일/비밀번호 + Google)

**Files:**
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server, Task 3)
- Produces: `loginWithPassword(prevState, formData)`, `loginWithGoogle()`

- [ ] **Step 1: Server Actions 작성**

```ts
// src/app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error: string | null }

export async function loginWithPassword(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: '이메일 또는 비밀번호가 올바르지 않아요' }
  }

  redirect('/')
}

export async function loginWithGoogle() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
  })

  if (error || !data.url) {
    redirect('/login?error=google')
  }

  redirect(data.url)
}
```

- [ ] **Step 2: 로그인 페이지 작성**

```tsx
// src/app/login/page.tsx
'use client'

import { useActionState } from 'react'
import { loginWithGoogle, loginWithPassword, type LoginState } from './actions'

const initialState: LoginState = { error: null }

export default function LoginPage() {
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
```

- [ ] **Step 3: 수동 확인**

Google OAuth는 Supabase 대시보드 → Authentication → Providers → Google에서 클라이언트 ID/시크릿을 먼저 설정해야 동작한다 (이 단계에서는 이메일/비밀번호 로그인 폼만 렌더링되는지, 빈 값 제출 시 에러 메시지가 뜨는지만 확인). 아직 `t_user`에 계정이 없으므로 실제 로그인 성공은 Task 13 완료 후 확인한다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/login
git commit -m "feat: add login page with email/password and Google OAuth"
```

---

### Task 13: 초대 수락 흐름 (`/auth/confirm`, `/auth/set-password`)

**Files:**
- Create: `src/app/auth/confirm/route.ts`
- Create: `src/app/auth/set-password/actions.ts`
- Create: `src/app/auth/set-password/page.tsx`

**Interfaces:**
- Consumes: `createClient()` (server, Task 3), `acceptInvite()` (Task 9)
- Produces: 초대받은 사용자가 비밀번호를 설정하면 `t_user` 행이 생성되고 `t_invite.status`가 `ACCEPTED`로 바뀜

- [ ] **Step 1: 콜백 라우트 핸들러**

```ts
// src/app/auth/confirm/route.ts
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
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/set-password`)
      }
      return NextResponse.redirect(origin)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirm`)
}
```

- [ ] **Step 2: 비밀번호 설정 Server Action**

```ts
// src/app/auth/set-password/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/invites'

export type SetPasswordState = { error: string | null }

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const password = String(formData.get('password') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  if (password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 해요' }
  }
  if (!name) {
    return { error: '이름을 입력해주세요' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return { error: '초대 세션이 만료됐어요. 초대 메일을 다시 요청해주세요' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password })
  if (updateError) {
    return { error: '비밀번호 설정에 실패했어요' }
  }

  const { data: invite } = await supabase
    .from('t_invite')
    .select('invite_id, role, status')
    .eq('email', user.email)
    .eq('status', 'PENDING')
    .maybeSingle()

  if (!invite) {
    return { error: '유효한 초대 정보를 찾을 수 없어요' }
  }

  acceptInvite(invite.status as 'PENDING' | 'ACCEPTED')

  const { error: userInsertError } = await supabase.from('t_user').insert({
    user_id: user.id,
    email: user.email,
    name,
    role: invite.role,
  })

  if (userInsertError) {
    return { error: '가입 처리에 실패했어요' }
  }

  await supabase.from('t_invite').update({ status: 'ACCEPTED' }).eq('invite_id', invite.invite_id)

  redirect('/')
}
```

- [ ] **Step 3: 비밀번호 설정 페이지**

```tsx
// src/app/auth/set-password/page.tsx
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
```

- [ ] **Step 4: 수동 확인**

Task 14(초대 생성) 완료 후 실제 초대 메일을 받아 링크를 눌러 이 흐름을 끝까지 확인한다. 지금은 페이지가 정상적으로 렌더링되는지만 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/app/auth
git commit -m "feat: add invite acceptance flow (confirm callback + set-password)"
```

---

### Task 14: 구성원 초대 (Server Action + 사이드바 UI)

**Files:**
- Create: `src/app/(family)/invite/actions.ts`

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `isOperatorOrAdmin()` (Task 6), `createAdminClient()` / `createClient()` (Task 3)
- Produces: `createInvite(prevState, formData): Promise<InviteState>` — Task 15(사이드바)에서 이 액션을 폼에 연결한다

- [ ] **Step 1: 구현**

```ts
// src/app/(family)/invite/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { isOperatorOrAdmin } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type InviteState = { error: string | null; success: string | null }

export async function createInvite(
  _prevState: InviteState,
  formData: FormData
): Promise<InviteState> {
  const profile = await requireProfile()

  if (!isOperatorOrAdmin(profile.role)) {
    return { error: '초대 권한이 없어요', success: null }
  }

  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? 'USER') as 'USER' | 'OPERATOR' | 'ADMIN'

  if (!email) {
    return { error: '이메일을 입력해주세요', success: null }
  }

  const supabase = await createClient()
  const { error: insertError } = await supabase
    .from('t_invite')
    .insert({ email, role, inv_by: profile.userId })

  if (insertError) {
    return { error: '초대 기록 저장에 실패했어요', success: null }
  }

  const admin = createAdminClient()
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  })

  if (inviteError) {
    return { error: '초대 메일 발송에 실패했어요', success: null }
  }

  revalidatePath('/')
  return { error: null, success: `${email} 님에게 초대 메일을 보냈어요` }
}
```

- [ ] **Step 2: 커밋**

```bash
git add "src/app/(family)/invite"
git commit -m "feat: add operator/admin invite server action"
```

(사이드바에서 이 액션을 호출하는 폼은 Task 15에서 함께 만든다.)

---

### Task 15: 보호된 레이아웃 셸 (사이드바 + 상단바 + 다크모드 + 토스트)

**Files:**
- Create: `src/components/nav-sidebar.tsx`
- Create: `src/components/topbar.tsx`
- Create: `src/components/toast-provider.tsx`
- Create: `src/app/(family)/actions.ts`
- Create: `src/app/(family)/layout.tsx`

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `Profile` (Task 3), `createInvite()` (Task 14)
- Produces: `ToastProvider`/`useToast()` (다른 모든 클라이언트 컴포넌트에서 사용), `logout()`

- [ ] **Step 1: 토스트 컨텍스트**

```tsx
// src/components/toast-provider.tsx
'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastContextValue = { showToast: (message: string) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast는 ToastProvider 내부에서만 사용할 수 있어요')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(null), 2200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast${message ? ' show' : ''}`}>{message}</div>
    </ToastContext.Provider>
  )
}
```

- [ ] **Step 2: 로그아웃 Server Action**

```ts
// src/app/(family)/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 3: 사이드바 (nav + 초대 폼)**

```tsx
// src/components/nav-sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { createInvite, type InviteState } from '@/app/(family)/invite/actions'
import { isOperatorOrAdmin } from '@/lib/auth/permissions'
import { useToast } from './toast-provider'
import type { Profile } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '▦' },
  { href: '/calendar', label: '달력', icon: '📅' },
  { href: '/album', label: '앨범', icon: '🖼' },
  { href: '/budget', label: '가계부', icon: '💳', soon: true },
  { href: '/fridge', label: '냉장고', icon: '❄︎', soon: true },
  { href: '/trip', label: '여행일기', icon: '✈', soon: true },
  { href: '/board', label: '게시판', icon: '🗒', soon: true },
]

const initialInviteState: InviteState = { error: null, success: null }

export function NavSidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const { showToast } = useToast()
  const [state, formAction, pending] = useActionState(createInvite, initialInviteState)

  useEffect(() => {
    if (state.success) showToast(state.success)
    if (state.error) showToast(state.error)
  }, [state, showToast])

  return (
    <aside className="side">
      <div className="brand">
        <div className="brand-mark">우</div>
        <div>
          <div className="brand-name">우리집</div>
          <div className="brand-sub">가족 일상 기록</div>
        </div>
      </div>

      <nav>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${pathname === item.href ? ' active' : ''}`}
          >
            <span className="ic">{item.icon}</span> {item.label}
            {item.soon && <span className="nav-soon">준비중</span>}
          </Link>
        ))}
      </nav>

      {isOperatorOrAdmin(profile.role) && (
        <div className="side-foot">
          <form action={formAction} className="invite-card">
            <b>가족 초대하기</b>
            이메일로 초대 메일을 보내요.
            <input type="email" name="email" placeholder="이메일" required style={{ marginTop: 8, width: '100%' }} />
            <select name="role" defaultValue="USER" style={{ marginTop: 6, width: '100%' }}>
              <option value="USER">사용자</option>
              <option value="OPERATOR">운영자</option>
            </select>
            <button type="submit" className="invite-btn" disabled={pending}>
              {pending ? '보내는 중...' : '초대 링크 만들기'}
            </button>
          </form>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 4: 상단바 (다크모드 + 아바타 메뉴)**

```tsx
// src/components/topbar.tsx
'use client'

import { useEffect, useState } from 'react'
import { logout } from '@/app/(family)/actions'
import type { Profile } from '@/lib/types'

export function Topbar({ profile }: { profile: Profile }) {
  const [dark, setDark] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])

  function toggleDark() {
    document.documentElement.classList.toggle('dark')
    setDark(document.documentElement.classList.contains('dark'))
  }

  return (
    <div className="top-strip">
      <div className="topbar-left" />
      <div className="topbar-right">
        <button className="icon-btn" onClick={toggleDark} title="다크 모드">
          {dark ? '☀' : '☾'}
        </button>
        <button className="avatar" onClick={() => setMenuOpen((v) => !v)}>
          {profile.name.slice(-2)}
        </button>
      </div>
      {menuOpen && (
        <div className="user-menu open">
          <div className="who">{profile.name} · {profile.role}</div>
          <form action={logout}>
            <button type="submit">로그아웃</button>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 레이아웃**

```tsx
// src/app/(family)/layout.tsx
import type { ReactNode } from 'react'
import { requireProfile } from '@/lib/auth/session'
import { NavSidebar } from '@/components/nav-sidebar'
import { Topbar } from '@/components/topbar'
import { ToastProvider } from '@/components/toast-provider'

export default async function FamilyLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile()

  return (
    <ToastProvider>
      <div className="shell">
        <NavSidebar profile={profile} />
        <main className="main">
          <Topbar profile={profile} />
          {children}
        </main>
      </div>
    </ToastProvider>
  )
}
```

- [ ] **Step 6: 수동 확인**

`npm run dev` → Supabase 대시보드에서 첫 관리자 계정을 수동 생성(Authentication → Users → Add user로 계정 생성 후 SQL Editor에서 `insert into t_user (user_id, email, name, role) values ('<uid>', '<email>', '<이름>', 'ADMIN')` 실행) → 로그인 → 사이드바/상단바가 뜨는지, 다크모드 토글이 동작하는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/components/nav-sidebar.tsx src/components/topbar.tsx src/components/toast-provider.tsx "src/app/(family)/actions.ts" "src/app/(family)/layout.tsx"
git commit -m "feat: add protected layout shell with nav, topbar, dark mode, invite form"
```

---

### Task 16: 준비중 placeholder 페이지 4종

**Files:**
- Create: `src/components/placeholder-page.tsx`
- Create: `src/app/(family)/budget/page.tsx`
- Create: `src/app/(family)/fridge/page.tsx`
- Create: `src/app/(family)/trip/page.tsx`
- Create: `src/app/(family)/board/page.tsx`

**Interfaces:**
- Produces: `PlaceholderPage({ icon, title, description })`

- [ ] **Step 1: 공용 컴포넌트**

```tsx
// src/components/placeholder-page.tsx
export function PlaceholderPage({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="placeholder-page">
      <div className="ic">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}
```

- [ ] **Step 2: 4개 페이지**

```tsx
// src/app/(family)/budget/page.tsx
import { PlaceholderPage } from '@/components/placeholder-page'

export default function BudgetPage() {
  return <PlaceholderPage icon="💳" title="가계부" description="화면 설계 전이에요. 조금만 기다려주세요." />
}
```

```tsx
// src/app/(family)/fridge/page.tsx
import { PlaceholderPage } from '@/components/placeholder-page'

export default function FridgePage() {
  return (
    <PlaceholderPage
      icon="❄︎"
      title="냉장고"
      description="가계부의 식재료 항목을 바탕으로 나중에 자동 구성될 예정이에요."
    />
  )
}
```

```tsx
// src/app/(family)/trip/page.tsx
import { PlaceholderPage } from '@/components/placeholder-page'

export default function TripPage() {
  return (
    <PlaceholderPage
      icon="✈"
      title="여행일기"
      description="앨범에서 집 밖 사진을 모아 자동으로 만들어질 예정이에요."
    />
  )
}
```

```tsx
// src/app/(family)/board/page.tsx
import { PlaceholderPage } from '@/components/placeholder-page'

export default function BoardPage() {
  return <PlaceholderPage icon="🗒" title="게시판" description="화면 설계 전이에요. 조금만 기다려주세요." />
}
```

- [ ] **Step 3: 수동 확인**

로그인 후 사이드바에서 4개 메뉴를 클릭해 각각 placeholder 문구가 뜨는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/components/placeholder-page.tsx "src/app/(family)/budget" "src/app/(family)/fridge" "src/app/(family)/trip" "src/app/(family)/board"
git commit -m "feat: add placeholder pages for budget/fridge/trip/board"
```

---

### Task 17: 달력 — 조회 (월/주 뷰 + 공휴일)

**Files:**
- Create: `src/app/(family)/calendar/page.tsx`
- Create: `src/app/(family)/calendar/calendar-client.tsx`

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `createClient()` (server, Task 3), `buildMonthGrid`/`buildWeekGrid`/`formatDateKey` (Task 8), `getHoliday` (Task 7), `CalendarEvent` (Task 3)
- Produces: `<CalendarClient events={CalendarEvent[]} profile={Profile} />` — Task 18에서 이 파일에 모달/CRUD를 추가한다

- [ ] **Step 1: 데이터 조회 페이지**

```tsx
// src/app/(family)/calendar/page.tsx
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { CalendarClient } from './calendar-client'
import type { CalendarEvent } from '@/lib/types'

export default async function CalendarPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('t_event')
    .select('event_id, event_dt, event_tm, title, categry, user_id')
    .order('event_dt', { ascending: true })

  const events: CalendarEvent[] = (data ?? []).map((row) => ({
    id: row.event_id,
    date: row.event_dt,
    time: row.event_tm,
    title: row.title,
    category: row.categry,
    userId: row.user_id,
  }))

  return <CalendarClient events={events} profile={profile} />
}
```

- [ ] **Step 2: 월/주 뷰 클라이언트 컴포넌트**

```tsx
// src/app/(family)/calendar/calendar-client.tsx
'use client'

import { useState } from 'react'
import { buildMonthGrid, buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHoliday } from '@/lib/calendar/holidays'
import type { CalendarEvent, Profile } from '@/lib/types'

const DOWS = ['일', '월', '화', '수', '목', '금', '토']

export function CalendarClient({
  events,
  profile,
}: {
  events: CalendarEvent[]
  profile: Profile
}) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [cursor, setCursor] = useState(new Date())

  const eventsFor = (dateKey: string) => events.filter((e) => e.date === dateKey)

  function shift(dir: number) {
    if (viewMode === 'month') {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1))
    } else {
      const d = new Date(cursor)
      d.setDate(d.getDate() + dir * 7)
      setCursor(d)
    }
  }

  return (
    <section>
      <div className="cal-header">
        <div className="cal-title-group">
          <div className="cal-title">
            {viewMode === 'month'
              ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`
              : `${formatDateKey(buildWeekGrid(cursor)[0])} ~ ${formatDateKey(buildWeekGrid(cursor)[6])}`}
          </div>
          <div className="cal-nav">
            <button onClick={() => shift(-1)}>‹</button>
            <button onClick={() => shift(1)}>›</button>
          </div>
          <button className="today-btn" onClick={() => setCursor(new Date())}>오늘</button>
        </div>
        <div className="cal-actions">
          <div className="view-toggle">
            <button className={viewMode === 'month' ? 'active' : ''} onClick={() => setViewMode('month')}>월</button>
            <button className={viewMode === 'week' ? 'active' : ''} onClick={() => setViewMode('week')}>주</button>
          </div>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="month-grid">
          <div className="weekday-row">
            {DOWS.map((d, i) => (
              <div key={d} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{d}</div>
            ))}
          </div>
          <div className="day-rows">
            {buildMonthGrid(cursor.getFullYear(), cursor.getMonth()).map((cell) => {
              const holiday = getHoliday(cell.dateKey)
              const dayEvents = eventsFor(cell.dateKey)
              const isToday = cell.dateKey === formatDateKey(new Date())
              const dow = cell.date.getDay()
              return (
                <div
                  key={cell.dateKey}
                  className={[
                    'day-cell',
                    !cell.inCurrentMonth && 'muted',
                    isToday && 'today',
                    (dow === 0 || dow === 6) && 'wknd',
                    holiday?.type,
                  ].filter(Boolean).join(' ')}
                >
                  <div className="day-num">{cell.date.getDate()}</div>
                  {holiday && <div className={`evt ${holiday.type}`}>{holiday.name}</div>}
                  {dayEvents.slice(0, holiday ? 1 : 2).map((ev) => (
                    <div className="evt" key={ev.id}>{ev.title}</div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="week-view active">
          {buildWeekGrid(cursor).map((date, i) => {
            const dateKey = formatDateKey(date)
            const holiday = getHoliday(dateKey)
            const dayEvents = eventsFor(dateKey)
            const isToday = dateKey === formatDateKey(new Date())
            return (
              <div key={dateKey} className={`week-col${isToday ? ' today' : ''}`}>
                <div className="week-col-head">
                  <div className="dow">{DOWS[i]}</div>
                  <div className="num">{date.getDate()}</div>
                </div>
                <div className="week-events">
                  {holiday && <div className="week-evt holiday">{holiday.name}</div>}
                  {dayEvents.map((ev) => (
                    <div className="week-evt" key={ev.id}>{ev.title}{ev.time ? ` ${ev.time}` : ''}</div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: 수동 확인**

Supabase SQL Editor에서 `insert into t_event (event_dt, title, user_id) values ('2026-08-19', '가족 저녁', '<본인 user_id>')` 같은 테스트 데이터를 넣고, `/calendar`에서 월/주 뷰 전환, 8월 15일(광복절) 표시, 방금 넣은 일정이 보이는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/(family)/calendar/page.tsx" "src/app/(family)/calendar/calendar-client.tsx"
git commit -m "feat: add calendar month/week view with holidays (read-only)"
```

---

### Task 18: 달력 — 일정 CRUD (모달 + Server Actions)

**Files:**
- Create: `src/app/(family)/calendar/actions.ts`
- Modify: `src/app/(family)/calendar/calendar-client.tsx`

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `canModify()` (Task 6), `createClient()` (server, Task 3), `useToast()` (Task 15)
- Produces: `createEvent`, `updateEvent`, `deleteEvent` (모두 `(prevState: EventFormState, formData: FormData) => Promise<EventFormState>`)

- [ ] **Step 1: Server Actions**

```ts
// src/app/(family)/calendar/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type EventFormState = { error: string | null }

export async function createEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await requireProfile()
  const date = String(formData.get('date') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const time = String(formData.get('time') ?? '') || null

  if (!date || !title) {
    return { error: '날짜와 제목을 입력해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_event').insert({
    event_dt: date,
    event_tm: time,
    title,
    user_id: profile.userId,
  })

  if (error) return { error: '일정 저장에 실패했어요' }

  revalidatePath('/calendar')
  revalidatePath('/')
  return { error: null }
}

export async function updateEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await requireProfile()
  const eventId = String(formData.get('eventId') ?? '')
  const date = String(formData.get('date') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const time = String(formData.get('time') ?? '') || null

  if (!eventId || !date || !title) {
    return { error: '날짜와 제목을 입력해주세요' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_event')
    .select('user_id')
    .eq('event_id', eventId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { error } = await supabase
    .from('t_event')
    .update({ event_dt: date, event_tm: time, title, updated: new Date().toISOString() })
    .eq('event_id', eventId)

  if (error) return { error: '일정 수정에 실패했어요' }

  revalidatePath('/calendar')
  revalidatePath('/')
  return { error: null }
}

export async function deleteEvent(
  _prevState: EventFormState,
  formData: FormData
): Promise<EventFormState> {
  const profile = await requireProfile()
  const eventId = String(formData.get('eventId') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_event')
    .select('user_id')
    .eq('event_id', eventId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  const { error } = await supabase.from('t_event').delete().eq('event_id', eventId)
  if (error) return { error: '일정 삭제에 실패했어요' }

  revalidatePath('/calendar')
  revalidatePath('/')
  return { error: null }
}
```

- [ ] **Step 2: `calendar-client.tsx`에 모달 + 날짜 클릭 핸들러 추가**

`calendar-client.tsx` 최상단 import에 추가:

```tsx
import { useActionState } from 'react'
import { createEvent, deleteEvent, updateEvent, type EventFormState } from './actions'
import { useToast } from '@/components/toast-provider'
```

컴포넌트 내부, `viewMode`/`cursor` state 아래에 추가:

```tsx
const [modalDate, setModalDate] = useState<string | null>(null)
const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
const { showToast } = useToast()
const initialEventState: EventFormState = { error: null }
const [createState, createFormAction] = useActionState(createEvent, initialEventState)
const [updateState, updateFormAction] = useActionState(updateEvent, initialEventState)
const [deleteState, deleteFormAction] = useActionState(deleteEvent, initialEventState)

function openModal(dateKey: string, event?: CalendarEvent) {
  setModalDate(dateKey)
  setEditingEvent(event ?? null)
}
function closeModal() {
  setModalDate(null)
  setEditingEvent(null)
}
```

월간 뷰의 `day-cell` 렌더에 `onClick={() => openModal(cell.dateKey)}` 추가, 각 `.evt` 항목에는 `onClick={(e) => { e.stopPropagation(); openModal(cell.dateKey, ev) }}` 추가. 주간 뷰의 `.week-col`에도 동일하게 `onClick={() => openModal(dateKey)}` 추가.

`cal-header`의 `cal-actions`에 "+ 일정 추가" 버튼 추가:

```tsx
<button className="add-event" onClick={() => openModal(formatDateKey(cursor))}>+ 일정 추가</button>
```

컴포넌트 return 최하단(`</section>` 직전)에 모달 추가:

```tsx
{modalDate && (
  <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
    <div className="modal">
      <h3>{editingEvent ? '일정 수정' : '일정 추가'}</h3>
      <form
        action={async (formData) => {
          const result = editingEvent
            ? await updateFormAction(formData)
            : await createFormAction(formData)
          if (!(editingEvent ? updateState.error : createState.error)) {
            showToast(editingEvent ? '일정이 수정됐어요' : '일정이 저장됐어요')
            closeModal()
          }
        }}
      >
        {editingEvent && <input type="hidden" name="eventId" value={editingEvent.id} />}
        <label>날짜</label>
        <input type="date" name="date" defaultValue={editingEvent?.date ?? modalDate} required />
        <label>제목</label>
        <input type="text" name="title" defaultValue={editingEvent?.title ?? ''} placeholder="예: 가족 저녁" required />
        <label>시간 (선택)</label>
        <input type="time" name="time" defaultValue={editingEvent?.time ?? ''} />
        {(createState.error || updateState.error) && (
          <p style={{ color: 'var(--burgundy)', fontSize: 12 }}>{createState.error ?? updateState.error}</p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn-cancel" onClick={closeModal}>취소</button>
          <button type="submit" className="btn-save">저장</button>
        </div>
      </form>
      {editingEvent && (
        <form
          action={async (formData) => {
            await deleteFormAction(formData)
            if (!deleteState.error) {
              showToast('일정을 삭제했어요')
              closeModal()
            }
          }}
        >
          <input type="hidden" name="eventId" value={editingEvent.id} />
          <button type="submit" className="btn-delete">이 일정 삭제하기</button>
        </form>
      )}
    </div>
  </div>
)}
```

> **참고:** `useActionState`가 반환하는 `state`는 액션 완료 후 리렌더에서 갱신되므로, 위 코드처럼 액션 직후 `state.error`를 바로 참조하면 한 렌더 지연이 있을 수 있다. 더 정확한 성공 판정이 필요하면 각 액션이 `{ error, success: true }` 형태로 성공 플래그까지 반환하도록 Task 완료 후 다듬어도 된다 (Phase 1에서는 토스트 타이밍이 한 프레임 늦어도 기능적으로 문제없다).

- [ ] **Step 3: 수동 확인**

`/calendar`에서 날짜 클릭 → 모달 열림 → 일정 추가 → 그리드에 반영 → 기존 일정 클릭 → 수정/삭제 → 각각 반영되는지 확인. 다른 계정(USER 역할)으로 로그인해 남의 일정 수정 시 "수정 권한이 없어요" 에러가 뜨는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/(family)/calendar"
git commit -m "feat: add calendar event CRUD with modal"
```

---

### Task 19: 앨범 — 조회 (날짜별 그룹 + 서명 URL)

**Files:**
- Create: `src/lib/photos.ts`
- Create: `src/app/(family)/album/page.tsx`
- Create: `src/app/(family)/album/album-client.tsx`

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `createClient()` (server, Task 3), `Photo` (Task 3)
- Produces: `toSignedPhotos(supabase, rows): Promise<Photo[]>` (Task 21 대시보드에서도 재사용), `<AlbumClient photos={Photo[]} profile={Profile} />` (Task 20에서 업로드/편집 기능 추가)

- [ ] **Step 1: 서명 URL 변환 헬퍼 (공용)**

```ts
// src/lib/photos.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Photo } from './types'

type PhotoRow = {
  photo_id: string
  taken_dt: string
  locatn: string | null
  caption: string | null
  strpath: string
  user_id: string
}

export async function toSignedPhotos(
  supabase: SupabaseClient,
  rows: PhotoRow[]
): Promise<Photo[]> {
  return Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from('photos')
        .createSignedUrl(row.strpath, 3600)

      return {
        id: row.photo_id,
        date: row.taken_dt,
        location: row.locatn,
        caption: row.caption,
        path: row.strpath,
        userId: row.user_id,
        signedUrl: signed?.signedUrl ?? '',
      }
    })
  )
}
```

- [ ] **Step 2: 데이터 조회 페이지**

```tsx
// src/app/(family)/album/page.tsx
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { toSignedPhotos } from '@/lib/photos'
import { AlbumClient } from './album-client'

export default async function AlbumPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data } = await supabase
    .from('t_photo')
    .select('photo_id, taken_dt, locatn, caption, strpath, user_id')
    .order('taken_dt', { ascending: false })

  const photos = await toSignedPhotos(supabase, data ?? [])

  return <AlbumClient photos={photos} profile={profile} />
}
```

- [ ] **Step 3: 날짜별 그룹 렌더링 (읽기 전용)**

```tsx
// src/app/(family)/album/album-client.tsx
'use client'

import type { Photo, Profile } from '@/lib/types'

function formatDateKR(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dows = ['일', '월', '화', '수', '목', '금', '토']
  const date = new Date(y, m - 1, d)
  return `${y}년 ${m}월 ${d}일 (${dows[date.getDay()]})`
}

function groupByDate(photos: Photo[]): [string, Photo[]][] {
  const byDate = new Map<string, Photo[]>()
  for (const photo of photos) {
    const list = byDate.get(photo.date) ?? []
    list.push(photo)
    byDate.set(photo.date, list)
  }
  return Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

export function AlbumClient({ photos }: { photos: Photo[]; profile: Profile }) {
  const sections = groupByDate(photos)

  if (sections.length === 0) {
    return (
      <div className="placeholder-page">
        <div className="ic">🖼</div>
        <h2>아직 추가된 사진이 없어요</h2>
        <p>가족과의 순간을 올려보세요.</p>
      </div>
    )
  }

  return (
    <div>
      {sections.map(([date, group]) => (
        <div className="album-section" key={date}>
          <div className="album-section-title">{formatDateKR(date)}</div>
          <div className="photo-grid">
            {group.map((photo) => (
              <div className="photo-thumb" key={photo.id}>
                <img src={photo.signedUrl} alt={photo.caption ?? ''} />
                {photo.caption && <div className="cap">{photo.caption}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 수동 확인**

Supabase 대시보드 → Storage → `photos` 버킷에 아무 이미지나 `<본인 user_id>/test.jpg` 경로로 직접 업로드 → SQL Editor에서 `insert into t_photo (taken_dt, strpath, user_id) values ('2026-08-19', '<본인 user_id>/test.jpg', '<본인 user_id>')` 실행 → `/album`에서 날짜 섹션과 이미지가 서명 URL로 정상 로드되는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/photos.ts "src/app/(family)/album"
git commit -m "feat: add album read view grouped by date with signed URLs"
```

---

### Task 20: 앨범 — 업로드 + 편집/삭제 (라이트박스)

**Files:**
- Create: `src/app/(family)/album/actions.ts`
- Modify: `src/app/(family)/album/album-client.tsx`

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `canModify()` (Task 6), `createClient()` (server + browser, Task 3), `useToast()` (Task 15)
- Produces: `savePhotoMeta`, `updatePhoto`, `deletePhoto` (모두 `(prevState: PhotoFormState, formData: FormData) => Promise<PhotoFormState>`)

- [ ] **Step 1: Server Actions**

```ts
// src/app/(family)/album/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type PhotoFormState = { error: string | null }

export async function savePhotoMeta(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const path = String(formData.get('path') ?? '')
  const date = String(formData.get('date') ?? '')

  if (!path || !date) {
    return { error: '사진 정보가 올바르지 않아요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_photo').insert({
    taken_dt: date,
    strpath: path,
    user_id: profile.userId,
  })

  if (error) return { error: '사진 저장에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null }
}

export async function updatePhoto(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const photoId = String(formData.get('photoId') ?? '')
  const date = String(formData.get('date') ?? '')
  const caption = String(formData.get('caption') ?? '')
  const location = String(formData.get('location') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_photo')
    .select('user_id')
    .eq('photo_id', photoId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { error } = await supabase
    .from('t_photo')
    .update({ taken_dt: date, caption, locatn: location, updated: new Date().toISOString() })
    .eq('photo_id', photoId)

  if (error) return { error: '사진 정보 저장에 실패했어요' }

  revalidatePath('/album')
  return { error: null }
}

export async function deletePhoto(
  _prevState: PhotoFormState,
  formData: FormData
): Promise<PhotoFormState> {
  const profile = await requireProfile()
  const photoId = String(formData.get('photoId') ?? '')
  const path = String(formData.get('path') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_photo')
    .select('user_id')
    .eq('photo_id', photoId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  await supabase.storage.from('photos').remove([path])
  const { error } = await supabase.from('t_photo').delete().eq('photo_id', photoId)
  if (error) return { error: '사진 삭제에 실패했어요' }

  revalidatePath('/album')
  revalidatePath('/')
  return { error: null }
}
```

- [ ] **Step 2: `album-client.tsx`에 업로드 버튼 + 라이트박스 추가**

파일 상단 import 교체:

```tsx
'use client'

import { useActionState, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/toast-provider'
import { deletePhoto, savePhotoMeta, updatePhoto, type PhotoFormState } from './actions'
import type { Photo, Profile } from '@/lib/types'
```

`formatDateKR`/`groupByDate` 아래, `AlbumClient` 함수 내부를 다음으로 교체(시그니처는 그대로 유지):

```tsx
export function AlbumClient({ photos, profile }: { photos: Photo[]; profile: Profile }) {
  const sections = groupByDate(photos)
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null)

  const initialState: PhotoFormState = { error: null }
  const [, saveMetaAction] = useActionState(savePhotoMeta, initialState)
  const [updateState, updateFormAction] = useActionState(updatePhoto, initialState)
  const [deleteState, deleteFormAction] = useActionState(deletePhoto, initialState)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const supabase = createClient()
    const today = new Date().toISOString().slice(0, 10)

    for (const file of Array.from(files)) {
      const path = `${profile.userId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('photos').upload(path, file)
      if (uploadError) {
        showToast('사진 업로드에 실패했어요')
        continue
      }
      const formData = new FormData()
      formData.set('path', path)
      formData.set('date', today)
      await saveMetaAction(formData)
    }

    setUploading(false)
    showToast('사진을 추가했어요')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <div className="cal-header">
        <div className="cal-title-group"><div className="cal-title">앨범</div></div>
        <div className="cal-actions">
          <label className="add-event" style={{ cursor: 'pointer' }}>
            {uploading ? '업로드 중...' : '+ 사진 추가'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="placeholder-page">
          <div className="ic">🖼</div>
          <h2>아직 추가된 사진이 없어요</h2>
          <p>위 &quot;+ 사진 추가&quot; 버튼으로 첫 사진을 올려보세요.</p>
        </div>
      ) : (
        sections.map(([date, group]) => (
          <div className="album-section" key={date}>
            <div className="album-section-title">{formatDateKR(date)}</div>
            <div className="photo-grid">
              {group.map((photo) => (
                <div className="photo-thumb" key={photo.id} onClick={() => setLightboxPhoto(photo)}>
                  <img src={photo.signedUrl} alt={photo.caption ?? ''} />
                  {photo.caption && <div className="cap">{photo.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {lightboxPhoto && (
        <div className="lightbox-overlay open" onClick={(e) => { if (e.target === e.currentTarget) setLightboxPhoto(null) }}>
          <div className="lightbox">
            <img className="lightbox-img" src={lightboxPhoto.signedUrl} alt="" />
            <div className="lightbox-body">
              <form
                action={async (formData) => {
                  await updateFormAction(formData)
                  if (!updateState.error) {
                    showToast('사진 정보를 저장했어요')
                    setLightboxPhoto(null)
                  }
                }}
              >
                <input type="hidden" name="photoId" value={lightboxPhoto.id} />
                <label>날짜</label>
                <input type="date" name="date" defaultValue={lightboxPhoto.date} required />
                <label>메모</label>
                <input type="text" name="caption" defaultValue={lightboxPhoto.caption ?? ''} placeholder="예: 거실에서" />
                <label>장소 (선택)</label>
                <input type="text" name="location" defaultValue={lightboxPhoto.location ?? ''} placeholder="예: 제주도" />
                {updateState.error && <p style={{ color: 'var(--burgundy)', fontSize: 12 }}>{updateState.error}</p>}
                <div className="lightbox-actions">
                  <button type="button" className="btn-cancel" onClick={() => setLightboxPhoto(null)}>닫기</button>
                  <button type="submit" className="btn-save">저장</button>
                </div>
              </form>
              <form
                action={async (formData) => {
                  await deleteFormAction(formData)
                  if (!deleteState.error) {
                    showToast('사진을 삭제했어요')
                    setLightboxPhoto(null)
                  }
                }}
              >
                <input type="hidden" name="photoId" value={lightboxPhoto.id} />
                <input type="hidden" name="path" value={lightboxPhoto.path} />
                <button type="submit" className="btn-delete">이 사진 삭제하기</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 수동 확인**

`/album`에서 "+ 사진 추가"로 실제 이미지 업로드 → 오늘 날짜 섹션에 나타나는지 → 클릭해 라이트박스에서 캡션/장소 수정 → 저장 반영 → 삭제까지 확인. 다른 계정(USER)으로 남의 사진 삭제 시도 시 "삭제 권한이 없어요" 에러 확인.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/(family)/album"
git commit -m "feat: add photo upload and lightbox edit/delete"
```

---

### Task 21: 대시보드 (위젯 조합)

**Files:**
- Create: `src/app/(family)/page.tsx` (Task 3에서 `src/app/page.tsx`는 삭제됐다 — 대시보드는 `(family)` 라우트 그룹 안에 새로 만들어야 Task 15의 보호 레이아웃이 감싼다)

**Interfaces:**
- Consumes: `requireProfile()` (Task 10), `createClient()` (server, Task 3), `buildWeekGrid`/`formatDateKey` (Task 8), `getHoliday` (Task 7), `toSignedPhotos` (Task 19)

- [ ] **Step 1: 대시보드 구현**

```tsx
// src/app/(family)/page.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { buildWeekGrid, formatDateKey } from '@/lib/calendar/grid'
import { getHoliday } from '@/lib/calendar/holidays'
import { toSignedPhotos } from '@/lib/photos'

const DOWS = ['일', '월', '화', '수', '목', '금', '토']

export default async function DashboardPage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const week = buildWeekGrid(new Date())
  const weekStart = formatDateKey(week[0])
  const weekEnd = formatDateKey(week[6])
  const today = formatDateKey(new Date())

  const { data: eventRows } = await supabase
    .from('t_event')
    .select('event_id, event_dt, title')
    .gte('event_dt', weekStart)
    .lte('event_dt', weekEnd)

  const { data: photoRows } = await supabase
    .from('t_photo')
    .select('photo_id, taken_dt, locatn, caption, strpath, user_id')
    .order('taken_dt', { ascending: false })
    .limit(5)

  const { count: memberCount } = await supabase
    .from('t_user')
    .select('user_id', { count: 'exact', head: true })

  const recentPhotos = await toSignedPhotos(supabase, photoRows ?? [])

  return (
    <section>
      <div className="topbar">
        <div>
          <div className="greet-eyebrow">오늘도 좋은 하루예요</div>
          <div className="greet"><span>{profile.name}</span>님</div>
        </div>
      </div>

      <div className="bento">
        <div className="card w-cal">
          <div className="card-head">
            <div className="card-title">이번 주 일정</div>
            <Link href="/calendar" className="card-link">달력 열기 →</Link>
          </div>
          <div className="week-row">
            {week.map((date, i) => {
              const key = formatDateKey(date)
              const holiday = getHoliday(key)
              const dayEvents = (eventRows ?? []).filter((e) => e.event_dt === key)
              const tag = holiday?.name ?? dayEvents[0]?.title
              return (
                <div className={`week-day${key === today ? ' today' : ''}`} key={key}>
                  <div className="dow">{DOWS[i]}</div>
                  <div className="num">{date.getDate()}</div>
                  {tag && <div className="tag">{tag}</div>}
                </div>
              )
            })}
          </div>
        </div>

        <div className="card w-user">
          <div className="avatar">{profile.name.slice(-2)}</div>
          <div className="name">{profile.name}</div>
          <div className="role">{profile.role}</div>
          <div className="stats">
            <div className="stat"><b>{memberCount ?? 0}</b><span>가족 구성원</span></div>
          </div>
        </div>

        <div className="card w-album">
          <div className="card-head">
            <div className="card-title">최근 앨범</div>
            <Link href="/album" className="card-link">전체 보기 →</Link>
          </div>
          <div className="album-grid">
            {recentPhotos.map((photo) => (
              <div className="ph" key={photo.id}>
                <img src={photo.signedUrl} alt={photo.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="card w-budget">
          <div className="card-head">
            <div className="card-title">가계부</div>
            <span className="card-link">준비중</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>가계부 기능은 곧 만나보실 수 있어요.</p>
        </div>

        <div className="card w-fridge">
          <div className="card-head">
            <div className="card-title">냉장고</div>
            <span className="card-link">준비중</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>냉장고 기능은 곧 만나보실 수 있어요.</p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 수동 확인**

`/`에서 이번 주 일정 위젯에 방금 만든 일정/공휴일이 보이는지, 최근 앨범 위젯에 업로드한 사진이 보이는지, 가족 구성원 수가 맞는지 확인. "달력 열기"/"전체 보기" 링크로 각 페이지 이동 확인.

- [ ] **Step 3: 전체 회귀 확인**

```bash
npm run test
npm run build
```

둘 다 통과해야 한다. `npm run build`가 실패하면(타입 에러 등) 원인을 고쳐야 Phase 1이 완료된 것으로 간주한다.

- [ ] **Step 4: 커밋**

```bash
git add "src/app/(family)/page.tsx"
git commit -m "feat: compose dashboard with calendar/album/user widgets"
```

---

## Self-Review 메모

- **스펙 커버리지**: 인증(초대+Google, Task 12~14) / 데이터 모델·RLS(Task 4~5) / Storage(Task 5, 19~20) / 라우트 구조(Task 11~21 전체) / 권한 모델(Task 6, 14, 18, 20) / 렌더링 방침(전 태스크에서 cacheComponents 미사용, Server Component+Action 패턴 일관 적용) / 에러 처리(각 Server Action의 `{error}` 반환 + 토스트) / 테스트 범위(Task 6~9) — 스펙의 모든 섹션에 대응하는 태스크가 있다.
- **타입 일관성**: `Profile`, `CalendarEvent`, `Photo`, `Role`은 Task 3에서 한 번만 정의하고 이후 모든 태스크가 그대로 import한다. `canModify(currentUserId, ownerUserId, role)` 시그니처는 Task 6에서 정의된 그대로 Task 18/20에서 사용된다. `createClient()`는 browser(Task 3, `@/lib/supabase/client`)와 server(Task 3, `@/lib/supabase/server`) 두 벌이 이름은 같지만 경로가 달라 혼동 소지가 있음 — 각 태스크의 import 경로를 명시해뒀다.
- **범위 밖 항목**: 위젯 드래그 편집, 가계부/냉장고/여행일기/게시판 실기능, 네이버 지도, 카카오/네이버 로그인, 멀티테넌시는 스펙대로 이 계획에 포함하지 않았다.
