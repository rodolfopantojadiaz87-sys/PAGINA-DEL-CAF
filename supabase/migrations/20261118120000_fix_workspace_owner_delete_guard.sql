create or replace function public.protect_workspace_owner()
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

  if tg_op = 'UPDATE' then
    if (select auth.uid()) is not null
      and new.is_owner is distinct from old.is_owner
    then
      raise exception 'Workspace ownership cannot be changed by a workspace member'
        using errcode = '42501';
    end if;

    if old.is_owner and (
      new.role is distinct from 'admin'
      or new.is_active is distinct from true
    ) then
      raise exception 'The workspace owner must remain an active administrator'
        using errcode = '23514';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_owner then
      raise exception 'The workspace owner must remain an active administrator'
        using errcode = '23514';
    end if;
    return old;
  end if;

  raise exception 'Unsupported workspace member operation: %', tg_op
    using errcode = '22023';
end;
$$;
