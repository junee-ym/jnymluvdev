# 우리집 — 가계부 Phase 1 설계 (거래 입력 + 카테고리 + 예산)

## 배경

노션 기획 문서(`황금물결 엑셀가계부_2026` 이식 계획, "우리집 (jnymluvdev) 패치노트" 워크스페이스의 "가계부" 페이지 → "토글1")가 전체 30개 항목을 다루지만, 한 번에 스펙을 잡기엔 서브시스템이 너무 많다(수입/지출/저축 기록, 예산, 무지출 달력, 카드 검증, 자산/부채, 연간결산, 차트...). Phase 1은 그 중 실사용 빈도가 가장 높은 "거래 입력 + 월별 집계 + 카테고리 + 예산"만 다룬다.

## 목표 / 성공 기준

- 가족 구성원이 수입/지출/저축 거래를 날짜·카테고리·금액과 함께 입력할 수 있다.
- 지출 카테고리는 대분류→중분류→소분류 3단계, 수입/저축 카테고리는 플랫 목록이며, 가족이 직접 추가/수정/삭제할 수 있다.
- 월을 선택하면 그 달 총수입/총지출/저축액/저축률과 카테고리별 예산 대비 실적을 볼 수 있다.
- 카테고리별 월 예산을 설정하고 실제 지출과 비교할 수 있다.
- 로그인한 가족 전체가 모든 거래를 열람할 수 있고, 본인이 입력한 거래만(또는 운영자/관리자가) 수정·삭제할 수 있다 — 달력/앨범과 동일한 권한 모델.

## 범위 밖 (Phase 1에서 하지 않음)

- 무지출 달력, 카드 청구액 대조(실제 명세서 비교), 월말 자산/부채 및 순자산 계산, 연간결산, 각종 차트, 월간 리뷰 — 모두 이후 단계 스펙에서 다룸
- 고정지출의 "반복 등록"(매달 자동 생성) — Phase 1은 거래마다 `고정/변동` 플래그만 붙이고, 반복 자동화는 하지 않는다
- 가구(household) 다중 테넌시 — 기존 스키마와 동일하게 이 앱은 단일 가족 전용으로 가정, `household_id` 없음 (YAGNI)

## 사용자 / 권한 모델

기존 `t_event`/`t_photo`와 동일한 모델을 재사용한다:

- **거래(`t_transaction`)**: 가족 전체 SELECT, 본인 INSERT, 수정/삭제는 본인 또는 OPERATOR/ADMIN (`canModify()` 재사용).
- **카테고리(`t_budget_category`) / 예산(`t_budget`)**: 소유 개념 없는 공용 설정값. 초대된 가족 구성원은 이미 신뢰 대상이므로 운영자 게이트 없이 로그인한 누구나 CRUD 가능.

## 데이터 모델

```
t_budget_category
  category_id uuid, PK, default gen_random_uuid()
  tx_type     text, not null, check in ('INCOME','EXPENSE','SAVING')
  parent_id   uuid, null, FK -> t_budget_category.category_id
              -- EXPENSE: parent_id 체인으로 대(top)→중→소(leaf) 3단계
              -- INCOME/SAVING: 항상 null (플랫 목록)
  name        text, not null
  created     timestamptz, not null, default now()

t_transaction
  transaction_id uuid, PK, default gen_random_uuid()
  tx_dt       date, not null
  tx_type     text, not null, check in ('INCOME','EXPENSE','SAVING')
  fixed       boolean, not null, default false   -- 고정/변동 구분
  category_id uuid, not null, FK -> t_budget_category.category_id
  amount      numeric(12,0), not null, check (amount > 0)
  source      text, null     -- 거래출처 (카드1/현금 등), 자유 입력
  evaluation  text, null, check in ('소비','낭비','투자')  -- EXPENSE에만 사용, 그 외 null
  memo        text, null
  user_id     uuid, not null, FK -> t_user.user_id (입력한 사람)
  created     timestamptz, not null, default now()
  updated     timestamptz, not null, default now()

t_budget
  budget_id   uuid, PK, default gen_random_uuid()
  category_id uuid, not null, FK -> t_budget_category.category_id
  year_month  text, not null   -- 'YYYY-MM'
  amount      numeric(12,0), not null, check (amount >= 0)
  unique (category_id, year_month)
```

카테고리 시드 데이터: 노션 문서의 지출 카테고리(식비/생활/꾸밈/교통/자동차/주거/통신/건강/금융지출/문화여가/교육/자녀/반려동물/경조·선물/여행/업무지출/기타, 각 중분류 아래 소분류)와 수입(남편급여/아내급여/금융수입/기타부수입), 저축(청약저축/연금/투자/적금/비상금/대출상환) 항목을 마이그레이션에 `insert`로 미리 채운다.

## RLS 정책 방향

- `t_transaction`: `select` — 로그인한 모든 `t_user` 행 존재자. `insert` — `user_id = auth.uid()`. `update`/`delete` — 본인이거나 `t_user.role in ('OPERATOR','ADMIN')` (기존 `canModify()` 서버 로직과 대칭되는 정책).
- `t_budget_category`, `t_budget`: `select`/`insert`/`update`/`delete` 모두 — 로그인한 `t_user` 행 존재자 전체 허용 (소유자 컬럼 없음).

## 화면 구성 (`/budget`)

`nav-sidebar.tsx`의 `NAV_ITEMS_SOON`에서 `NAV_ITEMS`로 이동, `PlaceholderPage`를 실제 페이지로 교체.

- 서버 컴포넌트가 월(`year_month`, 쿼리 파라미터 또는 클라이언트 상태)별 거래/예산을 Supabase에서 조회 (`calendar`의 월 이동 패턴 재사용).
- 상단 요약: 총수입/총지출/저축액/저축률 (서버에서 집계 계산, DB 뷰 없이 JS로 합산 — 규모상 SQL 집계 함수도 충분하지만 Phase 1은 단순 합산으로 시작).
- 카테고리별 예산 대비 실적: 카테고리 리스트 + 진행바(%), `t_budget`와 해당 월 `t_transaction` 합계 비교.
- 거래 목록: 월별 리스트 + 추가/수정/삭제 (Server Actions, `calendar/actions.ts` 패턴).
- 카테고리 관리: 별도 섹션(모달 또는 서브페이지)에서 대/중/소분류 추가/수정/삭제.

## 테스트

`npm run test` (Vitest) 대상 — 순수 로직만:

- 저축률/저축금액 계산 함수
- 카테고리 트리 구성(대분류 자동 유도) 로직
- 예산 사용률 계산

## 열린 질문 / 다음 단계

- 예산을 어느 레벨(대/중/소분류)에 설정 가능하게 할지는 구현 중 UI로 자연스럽게 결정 — 카테고리 어떤 노드든 예산 설정 가능하게 열어둠(제약 없음).
- Phase 1 완료 후: 무지출 달력 → 자산/부채·순자산 → 연간결산·차트 순으로 다음 스펙 진행 예정.
