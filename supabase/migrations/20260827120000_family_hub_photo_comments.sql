-- supabase/migrations/20260827120000_family_hub_photo_comments.sql

create table public.t_comment (
  comment_id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.t_photo(photo_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  user_id uuid not null references public.t_user(user_id),
  created timestamptz not null default now(),
  updated timestamptz not null default now()
);

alter table public.t_comment enable row level security;

-- t_photo RLS 정책과 동일한 패턴: 가족 전체 열람, 본인 작성, 본인 또는 운영자/관리자 수정·삭제.
create policy "가족 전체 열람" on public.t_comment for select using (auth.uid() is not null);
create policy "본인 작성" on public.t_comment for insert with check (user_id = auth.uid());
create policy "본인 또는 운영자 수정" on public.t_comment for update
  using (user_id = auth.uid() or public.is_operator_or_admin());
create policy "본인 또는 운영자 삭제" on public.t_comment for delete
  using (user_id = auth.uid() or public.is_operator_or_admin());
