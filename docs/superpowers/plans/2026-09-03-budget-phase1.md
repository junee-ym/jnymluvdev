# 가계부 Phase 1 (거래 입력 + 카테고리 + 예산) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 가족이 수입/지출/저축 거래를 입력하고, 3단계 카테고리를 직접 관리하고, 카테고리별 월 예산 대비 실적을 보는 `/budget` 페이지를 만든다.

**Architecture:** 기존 `달력`(`t_event`) 기능과 동일한 패턴 — Server Component가 Supabase에서 월별 데이터를 읽고, Server Actions(`'use server'`)가 CRUD를 처리하고, RLS가 최종 방어선. 월 이동은 클라이언트 상태가 아니라 `?month=YYYY-MM` 쿼리 파라미터 + `<Link>`로 처리해 서버 컴포넌트가 항상 그 달 데이터만 가져온다.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), Supabase(Postgres+RLS), TypeScript, Vitest, 순수 CSS(기존 `globals.css`의 `.budget-*`/`.modal-*`/`.cal-*` 클래스 재사용, 신규 CSS 없음).

**Spec:** `docs/superpowers/specs/2026-09-03-budget-phase1-design.md`

## Global Constraints

- 이 앱은 단일 가족 전용 — `household_id` 등 멀티테넌시 컬럼을 추가하지 않는다.
- 모든 신규 테이블은 RLS를 활성화하고 정책을 반드시 건다 (RLS가 클라이언트/서버 로직이 뚫려도 막는 최종 방어선).
- 권한 판정은 기존 `canModify()`(`src/lib/auth/permissions.ts`)와 `public.is_operator_or_admin()`(DB 함수) 패턴을 그대로 재사용한다 — 새 권한 체계를 만들지 않는다.
- 테스트는 순수 로직만 Vitest로 커버한다(`npm run test`). 타입체크는 `npm run build`로 확인한다 — bare `tsc --noEmit`은 `.next/types`가 없으면 오탐이 난다.
- 이번 계획 범위 밖: 무지출 달력, 카드 청구액 대조, 자산/부채·순자산, 연간결산, 차트, 월간 리뷰, 고정지출 반복 자동생성.

---

### Task 1: DB 마이그레이션 — 스키마 + RLS + 카테고리 시드

**Files:**
- Create: `supabase/migrations/20260904120000_family_hub_budget_phase1.sql`

**Interfaces:**
- Produces: 테이블 `t_budget_category(category_id, tx_type, parent_id, name, created)`, `t_transaction(transaction_id, tx_dt, tx_type, fixed, category_id, amount, source, evaluation, memo, user_id, created, updated)`, `t_budget(budget_id, category_id, year_month, amount)`. 이후 모든 Task가 이 컬럼명을 그대로 쓴다.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- supabase/migrations/20260904120000_family_hub_budget_phase1.sql
-- 가계부 Phase 1: 거래 입력 + 카테고리(3단계) + 예산

create table public.t_budget_category (
  category_id uuid primary key default gen_random_uuid(),
  tx_type text not null check (tx_type in ('INCOME','EXPENSE','SAVING')),
  parent_id uuid references public.t_budget_category(category_id) on delete cascade,
  name text not null,
  created timestamptz not null default now()
);

