# 우리집 — Phase 1 설계 (로그인 + 대시보드 + 달력 + 앨범)

## 배경

가족만 쓰는 일상 기록/관리 사이트. 노션 PRD와 동작하는 HTML 프로토타입(`docs/design/mockups/03-우리집_작동프로토타입_통합본.html` 등 3개 파일, 사용자 업로드)이 이미 UI/인터랙션/디자인 토큰을 상당 부분 규정하고 있음. 전체 기능(로그인/대시보드/달력/앨범/가계부/냉장고/여행일기/게시판)은 서브시스템이 많아 한 번에 스펙을 잡지 않고 단계별로 쪼갠다.

**Phase 1 범위**: 로그인, 대시보드, 달력, 앨범 — 프로토타입에서 실제로 동작하는 4개 기능.
**Phase 1 제외 (메뉴만 노출, "준비중")**: 가계부, 냉장고, 여행일기, 게시판. 각 기능은 이후 단계에서 별도 스펙으로 진행.

## 목표 / 성공 기준

- 가족 구성원이 이메일 초대로만 가입하고, 실제 세션 기반으로 로그인할 수 있다.
- 대시보드에서 이번 주 일정 / 최근 앨범 / 가계부(준비중 자리만) / 냉장고(준비중 자리만) 위젯을 정적 배치로 본다.
- 달력에서 월/주 뷰 전환, 한국 공휴일(대체공휴일 포함) 표시, 일정 CRUD가 실제 DB에 반영된다.
- 앨범에서 사진을 업로드하고, 날짜별로 보고, 캡션/장소를 수정·삭제할 수 있다.
- 가족 외부인이 사진/일정에 접근할 수 없다 (Storage는 서명 URL, DB는 RLS).

## 범위 밖 (Phase 1에서 하지 않음)

- 대시보드 위젯 드래그 재배치 / 사용자별 위젯 설정 (프로토타입엔 편집 버튼만 존재, 미구현 상태 유지)
- 가계부, 냉장고, 여행일기, 게시판의 실제 기능 (nav에 "준비중" 라벨로만 노출)
- 네이버 지도 연동, 가계부 엑셀 세분화, 냉장고 자동 연동 (모두 각 기능의 이후 단계 스펙에서 다룸)
- 카카오/네이버 소셜 로그인 (Google만 Phase 1에 포함)
- 다중 가족(멀티테넌시) — 이 앱은 단일 가족 전용으로 가정. `FAMILY_ID` 같은 컬럼은 넣지 않는다 (YAGNI)

## 사용자 / 권한 모델

세 역할, `T_USER.ROLE`에 저장:

| 역할 | 권한 |
|---|---|
| `ADMIN` | 사이트 전체 최상위 권한. Supabase 대시보드로 DB 직접 접근. 앱 UI 상 권한은 OPERATOR와 동일하게 취급(구분이 필요해지면 이후 단계에서 확장) |
| `OPERATOR` | 가족 관리 권한. 구성원 초대 가능. 다른 구성원의 일정/사진도 수정·삭제 가능 |
| `USER` | 열람 가능, 본인이 작성한 일정/사진만 작성·수정·삭제 가능 |

로그인한 가족 구성원은 역할과 무관하게 모든 일정·사진을 **열람**할 수 있다 (가족 공유 공간이므로).

## 인증

- **가입 방법**: 회원가입 폼 없음. OPERATOR/ADMIN이 이메일을 입력 → Supabase Auth의 초대 메일 발송 (비밀번호 설정 링크 포함) → 초대받은 사람이 링크에서 비밀번호를 설정하면 로그인됨.
- **로그인 방법**: 이메일+비밀번호, 또는 Google OAuth(이미 초대되어 있는 이메일과 연동된 경우만 — 새 계정 생성 경로로는 사용 불가).
- **세션 관리**: `@supabase/ssr`로 쿠키 기반 세션 (현재 `@supabase/supabase-js`만 설치돼 있어 추가 필요).
- **라우트 보호**: `proxy.ts` (Next.js 16 — `middleware.ts`는 deprecated, `proxy` export로 대체됨)에서 세션 쿠키 확인 → 미인증 시 `/login`으로 리다이렉트, 인증된 상태로 `/login` 접근 시 `/`로 리다이렉트.
- **초대 콜백**: `/auth/confirm` 라우트 핸들러에서 Supabase 인증 코드를 세션으로 교환한 뒤 비밀번호 설정 페이지로 안내. 비밀번호 설정 완료 시 `T_INVITE`에서 해당 이메일의 예정된 역할을 읽어 `T_USER` 행을 생성한다.
- **DB 직접 접근이 필요한 ADMIN 세팅**(첫 관리자 계정 생성 등)은 앱 UI가 아니라 Supabase 콘솔에서 수동으로 처리한다 (Phase 1에서는 관리자용 UI를 만들지 않음).

## 데이터 모델

PRD 규칙: 테이블 `T_` 접두사, 테이블/컬럼명 대문자, 긴 이름은 통상적인 약어로 7자 이내.

