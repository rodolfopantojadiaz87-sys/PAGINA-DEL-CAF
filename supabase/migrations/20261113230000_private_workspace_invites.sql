alter table public.workspace_members
  add column is_owner boolean not null default false,
  add column invitation_accepted_at timestamptz;

update public.workspace_members
set invitation_accepted_at = created_at;

with first_admin as (
  select distinct on (workspace_id) id
  from public.workspace_members
  where role = 'admin' and is_active
  order by workspace_id, created_at, id
)
update public.workspace_members as member
set is_owner = true
from first_admin
where member.id = first_admin.id;

create unique index workspace_members_one_owner_idx
  on public.workspace_members (workspace_id)
  where is_owner;

create function public.protect_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null and new.is_owner then
      raise exception 'Only a trusted administrator can designate a workspace owner'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (select auth.uid()) is not null
    and new.is_owner is distinct from old.is_owner
  then
    raise exception 'Workspace ownership cannot be changed by a workspace member'
      using errcode = '42501';
  end if;

  if old.is_owner and (
    tg_op = 'DELETE'
    or new.role is distinct from 'admin'
    or new.is_active is distinct from true
  ) then
    raise exception 'The workspace owner must remain an active administrator'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workspace_members_protect_owner
  before insert or update or delete on public.workspace_members
  for each row execute function public.protect_workspace_owner();

create function public.accept_workspace_invitation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to accept an invitation'
      using errcode = '42501';
  end if;

  update public.workspace_members
  set invitation_accepted_at = now(),
      is_active = true
  where user_id = current_user_id
    and workspace_id = '11111111-1111-4111-8111-111111111111'::uuid
    and invitation_accepted_at is null;

  if not found and not exists (
    select 1
    from public.workspace_members
    where user_id = current_user_id
      and workspace_id = '11111111-1111-4111-8111-111111111111'::uuid
      and is_active
      and invitation_accepted_at is not null
  ) then
    raise exception 'No active workspace invitation was found'
      using errcode = '42501';
  end if;
end;
$$;

drop policy workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_no_delete
  on public.workspace_members for delete to authenticated
  using (false);

revoke insert, delete on public.workspace_members from authenticated;
grant select, update on public.workspace_members to authenticated;

revoke all on function public.protect_workspace_owner() from public, anon, authenticated;
revoke all on function public.accept_workspace_invitation() from public, anon;
grant execute on function public.accept_workspace_invitation() to authenticated;
