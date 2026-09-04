-- supabase/migrations/20260904140000_family_hub_budget_card_owner_name.sql
-- 카드 소유자를 가족 구성원(owner_id)뿐 아니라 자유 텍스트(owner_name)로도 지정 가능하게.
-- 예: 가족 계정이 없는 사람 이름을 직접 입력.

alter table public.t_budget_card add column owner_name text;

alter table public.t_budget_card
  add constraint t_budget_card_owner_exclusive check (owner_id is null or owner_name is null);
