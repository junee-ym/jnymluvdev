-- supabase/migrations/20260903120000_family_hub_calendar_tags.sql
-- 달력 태그: 색상 있는 태그를 만들어 일정에 여러 개 달고, 태그별로 필터링한다.

create table public.t_tag (
  tag_id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null check (color in (
    '#0072DE', '#12B76A', '#F79009', '#D92D20', '#7A5AF8',
    '#EE46BC', '#06AED4', '#EAAA08', '#667085'
  )),
  user_id uuid not null references public.t_user(user_id),
  created timestamptz not null default now()
);

create table public.t_event_tag (
  event_id uuid not null references public.t_event(event_id) on delete cascade,
  tag_id uuid not null references public.t_tag(tag_id) on delete cascade,
  primary key (event_id, tag_id)
);

alter table public.t_tag enable row level security;
alter table public.t_event_tag enable row level security;

-- t_tag: 열람은 가족 전체, 생성/수정/삭제는 운영자/관리자만
create policy "가족 전체 열람" on public.t_tag for select using (auth.uid() is not null);
create policy "운영자 태그 생성" on public.t_tag for insert with check (public.is_operator_or_admin());
create policy "운영자 태그 수정" on public.t_tag for update using (public.is_operator_or_admin());
create policy "운영자 태그 삭제" on public.t_tag for delete using (public.is_operator_or_admin());

-- t_event_tag: 열람은 가족 전체, 태그를 달고 떼는 건 그 일정을 수정할 수 있는 사람(본인 소유 또는 운영자/관리자)만
create policy "가족 전체 열람" on public.t_event_tag for select using (auth.uid() is not null);
create policy "일정 수정 권한자만 태그 연결" on public.t_event_tag for insert
  with check (
    exists (
      select 1 from public.t_event
      where event_id = t_event_tag.event_id
        and (user_id = auth.uid() or public.is_operator_or_admin())
    )
  );
create policy "일정 수정 권한자만 태그 해제" on public.t_event_tag for delete
  using (
    exists (
      select 1 from public.t_event
      where event_id = t_event_tag.event_id
        and (user_id = auth.uid() or public.is_operator_or_admin())
    )
  );