```
T_USER
  USER_ID   uuid, PK, = auth.users.id
  EMAIL     text, not null, unique
  NAME      text, not null
  ROLE      text, not null, check in ('USER','OPERATOR','ADMIN'), default 'USER'
  AVATAR    text, null  -- 아바타 색상 or 이니셜 프리셋 값
  CREATED   timestamptz, default now()

T_INVITE
  INVITE_ID uuid, PK, default gen_random_uuid()
  EMAIL     text, not null
  ROLE      text, not null, check in ('USER','OPERATOR','ADMIN')
  STATUS    text, not null, check in ('PENDING','ACCEPTED'), default 'PENDING'
  INV_BY    uuid, FK -> T_USER.USER_ID (초대한 사람)
  CREATED   timestamptz, default now()

T_EVENT   -- 달력
  EVENT_ID  uuid, PK, default gen_random_uuid()
  EVENT_DT  date, not null
  EVENT_TM  time, null
  TITLE     text, not null
  CATEGRY   text, null
  USER_ID   uuid, FK -> T_USER.USER_ID (작성자)
  CREATED   timestamptz, default now()
  UPDATED   timestamptz, default now()

T_PHOTO   -- 앨범
  PHOTO_ID  uuid, PK, default gen_random_uuid()
  TAKEN_DT  date, not null
  LOCATN    text, null
  CAPTION   text, null
  STRPATH   text, not null  -- Supabase Storage 내부 경로
  USER_ID   uuid, FK -> T_USER.USER_ID (업로더)
  CREATED   timestamptz, default now()
  UPDATED   timestamptz, default now()
```

**RLS 정책** (모든 테이블 RLS 활성화):
- `SELECT`: `auth.uid() IS NOT NULL` (로그인한 가족 구성원 전체 열람)
- `INSERT`: `auth.uid() IS NOT NULL`, `USER_ID`는 반드시 `auth.uid()`와 동일
- `UPDATE`/`DELETE`: `USER_ID = auth.uid()` **OR** 현재 사용자의 `T_USER.ROLE IN ('OPERATOR','ADMIN')`
- `T_INVITE`는 `OPERATOR`/`ADMIN`만 `INSERT`/`SELECT` 가능

## 파일(사진) 저장

- Supabase Storage에 `photos` 버킷을 **private**으로 생성.
- 업로드: 브라우저에서 Supabase JS 클라이언트로 버킷에 직접 업로드 (Storage RLS 정책으로 로그인한 사용자만 쓰기 허용) → 성공 시 반환된 경로를 Server Action으로 `T_PHOTO.STRPATH`에 저장.
- 조회: Server Component에서 서명 URL(`createSignedUrl`, 단기 만료)을 생성해 `<img>`에 전달.

## 라우트 구조

```
src/app/
  login/page.tsx              로그인 폼 (이메일+비번, Google 버튼)
  auth/confirm/route.ts       초대/OAuth 콜백 → 세션 교환
  auth/set-password/page.tsx  초대받은 사용자 최초 비밀번호 설정
  (family)/layout.tsx         보호된 레이아웃: 사이드바 nav, 상단바, 다크모드 토글
  (family)/page.tsx           대시보드
  (family)/calendar/page.tsx  달력
  (family)/album/page.tsx     앨범
  (family)/budget/page.tsx    준비중 placeholder
  (family)/fridge/page.tsx    준비중 placeholder
  (family)/trip/page.tsx      준비중 placeholder
  (family)/board/page.tsx     준비중 placeholder
proxy.ts                      세션 확인 + 리다이렉트
```

## 렌더링 / 데이터 흐름

- `cacheComponents`는 켜지 않는다 — 모든 페이지가 로그인 필요한 개인 데이터라 정적 셸의 이점이 없음. 클래식(default) 렌더링 모델 사용.
- 목록 조회(달력 이벤트, 사진 목록)는 Server Component에서 Supabase 서버 클라이언트로 직접 fetch.
- 생성/수정/삭제는 Server Actions (`'use server'`). 폼은 프로토타입의 모달 UI를 그대로 재현하되 `<form action={...}>` + `useActionState`로 연결.
- 사진 업로드만 예외적으로 클라이언트에서 Storage에 직접 업로드 (대용량 파일이 서버를 거치지 않도록).
- Server Action은 실행 시작 시 항상 세션 재검증 후 권한 체크 (Next.js 인증 가이드 권장 패턴 — Server Action은 공개 엔드포인트와 동일하게 취급).

## 디자인 토큰 (프로토타입에서 추출)

- 폰트: Pretendard Variable
- 라이트: `--bg:#F7F1EA --surface:#FFFEFC --ink:#2A211D --burgundy:#A11627 --gold:#B9884A --sage:#62744F`
- 다크: `--bg:#17100F --surface:#221715 --ink:#F6ECE6 --burgundy:#E14C57` 등 (프로토타입 CSS 변수 그대로 이식)
- 컴포넌트 스타일(벤토 그리드, 카드, 모달, 라이트박스, 토스트)은 프로토타입의 마크업/CSS를 Tailwind 4 + CSS 변수로 이식

## 에러 처리

- Server Action은 실패 시 `{ error: string }` 형태를 반환하고, 클라이언트는 `useActionState`로 받아 프로토타입과 동일한 토스트 UI로 노출.
- 라우트 세그먼트별 `error.tsx`로 예기치 못한 예외 처리.
- Storage 업로드 실패, 서명 URL 만료 등은 개별 컴포넌트에서 재시도 안내 토스트.

## 테스트 범위

핵심 로직만 단위 테스트 (Vitest):
- 권한 판정 함수 (본인 소유 여부, OPERATOR/ADMIN 여부에 따른 수정·삭제 허용 로직)
- 공휴일/대체공휴일 계산, 월/주 뷰 날짜 그리드 생성 로직
- 초대 상태 전이 (PENDING → ACCEPTED) 로직

UI/DB 연동은 자동화 테스트 없이 실제 실행으로 확인한다.

## 미해결 / 다음 단계에서 결정할 것

- ADMIN과 OPERATOR의 앱 내 권한 차이를 더 세분화할지 (현재는 동일하게 취급)
- 가계부/냉장고/여행일기/게시판 각각의 상세 스펙은 Phase 1 완료 후 별도 브레인스토밍
