create or replace function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members as target_member
      join public.workspace_members as current_member
        on current_member.workspace_id = target_member.workspace_id
      where target_member.user_id = target_user_id
        and current_member.user_id = (select auth.uid())
        and current_member.is_active
        and (
          current_member.role = 'admin'
          or target_member.is_active
        )
    );
$$;

revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;
