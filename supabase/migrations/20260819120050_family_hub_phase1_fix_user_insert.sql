create policy "본인 초대 수락시 가입" on public.t_user for insert with check (user_id = auth.uid());
