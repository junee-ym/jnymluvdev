-- supabase/migrations/20260819130000_family_hub_phase1_fix_privilege_escalation.sql
--
-- 최종 리뷰에서 발견된 권한 상승(privilege escalation) 취약점을 막는다.
--
-- 배경: Supabase는 public 스키마의 모든 테이블에 대해 anon/authenticated 역할에
-- ALL 권한을 기본으로 부여한다 (information_schema.column_privileges로 확인함).
-- 기존 RLS 정책은 "어느 행"을 쓸 수 있는지만 제한할 뿐 "어느 컬럼"을 쓸 수 있는지는
-- 제한하지 않았기 때문에, 로그인한 사용자가 PostgREST로 자기 t_user 행의 role을
-- 'ADMIN'으로 직접 PATCH할 수 있었다. 초대받은 사람도 수락 전에 자기 t_invite 행의
-- role을 올릴 수 있었다.
--
-- 대책은 두 겹이다:
--   1) 컬럼 단위 GRANT로 role/status 컬럼 자체를 쓸 수 없게 만든다.
--   2) t_user 자가 INSERT 정책이 "같은 role의 PENDING 초대가 실제로 존재할 때"만
--      통과하도록 강화한다.

-- ---------------------------------------------------------------------------
-- 1. 컬럼 단위 권한 제한
-- ---------------------------------------------------------------------------

-- t_user: 사용자는 자기 이름/아바타만 바꿀 수 있다. role은 절대 못 바꾼다.
revoke update on public.t_user from authenticated;
revoke update on public.t_user from anon;
grant update (name, avatar) on public.t_user to authenticated;

-- t_invite: 초대받은 사람은 status만 바꿀 수 있다 (가입 확정 시 ACCEPTED).
-- role은 초대를 만든 운영자만 정할 수 있다.
revoke update on public.t_invite from authenticated;
revoke update on public.t_invite from anon;
grant update (status) on public.t_invite to authenticated;

-- t_event / t_photo는 건드리지 않는다: 두 테이블의 모든 컬럼은 작성자가 정당하게
-- 쓸 수 있는 값이고, 행 소유권은 기존 RLS(user_id = auth.uid() 또는 운영자)가
-- 이미 막고 있다. 권한 상승으로 이어지는 컬럼이 없다.

-- ---------------------------------------------------------------------------
-- 2. t_user 자가 INSERT 정책 강화
-- ---------------------------------------------------------------------------

-- security definer 함수로 t_invite의 RLS를 우회해서 조회한다.
-- (기존 public.is_operator_or_admin()과 같은 패턴)
--
-- 왜 security definer가 필요한가:
-- t_invite의 SELECT 정책은 `is_operator_or_admin() or email = auth.jwt() ->> 'email'`
-- 인데, 이 비교는 대소문자를 구분한다. Supabase는 auth.users.email을 소문자로
-- 정규화하므로 대문자가 섞인 이메일로 만든 초대는 정책 자체에 걸려 본인에게도
-- 안 보인다. 정책 표현식 안의 서브쿼리에도 RLS가 그대로 적용되기 때문에,
-- 그대로 두면 정당한 가입까지 막힌다. security definer로 우회하고 함수 안에서
-- lower() 비교를 해 대소문자 문제를 함께 없앤다.
create or replace function public.has_pending_invite(check_email text, check_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.t_invite
    where lower(email) = lower(check_email)
      and status = 'PENDING'
      and role = check_role
  );
$$;

grant execute on function public.has_pending_invite(text, text) to authenticated;

drop policy "본인 초대 수락시 가입" on public.t_user;
create policy "본인 초대 수락시 가입" on public.t_user for insert with check (
  user_id = auth.uid()
  and public.has_pending_invite(auth.jwt() ->> 'email', role)
);

-- ---------------------------------------------------------------------------
-- 3. 중복 PENDING 초대 방지
-- ---------------------------------------------------------------------------

-- 같은 이메일로 PENDING 초대가 둘 이상 생기면 가입 처리 쿼리가 깨진다.
-- 애플리케이션(createInvite)이 이메일을 소문자로 정규화하지만, DB에서도
-- 대소문자 무시로 한 번 더 막는다.
create unique index if not exists t_invite_pending_email_idx
  on public.t_invite (lower(email))
  where status = 'PENDING';

-- ---------------------------------------------------------------------------
-- 4. Storage 업로드 경로 제한
-- ---------------------------------------------------------------------------

-- 기존 정책은 photos 버킷 안이기만 하면 아무 경로에나 올릴 수 있었다.
-- 앱은 항상 `<user_id>/<uuid>-<파일명>`으로 올리므로 첫 폴더가 본인 id와
-- 일치하도록 강제한다 (남의 폴더에 덮어쓰기 시도 차단).
drop policy "가족 로그인 사용자 업로드" on storage.objects;
create policy "가족 로그인 사용자 업로드" on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
