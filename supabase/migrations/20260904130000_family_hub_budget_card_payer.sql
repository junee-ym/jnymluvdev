-- supabase/migrations/20260904130000_family_hub_budget_card_payer.sql
-- 가계부 지출자 체크: 거래출처(자유 텍스트)를 카드 목록(소유자 지정 가능)으로 교체

create table public.t_budget_card (
  card_id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.t_user(user_id) on delete set null,
  created timestamptz not null default now()
);

alter table public.t_budget_card enable row level security;

-- t_budget_category와 동일: 소유자 없는 공용 설정값 — 로그인한 가족 구성원 누구나 CRUD
create policy "가족 전체 열람" on public.t_budget_card for select using (auth.uid() is not null);
create policy "가족 전체 생성" on public.t_budget_card for insert with check (auth.uid() is not null);
create policy "가족 전체 수정" on public.t_budget_card for update using (auth.uid() is not null);
create policy "가족 전체 삭제" on public.t_budget_card for delete using (auth.uid() is not null);

alter table public.t_transaction add column card_id uuid references public.t_budget_card(card_id);

-- 기존 자유 텍스트 source 값을 소유자 미지정 카드로 백필
insert into public.t_budget_card (name)
select distinct trim(source) from public.t_transaction where source is not null and trim(source) <> '';

update public.t_transaction t
set card_id = c.card_id
from public.t_budget_card c
where c.name = trim(t.source) and t.source is not null;

alter table public.t_transaction drop column source;
