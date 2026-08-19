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
