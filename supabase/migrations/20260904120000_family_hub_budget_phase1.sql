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
