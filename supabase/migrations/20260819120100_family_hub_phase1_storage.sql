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