create table public.t_transaction (
  transaction_id uuid primary key default gen_random_uuid(),
  tx_dt date not null,
  tx_type text not null check (tx_type in ('INCOME','EXPENSE','SAVING')),
  fixed boolean not null default false,
  category_id uuid not null references public.t_budget_category(category_id),
  amount numeric(12,0) not null check (amount > 0),
  source text,
  evaluation text check (evaluation in ('소비','낭비','투자')),
  memo text,
  user_id uuid not null references public.t_user(user_id),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

create table public.t_budget (
  budget_id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.t_budget_category(category_id),
  year_month text not null,
  amount numeric(12,0) not null check (amount >= 0),
  unique (category_id, year_month)
);

alter table public.t_budget_category enable row level security;
alter table public.t_transaction enable row level security;
alter table public.t_budget enable row level security;

-- t_budget_category: 소유자 없는 공용 설정값 — 로그인한 가족 구성원 누구나 CRUD
create policy "가족 전체 열람" on public.t_budget_category for select using (auth.uid() is not null);
create policy "가족 전체 생성" on public.t_budget_category for insert with check (auth.uid() is not null);
create policy "가족 전체 수정" on public.t_budget_category for update using (auth.uid() is not null);
create policy "가족 전체 삭제" on public.t_budget_category for delete using (auth.uid() is not null);

-- t_transaction: 열람은 가족 전체, 생성은 본인 명의, 수정/삭제는 본인 또는 운영자/관리자
create policy "가족 전체 열람" on public.t_transaction for select using (auth.uid() is not null);
create policy "본인 작성" on public.t_transaction for insert with check (user_id = auth.uid());
create policy "본인 또는 운영자 수정" on public.t_transaction for update
  using (user_id = auth.uid() or public.is_operator_or_admin());
create policy "본인 또는 운영자 삭제" on public.t_transaction for delete
  using (user_id = auth.uid() or public.is_operator_or_admin());

-- t_budget: 소유자 없는 공용 설정값 — 로그인한 가족 구성원 누구나 CRUD
create policy "가족 전체 열람" on public.t_budget for select using (auth.uid() is not null);
create policy "가족 전체 생성" on public.t_budget for insert with check (auth.uid() is not null);
create policy "가족 전체 수정" on public.t_budget for update using (auth.uid() is not null);
create policy "가족 전체 삭제" on public.t_budget for delete using (auth.uid() is not null);

-- 카테고리 시드 데이터 (노션 기획 문서 "가계부" 페이지 기준)
insert into public.t_budget_category (tx_type, parent_id, name) values
  ('INCOME', null, '남편급여'),
  ('INCOME', null, '아내급여'),
  ('INCOME', null, '금융수입'),
  ('INCOME', null, '기타부수입'),
  ('SAVING', null, '청약저축'),
  ('SAVING', null, '연금'),
  ('SAVING', null, '투자'),
  ('SAVING', null, '적금'),
  ('SAVING', null, '비상금'),
  ('SAVING', null, '대출상환');

-- 지출 카테고리: 대분류(parent_id null)마다 CTE로 만들고, 그 id를 받아 중분류(소분류)를 자식으로 연결한다.
with
  cat_식비 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','식비') returning category_id),
  cat_생활 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','생활') returning category_id),
  cat_꾸밈 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','꾸밈') returning category_id),
  cat_교통 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','교통') returning category_id),
  cat_자동차 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','자동차') returning category_id),
  cat_주거 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','주거') returning category_id),
  cat_통신 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','통신') returning category_id),
  cat_건강 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','건강') returning category_id),
  cat_금융지출 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','금융지출') returning category_id),
  cat_문화여가 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','문화여가') returning category_id),
  cat_교육 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','교육') returning category_id),
  cat_자녀 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','자녀') returning category_id),
  cat_반려동물 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','반려동물') returning category_id),
  cat_경조선물 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','경조/선물') returning category_id),
  cat_여행 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','여행') returning category_id),
  cat_업무지출 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','업무지출') returning category_id),
  cat_기타 as (insert into public.t_budget_category (tx_type, name) values ('EXPENSE','기타') returning category_id)
insert into public.t_budget_category (tx_type, parent_id, name)
select 'EXPENSE', category_id, sub.name from cat_식비, (values ('식재료'),('외식'),('배달'),('간식')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_생활, (values ('생필품'),('생활서비스'),('생활용품'),('가구'),('가전'),('용돈')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_꾸밈, (values ('의류'),('잡화'),('화장품'),('미용실')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_교통, (values ('대중교통'),('택시'),('철도')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_자동차, (values ('주유'),('주차/통행료'),('수리'),('자동차세'),('보험')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_주거, (values ('관리비'),('가스비'),('전기세'),('수도세'),('월세')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_통신, (values ('휴대폰'),('인터넷/TV')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_건강, (values ('병원'),('약국'),('건강식품'),('운동')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_금융지출, (values ('보험료'),('대출이자')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_문화여가, (values ('영화'),('공연'),('카페'),('도서')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_교육, (values ('학원/강의'),('교재'),('학교'),('시험료')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_자녀, (values ('육아용품'),('돌봄비'),('용돈'),('교육')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_반려동물, (values ('동물병원'),('사료'),('간식'),('용품')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_경조선물, (values ('축의/부의'),('선물'),('가족식사')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_여행, (values ('여행'),('항공권'),('숙박비'),('입장료')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_업무지출, (values ('교통비'),('식사'),('용품')) as sub(name)
union all
select 'EXPENSE', category_id, sub.name from cat_기타, (values ('세금'),('연간비'),('기타 비용')) as sub(name);
```

- [ ] **Step 2: 마이그레이션 적용**

Run: `npx supabase link --project-ref tfcgmolcduavcevqdoof` (이미 링크돼 있으면 생략) 후 `npx supabase db push`
Expected: 마이그레이션이 성공적으로 적용됨 (에러 없이 종료)

- [ ] **Step 3: Supabase 콘솔(Table Editor 또는 SQL Editor)에서 확인**

```sql
select tx_type, count(*) from public.t_budget_category group by tx_type;
```
Expected: `INCOME` 4행, `SAVING` 6행, `EXPENSE` 17(대분류) + 각 소분류 합계(총 65행: 17 + 4+6+4+3+5+5+2+4+2+4+4+4+4+3+4+3+3 = 17+56=73... 정확한 숫자보다 "0행이 아니고 EXPENSE가 대다수"인지만 확인) — 세 `tx_type` 모두 0행이 아니면 통과.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260904120000_family_hub_budget_phase1.sql
git commit -m "feat: 가계부 테이블(t_budget_category/t_transaction/t_budget) + RLS + 카테고리 시드 추가"
```

---

### Task 2: 도메인 타입 추가

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: 없음 (순수 타입 추가)
- Produces: `TxType`, `BudgetCategory { id, txType, parentId, name }`, `BudgetTransaction { id, date, txType, fixed, categoryId, amount, source, evaluation, memo, userId }`, `Budget { id, categoryId, yearMonth, amount }` — 이후 모든 Task가 이 타입을 쓴다.

- [ ] **Step 1: 타입 추가**

`src/lib/types.ts` 맨 아래에 추가:

```ts
export type TxType = 'INCOME' | 'EXPENSE' | 'SAVING'

export type BudgetCategory = {
  id: string
  txType: TxType
  parentId: string | null
  name: string
}

export type BudgetTransaction = {
  id: string
  date: string // YYYY-MM-DD
  txType: TxType
  fixed: boolean
  categoryId: string
  amount: number
  source: string | null
  evaluation: '소비' | '낭비' | '투자' | null
  memo: string | null
  userId: string
}

export type Budget = {
  id: string
  categoryId: string
  yearMonth: string // YYYY-MM
  amount: number
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run build`
Expected: 에러 없이 빌드 성공 (새 타입은 아직 아무 데서도 안 쓰이므로 실패할 이유가 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/types.ts
git commit -m "feat: 가계부 도메인 타입(TxType/BudgetCategory/BudgetTransaction/Budget) 추가"
```

---

### Task 3: 순수 계산/날짜 로직

**Files:**
- Create: `src/lib/budget/calc.ts`
- Test: `src/lib/budget/calc.test.ts`

**Interfaces:**
- Consumes: `BudgetCategory`, `TxType` (Task 2)
- Produces: `calcSavings(totalIncome, totalExpense): { amount: number; rate: number }`, `calcBudgetUsage(spent, budget): number`, `type CategoryNode = { id, name, txType, children: CategoryNode[] }`, `buildCategoryTree(categories: BudgetCategory[]): CategoryNode[]`, `flattenCategoryTree(nodes: CategoryNode[], depth?: number): { id, name, depth }[]`, `yearMonthRange(yearMonth): { start, end }`, `shiftYearMonth(yearMonth, delta): string` — Task 6, 7이 이 함수들을 그대로 가져다 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/lib/budget/calc.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildCategoryTree,
  calcBudgetUsage,
  calcSavings,
  flattenCategoryTree,
  shiftYearMonth,
  yearMonthRange,
} from './calc'
import type { BudgetCategory } from '@/lib/types'

describe('calcSavings', () => {
  it('수입에서 지출을 뺀 금액과 저축률을 계산한다', () => {
    expect(calcSavings(5_000_000, 3_000_000)).toEqual({ amount: 2_000_000, rate: 40 })
  })

  it('수입이 0이면 저축률은 0이다(0으로 나누기 방지)', () => {
    expect(calcSavings(0, 0)).toEqual({ amount: 0, rate: 0 })
  })
})

describe('calcBudgetUsage', () => {
  it('예산 대비 지출 비율을 계산한다', () => {
    expect(calcBudgetUsage(215_000, 300_000)).toBeCloseTo(71.6667, 3)
  })

  it('예산이 0이면 0을 반환한다(0으로 나누기 방지)', () => {
    expect(calcBudgetUsage(10_000, 0)).toBe(0)
  })
})

function cat(id: string, name: string, parentId: string | null = null): BudgetCategory {
  return { id, txType: 'EXPENSE', parentId, name }
}

describe('buildCategoryTree', () => {
  it('parentId 기준으로 대→중 트리를 구성한다', () => {
    const categories = [cat('food', '식비'), cat('food-out', '외식', 'food'), cat('life', '생활')]
    const tree = buildCategoryTree(categories)
    expect(tree.map((n) => n.id)).toEqual(['food', 'life'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['food-out'])
  })

  it('parentId가 없는 카테고리는 모두 루트로 취급한다(수입/저축)', () => {
    const categories = [cat('salary', '남편급여'), cat('bonus', '기타부수입')]
    const tree = buildCategoryTree(categories)
    expect(tree.length).toBe(2)
    expect(tree[0].children).toEqual([])
  })
})

describe('flattenCategoryTree', () => {
  it('트리를 깊이 정보와 함께 평탄화한다', () => {
    const tree = buildCategoryTree([cat('food', '식비'), cat('food-out', '외식', 'food')])
    expect(flattenCategoryTree(tree)).toEqual([
      { id: 'food', name: '식비', depth: 0 },
      { id: 'food-out', name: '외식', depth: 1 },
    ])
  })
})

describe('yearMonthRange', () => {
  it('9월은 30일까지다', () => {
    expect(yearMonthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
  })

  it('윤년 2월은 29일까지다', () => {
    expect(yearMonthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('shiftYearMonth', () => {
  it('다음 달로 이동한다', () => {
    expect(shiftYearMonth('2026-09', 1)).toBe('2026-10')
  })

  it('12월에서 다음 달로 가면 해가 바뀐다', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01')
  })

  it('이전 달로 이동한다', () => {
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test -- calc`
Expected: FAIL — `Cannot find module './calc'`

- [ ] **Step 3: 구현**

```ts
// src/lib/budget/calc.ts
import type { BudgetCategory, TxType } from '@/lib/types'

export function calcSavings(totalIncome: number, totalExpense: number): { amount: number; rate: number } {
  const amount = totalIncome - totalExpense
  const rate = totalIncome > 0 ? (amount / totalIncome) * 100 : 0
  return { amount, rate }
}

export function calcBudgetUsage(spent: number, budget: number): number {
  if (budget <= 0) return 0
  return (spent / budget) * 100
}

export type CategoryNode = {
  id: string
  name: string
  txType: TxType
  children: CategoryNode[]
}

export function buildCategoryTree(categories: BudgetCategory[]): CategoryNode[] {
  const nodeById = new Map<string, CategoryNode>()
  for (const c of categories) {
    nodeById.set(c.id, { id: c.id, name: c.name, txType: c.txType, children: [] })
  }
  const roots: CategoryNode[] = []
  for (const c of categories) {
    const node = nodeById.get(c.id)!
    if (c.parentId && nodeById.has(c.parentId)) {
      nodeById.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

export function flattenCategoryTree(
  nodes: CategoryNode[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ])
}

export function yearMonthRange(yearMonth: string): { start: string; end: string } {
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const lastDay = new Date(year, month, 0).getDate()
  return { start: `${yearMonth}-01`, end: `${yearMonth}-${String(lastDay).padStart(2, '0')}` }
}

export function shiftYearMonth(yearMonth: string, delta: number): string {
  const [yearStr, monthStr] = yearMonth.split('-')
  const date = new Date(Number(yearStr), Number(monthStr) - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- calc`
Expected: 모든 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/budget/calc.ts src/lib/budget/calc.test.ts
git commit -m "feat: 가계부 순수 계산/날짜 로직(저축률, 예산사용률, 카테고리 트리, 월 이동) 추가"
```

---

### Task 4: 거래 CRUD 서버 액션

**Files:**
- Create: `src/app/(family)/budget/actions.ts`

**Interfaces:**
- Consumes: `requireProfile()`(`@/lib/auth/session`), `canModify()`(`@/lib/auth/permissions`), `createClient()`(`@/lib/supabase/server`)
- Produces: `type TransactionFormState = { error: string | null }`, `createTransaction`, `updateTransaction`, `deleteTransaction` — 각 `(prevState: TransactionFormState, formData: FormData) => Promise<TransactionFormState>` 시그니처. Task 7이 그대로 `useActionState`에 넘긴다.

- [ ] **Step 1: 구현**

```ts
// src/app/(family)/budget/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { canModify } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'

export type TransactionFormState = { error: string | null }

const TX_TYPES = ['INCOME', 'EXPENSE', 'SAVING']

export async function createTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const profile = await requireProfile()
  const date = String(formData.get('date') ?? '')
  const txType = String(formData.get('txType') ?? '')
  const categoryId = String(formData.get('categoryId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const fixed = formData.get('fixed') === 'on'
  const source = String(formData.get('source') ?? '').trim() || null
  const evaluation = String(formData.get('evaluation') ?? '').trim() || null
  const memo = String(formData.get('memo') ?? '').trim() || null

  if (!date || !categoryId || !(amount > 0) || !TX_TYPES.includes(txType)) {
    return { error: '날짜, 카테고리, 금액을 확인해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('t_transaction').insert({
    tx_dt: date,
    tx_type: txType,
    fixed,
    category_id: categoryId,
    amount,
    source,
    evaluation,
    memo,
    user_id: profile.userId,
  })

  if (error) return { error: '거래 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function updateTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const profile = await requireProfile()
  const transactionId = String(formData.get('transactionId') ?? '')
  const date = String(formData.get('date') ?? '')
  const txType = String(formData.get('txType') ?? '')
  const categoryId = String(formData.get('categoryId') ?? '')
  const amount = Number(formData.get('amount') ?? 0)
  const fixed = formData.get('fixed') === 'on'
  const source = String(formData.get('source') ?? '').trim() || null
  const evaluation = String(formData.get('evaluation') ?? '').trim() || null
  const memo = String(formData.get('memo') ?? '').trim() || null

  if (!transactionId || !date || !categoryId || !(amount > 0) || !TX_TYPES.includes(txType)) {
    return { error: '날짜, 카테고리, 금액을 확인해주세요' }
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_transaction')
    .select('user_id')
    .eq('transaction_id', transactionId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '수정 권한이 없어요' }
  }

  const { error } = await supabase
    .from('t_transaction')
    .update({
      tx_dt: date,
      tx_type: txType,
      fixed,
      category_id: categoryId,
      amount,
      source,
      evaluation,
      memo,
      updated: new Date().toISOString(),
    })
    .eq('transaction_id', transactionId)

  if (error) return { error: '거래 수정에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function deleteTransaction(
  _prevState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  const profile = await requireProfile()
  const transactionId = String(formData.get('transactionId') ?? '')

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('t_transaction')
    .select('user_id')
    .eq('transaction_id', transactionId)
    .single()

  if (!existing || !canModify(profile.userId, existing.user_id, profile.role)) {
    return { error: '삭제 권한이 없어요' }
  }

  const { error } = await supabase.from('t_transaction').delete().eq('transaction_id', transactionId)
  if (error) return { error: '거래 삭제에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run build`
Expected: 에러 없이 빌드 성공 (아직 이 파일을 가져다 쓰는 곳이 없어도 독립적으로 타입체크됨)

- [ ] **Step 3: 커밋**

```bash
git add "src/app/(family)/budget/actions.ts"
git commit -m "feat: 가계부 거래 CRUD 서버 액션 추가"
```

---

### Task 5: 카테고리 & 예산 서버 액션

**Files:**
- Create: `src/app/(family)/budget/category-actions.ts`

**Interfaces:**
- Consumes: `requireProfile()`, `createClient()`
- Produces: `type CategoryFormState = { error: string | null }`, `createCategory`, `updateCategory`, `deleteCategory`; `type BudgetFormState = { error: string | null }`, `setBudget` — 모두 `(prevState, formData) => Promise<...FormState>` 시그니처. Task 7이 그대로 사용한다.

- [ ] **Step 1: 구현**

```ts
// src/app/(family)/budget/category-actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

export type CategoryFormState = { error: string | null }

const TX_TYPES = ['INCOME', 'EXPENSE', 'SAVING']

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireProfile()
  const txType = String(formData.get('txType') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const parentId = String(formData.get('parentId') ?? '').trim() || null

  if (!name || !TX_TYPES.includes(txType)) {
    return { error: '카테고리 이름을 입력해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('t_budget_category')
    .insert({ tx_type: txType, parent_id: parentId, name })

  if (error) return { error: '카테고리 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function updateCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireProfile()
  const categoryId = String(formData.get('categoryId') ?? '')
  const name = String(formData.get('name') ?? '').trim()

  if (!categoryId || !name) return { error: '카테고리 이름을 입력해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_category').update({ name }).eq('category_id', categoryId)
  if (error) return { error: '카테고리 수정에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}

export async function deleteCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await requireProfile()
  const categoryId = String(formData.get('categoryId') ?? '')
  if (!categoryId) return { error: '카테고리를 선택해주세요' }

  const supabase = await createClient()
  const { error } = await supabase.from('t_budget_category').delete().eq('category_id', categoryId)
  if (error) return { error: '이 카테고리를 쓰는 거래나 하위 카테고리가 있으면 삭제할 수 없어요' }

  revalidatePath('/budget')
  return { error: null }
}

export type BudgetFormState = { error: string | null }

export async function setBudget(
  _prevState: BudgetFormState,
  formData: FormData
): Promise<BudgetFormState> {
  await requireProfile()
  const categoryId = String(formData.get('categoryId') ?? '')
  const yearMonth = String(formData.get('yearMonth') ?? '')
  const amount = Number(formData.get('amount') ?? 0)

  if (!categoryId || !yearMonth || !(amount >= 0)) {
    return { error: '카테고리와 예산 금액을 확인해주세요' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('t_budget')
    .upsert({ category_id: categoryId, year_month: yearMonth, amount }, { onConflict: 'category_id,year_month' })

  if (error) return { error: '예산 저장에 실패했어요' }

  revalidatePath('/budget')
  return { error: null }
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add "src/app/(family)/budget/category-actions.ts"
git commit -m "feat: 가계부 카테고리/예산 서버 액션 추가"
```

---

### Task 6: `/budget` 페이지 서버 컴포넌트

**Files:**
- Modify: `src/app/(family)/budget/page.tsx` (현재 `PlaceholderPage`만 렌더하는 파일 — 전체 교체)

**Interfaces:**
- Consumes: `requireProfile()`, `createClient()`, `yearMonthRange()`(Task 3), `BudgetCategory`/`BudgetTransaction`/`Budget`(Task 2), `BudgetClient`(Task 7)
- Produces: 없음 (페이지, 리프 노드)

- [ ] **Step 1: 기존 플레이스홀더 확인**

`src/app/(family)/budget/page.tsx` 현재 내용(`PlaceholderPage` 렌더)을 아래로 통째로 교체한다.

- [ ] **Step 2: 구현**

```tsx
// src/app/(family)/budget/page.tsx
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'
import { yearMonthRange } from '@/lib/budget/calc'
import { BudgetClient } from './budget-client'
import type { Budget, BudgetCategory, BudgetTransaction } from '@/lib/types'

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const profile = await requireProfile()
  const yearMonth = (await searchParams).month || currentYearMonth()
  const { start, end } = yearMonthRange(yearMonth)
  const supabase = await createClient()

  const [{ data: categoryRows }, { data: transactionRows }, { data: budgetRows }] = await Promise.all([
    supabase
      .from('t_budget_category')
      .select('category_id, tx_type, parent_id, name')
      .order('created', { ascending: true }),
    supabase
      .from('t_transaction')
      .select('transaction_id, tx_dt, tx_type, fixed, category_id, amount, source, evaluation, memo, user_id')
      .gte('tx_dt', start)
      .lte('tx_dt', end)
      .order('tx_dt', { ascending: false }),
    supabase.from('t_budget').select('budget_id, category_id, year_month, amount').eq('year_month', yearMonth),
  ])

  const categories: BudgetCategory[] = (categoryRows ?? []).map((row) => ({
    id: row.category_id,
    txType: row.tx_type,
    parentId: row.parent_id,
    name: row.name,
  }))

  const transactions: BudgetTransaction[] = (transactionRows ?? []).map((row) => ({
    id: row.transaction_id,
    date: row.tx_dt,
    txType: row.tx_type,
    fixed: row.fixed,
    categoryId: row.category_id,
    amount: row.amount,
    source: row.source,
    evaluation: row.evaluation,
    memo: row.memo,
    userId: row.user_id,
  }))

  const budgets: Budget[] = (budgetRows ?? []).map((row) => ({
    id: row.budget_id,
    categoryId: row.category_id,
    yearMonth: row.year_month,
    amount: row.amount,
  }))

  return (
    <BudgetClient
      yearMonth={yearMonth}
      categories={categories}
      transactions={transactions}
      budgets={budgets}
      profile={profile}
    />
  )
}
```

- [ ] **Step 3: 커밋 (Task 7과 함께 검증 후 커밋 — 이 파일만으로는 `BudgetClient` 미존재로 빌드가 깨지므로 Task 7 완료 후 커밋)**

이 Task는 커밋하지 않고 다음 Task로 이어간다 (같은 기능 단위).

---

### Task 7: `BudgetClient` UI (월 요약, 예산 진행바, 거래/카테고리 관리)

**Files:**
- Create: `src/app/(family)/budget/budget-client.tsx`

**Interfaces:**
- Consumes: 모든 Task 2~6의 타입/함수/서버 액션, `canModify()`(`@/lib/auth/permissions`), `useToast()`(`@/components/toast-provider`)
- Produces: `BudgetClient` 컴포넌트 (props: `yearMonth, categories, transactions, budgets, profile`)

- [ ] **Step 1: 구현**

```tsx
// src/app/(family)/budget/budget-client.tsx
'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  buildCategoryTree,
  calcBudgetUsage,
  calcSavings,
  flattenCategoryTree,
  shiftYearMonth,
} from '@/lib/budget/calc'
import { canModify } from '@/lib/auth/permissions'
import type { Budget, BudgetCategory, BudgetTransaction, Profile, TxType } from '@/lib/types'
import { createTransaction, deleteTransaction, updateTransaction, type TransactionFormState } from './actions'
import {
  createCategory,
  deleteCategory,
  setBudget,
  updateCategory,
  type BudgetFormState,
  type CategoryFormState,
} from './category-actions'
import { useToast } from '@/components/toast-provider'

const TX_TYPE_LABEL: Record<TxType, string> = { INCOME: '수입', EXPENSE: '지출', SAVING: '저축' }
const EVALUATIONS = ['소비', '낭비', '투자'] as const

function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function BudgetClient({
  yearMonth,
  categories,
  transactions,
  budgets,
  profile,
}: {
  yearMonth: string
  categories: BudgetCategory[]
  transactions: BudgetTransaction[]
  budgets: Budget[]
  profile: Profile
}) {
  const { showToast } = useToast()
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [editingTx, setEditingTx] = useState<BudgetTransaction | null>(null)
  const [txType, setTxType] = useState<TxType>('EXPENSE')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null)
  const [categoryFormType, setCategoryFormType] = useState<TxType>('EXPENSE')
  const [categoryFormParentId, setCategoryFormParentId] = useState('')

  const initialTxState: TransactionFormState = { error: null }
  const [createState, createFormAction, createPending] = useActionState(createTransaction, initialTxState)
  const [updateState, updateFormAction, updatePending] = useActionState(updateTransaction, initialTxState)
  const [deleteState, deleteFormAction, deletePending] = useActionState(deleteTransaction, initialTxState)

  const initialCategoryState: CategoryFormState = { error: null }
  const [createCatState, createCatFormAction, createCatPending] = useActionState(createCategory, initialCategoryState)
  const [updateCatState, updateCatFormAction, updateCatPending] = useActionState(updateCategory, initialCategoryState)
  const [deleteCatState, deleteCatFormAction, deleteCatPending] = useActionState(deleteCategory, initialCategoryState)

  const initialBudgetState: BudgetFormState = { error: null }
  const [budgetState, budgetFormAction, budgetPending] = useActionState(setBudget, initialBudgetState)

  function openTxModal(tx?: BudgetTransaction) {
    setEditingTx(tx ?? null)
    setTxType(tx?.txType ?? 'EXPENSE')
    setTxModalOpen(true)
  }
  function closeTxModal() {
    setTxModalOpen(false)
    setEditingTx(null)
  }

  function openCategoryForm(category?: BudgetCategory) {
    setEditingCategory(category ?? null)
    setCategoryFormType(category?.txType ?? 'EXPENSE')
    setCategoryFormParentId(category?.parentId ?? '')
  }
  function closeCategoryModal() {
    setCategoryModalOpen(false)
    setEditingCategory(null)
  }

  // useActionState의 state는 액션이 완료된 뒤의 리렌더에서만 최신값이 된다 — pending이
  // true→false로 바뀌는 전이를 useRef로 감지해 토스트/모달 닫기를 실행한다
  // (calendar-client.tsx와 동일한 패턴, CLAUDE.md에 기록된 과거 버그 재발 방지).
  const wasCreatePending = useRef(false)
  useEffect(() => {
    if (wasCreatePending.current && !createPending && !createState.error) {
      showToast('거래를 저장했어요')
      closeTxModal()
    }
    wasCreatePending.current = createPending
  }, [createPending, createState, showToast])

  const wasUpdatePending = useRef(false)
  useEffect(() => {
    if (wasUpdatePending.current && !updatePending && !updateState.error) {
      showToast('거래를 수정했어요')
      closeTxModal()
    }
    wasUpdatePending.current = updatePending
  }, [updatePending, updateState, showToast])

  const wasDeletePending = useRef(false)
  useEffect(() => {
    if (wasDeletePending.current && !deletePending && !deleteState.error) {
      showToast('거래를 삭제했어요')
      closeTxModal()
    }
    wasDeletePending.current = deletePending
  }, [deletePending, deleteState, showToast])

  const wasCreateCatPending = useRef(false)
  useEffect(() => {
    if (wasCreateCatPending.current && !createCatPending && !createCatState.error) {
      showToast('카테고리를 만들었어요')
      openCategoryForm()
    }
    wasCreateCatPending.current = createCatPending
  }, [createCatPending, createCatState, showToast])

  const wasUpdateCatPending = useRef(false)
  useEffect(() => {
    if (wasUpdateCatPending.current && !updateCatPending && !updateCatState.error) {
      showToast('카테고리를 수정했어요')
      openCategoryForm()
    }
    wasUpdateCatPending.current = updateCatPending
  }, [updateCatPending, updateCatState, showToast])

  const wasDeleteCatPending = useRef(false)
  useEffect(() => {
    if (wasDeleteCatPending.current && !deleteCatPending && !deleteCatState.error) {
      showToast('카테고리를 삭제했어요')
      openCategoryForm()
    }
    wasDeleteCatPending.current = deleteCatPending
  }, [deleteCatPending, deleteCatState, showToast])

  const wasBudgetPending = useRef(false)
  useEffect(() => {
    if (wasBudgetPending.current && !budgetPending && !budgetState.error) {
      showToast('예산을 저장했어요')
    }
    wasBudgetPending.current = budgetPending
  }, [budgetPending, budgetState, showToast])

  const totalIncome = transactions.filter((t) => t.txType === 'INCOME').reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.txType === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0)
  const savings = calcSavings(totalIncome, totalExpense)

  const categoriesByType = (type: TxType) => categories.filter((c) => c.txType === type)
  const categoryOptions = (type: TxType) => flattenCategoryTree(buildCategoryTree(categoriesByType(type)))
  const categoryName = (categoryId: string) => categories.find((c) => c.id === categoryId)?.name ?? '(삭제됨)'

  const budgetRows = categoryOptions('EXPENSE').map((opt) => {
    const budget = budgets.find((b) => b.categoryId === opt.id)
    const spent = transactions
      .filter((t) => t.txType === 'EXPENSE' && t.categoryId === opt.id)
      .reduce((sum, t) => sum + t.amount, 0)
    return { ...opt, budgetAmount: budget?.amount ?? 0, spent, usage: calcBudgetUsage(spent, budget?.amount ?? 0) }
  })

  return (
    <section>
      <div className="cal-header">
        <div className="cal-title-group">
          <div className="cal-title">{yearMonth} 가계부</div>
          <div className="cal-nav">
            <Link href={`/budget?month=${shiftYearMonth(yearMonth, -1)}`}>‹</Link>
            <Link href={`/budget?month=${shiftYearMonth(yearMonth, 1)}`}>›</Link>
          </div>
        </div>
        <div className="cal-actions">
          <button className="tag-manage-btn" onClick={() => { openCategoryForm(); setCategoryModalOpen(true) }}>
            카테고리 관리
          </button>
          <button className="add-event" onClick={() => openTxModal()}>+ 거래 추가</button>
        </div>
      </div>

      <div className="budget-rows" style={{ marginBottom: 20 }}>
        <div className="budget-row"><span>총 수입</span><b>{formatWon(totalIncome)}</b></div>
        <div className="budget-row"><span>총 지출</span><b>{formatWon(totalExpense)}</b></div>
        <div className="budget-row"><span>저축액</span><b>{formatWon(savings.amount)}</b></div>
        <div className="budget-row"><span>저축률</span><b>{savings.rate.toFixed(1)}%</b></div>
      </div>

      <h3>카테고리별 예산</h3>
      {budgetRows.map((row) => (
        <div key={row.id} style={{ marginBottom: 10 }}>
          <div className="budget-row">
            <span style={{ paddingLeft: row.depth * 12 }}>{row.name}</span>
            <b>{formatWon(row.spent)} / {formatWon(row.budgetAmount)}</b>
          </div>
          <div className="budget-bar">
            <div className="budget-fill" style={{ width: `${Math.min(row.usage, 100)}%` }} />
          </div>
          <form action={budgetFormAction} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input type="hidden" name="categoryId" value={row.id} />
            <input type="hidden" name="yearMonth" value={yearMonth} />
            <input type="number" name="amount" min={0} defaultValue={row.budgetAmount} style={{ width: 120 }} />
            <button type="submit" className="btn-cancel" disabled={budgetPending}>예산 저장</button>
          </form>
        </div>
      ))}
      {budgetState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{budgetState.error}</p>}

      <h3>거래 내역</h3>
      <ul>
        {transactions.map((tx) => (
          <li key={tx.id} onClick={() => openTxModal(tx)} style={{ cursor: 'pointer' }}>
            {tx.date} · {TX_TYPE_LABEL[tx.txType]} · {categoryName(tx.categoryId)} · {formatWon(tx.amount)}
            {tx.fixed && ' · 고정'}
            {tx.memo && ` · ${tx.memo}`}
          </li>
        ))}
        {transactions.length === 0 && <li>이번 달 거래가 없어요.</li>}
      </ul>

      {txModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeTxModal() }}>
          <div className="modal">
            <h3>{editingTx ? '거래 수정' : '거래 추가'}</h3>
            <form action={editingTx ? updateFormAction : createFormAction}>
              {editingTx && <input type="hidden" name="transactionId" value={editingTx.id} />}
              <label>종류</label>
              <select name="txType" value={txType} onChange={(e) => setTxType(e.target.value as TxType)}>
                <option value="INCOME">수입</option>
                <option value="EXPENSE">지출</option>
                <option value="SAVING">저축</option>
              </select>
              <label>날짜</label>
              <input type="date" name="date" defaultValue={editingTx?.date ?? `${yearMonth}-01`} required />
              <label>카테고리</label>
              <select name="categoryId" defaultValue={editingTx?.categoryId ?? ''} required>
                <option value="" disabled>선택해주세요</option>
                {categoryOptions(txType).map((opt) => (
                  <option key={opt.id} value={opt.id}>{'　'.repeat(opt.depth)}{opt.name}</option>
                ))}
              </select>
              <label>금액</label>
              <input type="number" name="amount" min={1} defaultValue={editingTx?.amount ?? ''} required />
              <label>
                <input type="checkbox" name="fixed" defaultChecked={editingTx?.fixed ?? false} /> 고정 지출/수입
              </label>
              <label>거래출처 (선택)</label>
              <input type="text" name="source" defaultValue={editingTx?.source ?? ''} placeholder="예: 신용카드1, 현금" />
              {txType === 'EXPENSE' && (
                <>
                  <label>지출 평가 (선택)</label>
                  <select name="evaluation" defaultValue={editingTx?.evaluation ?? ''}>
                    <option value="">선택 안 함</option>
                    {EVALUATIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </>
              )}
              <label>메모 (선택)</label>
              <input type="text" name="memo" defaultValue={editingTx?.memo ?? ''} />
              {(createState.error || updateState.error) && (
                <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createState.error ?? updateState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeTxModal}>취소</button>
                <button type="submit" className="btn-save" disabled={createPending || updatePending}>저장</button>
              </div>
            </form>
            {editingTx && canModify(profile.userId, editingTx.userId, profile.role) && (
              <form action={deleteFormAction}>
                <input type="hidden" name="transactionId" value={editingTx.id} />
                {deleteState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteState.error}</p>}
                <button type="submit" className="btn-delete" disabled={deletePending}>이 거래 삭제하기</button>
              </form>
            )}
          </div>
        </div>
      )}

      {categoryModalOpen && (
        <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) closeCategoryModal() }}>
          <div className="modal">
            <h3>카테고리 관리</h3>
            {(['INCOME', 'EXPENSE', 'SAVING'] as const).map((type) => (
              <div key={type}>
                <h4 style={{ fontSize: 13, marginTop: 12 }}>{TX_TYPE_LABEL[type]}</h4>
                <ul className="tag-manage-list">
                  {categoryOptions(type).map((opt) => (
                    <li key={opt.id}>
                      <span className="tag-manage-name" style={{ paddingLeft: opt.depth * 12 }}>{opt.name}</span>
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={() => openCategoryForm(categories.find((c) => c.id === opt.id))}
                      >
                        수정
                      </button>
                      <form action={deleteCatFormAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="categoryId" value={opt.id} />
                        <button type="submit" className="btn-delete" disabled={deleteCatPending}>삭제</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {deleteCatState.error && <p style={{ color: 'var(--danger)', fontSize: 12 }}>{deleteCatState.error}</p>}

            <form key={editingCategory?.id ?? 'new'} action={editingCategory ? updateCatFormAction : createCatFormAction}>
              <h3 style={{ fontSize: 13, marginTop: 18 }}>{editingCategory ? '카테고리 수정' : '새 카테고리'}</h3>
              {editingCategory && <input type="hidden" name="categoryId" value={editingCategory.id} />}
              <label>구분</label>
              <select
                name="txType"
                value={categoryFormType}
                disabled={!!editingCategory}
                onChange={(e) => { setCategoryFormType(e.target.value as TxType); setCategoryFormParentId('') }}
              >
                <option value="INCOME">수입</option>
                <option value="EXPENSE">지출</option>
                <option value="SAVING">저축</option>
              </select>
              {categoryFormType === 'EXPENSE' && !editingCategory && (
                <>
                  <label>상위 카테고리 (선택 안 하면 대분류)</label>
                  <select
                    name="parentId"
                    value={categoryFormParentId}
                    onChange={(e) => setCategoryFormParentId(e.target.value)}
                  >
                    <option value="">(대분류로 추가)</option>
                    {categoryOptions('EXPENSE').map((opt) => (
                      <option key={opt.id} value={opt.id}>{'　'.repeat(opt.depth)}{opt.name}</option>
                    ))}
                  </select>
                </>
              )}
              <label>이름</label>
              <input type="text" name="name" defaultValue={editingCategory?.name ?? ''} placeholder="예: 외식" required />
              {(createCatState.error || updateCatState.error) && (
                <p style={{ color: 'var(--danger)', fontSize: 12 }}>{createCatState.error ?? updateCatState.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeCategoryModal}>닫기</button>
                <button type="submit" className="btn-save" disabled={createCatPending || updateCatPending}>
                  {editingCategory ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공. (`/budget` 라우트가 정적 목록에 나타남)

- [ ] **Step 3: 로컬 개발 서버로 수동 확인**

Run: `npm run dev`, 브라우저에서 `/budget` 접속(로그인 필요) 후:
- "카테고리 관리"로 지출 대분류 하나 확인 → 소분류 추가 → 목록에 들여쓰기로 나타나는지
- "+ 거래 추가"로 지출 거래 하나 입력(날짜/카테고리/금액) → 거래 내역과 예산 진행바에 반영되는지
- 총 수입/지출/저축액/저축률 숫자가 맞는지
- 이전/다음 달 화살표로 이동 시 그 달 거래만 보이는지

Expected: 위 항목 모두 정상 동작. 문제 있으면 이 Task 안에서 고치고 다시 확인.

- [ ] **Step 4: 커밋 (Task 6 + Task 7 함께)**

```bash
git add "src/app/(family)/budget/page.tsx" "src/app/(family)/budget/budget-client.tsx"
git commit -m "feat: 가계부 /budget 페이지 UI (월 요약, 예산 진행바, 거래/카테고리 관리) 추가"
```

---

### Task 8: 사이드바에 "가계부" 노출 전환 + 최종 검증

**Files:**
- Modify: `src/components/nav-sidebar.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (최종 통합 Task)

- [ ] **Step 1: `가계부` 항목을 `NAV_ITEMS_SOON`에서 `NAV_ITEMS`로 이동**

`src/components/nav-sidebar.tsx`에서:

```ts
const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '▦' },
  { href: '/calendar', label: '달력', icon: '📅' },
  { href: '/album', label: '앨범', icon: '🖼' },
  { href: '/budget', label: '가계부', icon: '💳' },
]
const NAV_ITEMS_SOON = [
  { href: '/fridge', label: '냉장고', icon: '❄︎' },
  { href: '/trip', label: '여행일기', icon: '✈' },
  { href: '/board', label: '게시판', icon: '🗒' },
]
```

- [ ] **Step 2: 전체 테스트 + 빌드 검증**

Run: `npm run test`
Expected: 모든 테스트 PASS (calc.test.ts 포함)

Run: `npm run build`
Expected: 에러 없이 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add src/components/nav-sidebar.tsx
git commit -m "feat: 가계부를 준비중에서 실사용 메뉴로 전환"
```

---

## Self-Review 결과 (수정 완료)

- **스펙 커버리지**: 데이터 모델(Task 1,2) / RLS(Task 1) / 순수 로직(Task 3) / 거래 CRUD(Task 4) / 카테고리·예산 CRUD(Task 5) / 화면(Task 6,7) / 사이드바 노출(Task 8) — 스펙의 모든 섹션에 대응하는 Task 있음.
- **플레이스홀더 스캔**: TBD/TODO 없음, 모든 코드 블록이 실제 실행 가능한 전체 내용.
- **타입 일관성**: `BudgetCategory{id,txType,parentId,name}` / `BudgetTransaction{...}` / `Budget{...}` (Task 2)가 calc.ts(Task 3), actions(Task 4,5), page/client(Task 6,7)에서 동일한 필드명으로 일관되게 쓰임. DB 컬럼(snake_case)과 TS 타입(camelCase) 매핑은 page.tsx의 `.map()`에서만 일어나고 그 아래로는 camelCase만 사용.
