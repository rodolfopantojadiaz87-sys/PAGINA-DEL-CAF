create or replace function public.audit_person_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_fields text[];
begin
  if tg_op = 'DELETE' then
    insert into public.admin_activity (
      workspace_id, actor_user_id, action, target_type, target_id
    )
    values (
      old.workspace_id, (select auth.uid()), 'person.deleted', 'person', old.id
    );
    return old;
  end if;

  if old.archived_at is distinct from new.archived_at then
    insert into public.admin_activity (
      workspace_id, actor_user_id, action, target_type, target_id, details
    )
    values (
      new.workspace_id,
      (select auth.uid()),
      case when new.archived_at is null then 'person.unarchived' else 'person.archived' end,
      'person',
      new.id,
      jsonb_build_object('archived_at', new.archived_at)
    );
  end if;

  changed_fields := array_remove(array[
    case when old.full_name is distinct from new.full_name then 'full_name' end,
    case when old.nationality is distinct from new.nationality then 'nationality' end,
    case when old.phone is distinct from new.phone then 'phone' end,
    case when old.email is distinct from new.email then 'email' end
  ], null);

  if cardinality(changed_fields) > 0 then
    insert into public.admin_activity (
      workspace_id, actor_user_id, action, target_type, target_id, details
    )
    values (
      new.workspace_id,
      (select auth.uid()),
      'person.updated',
      'person',
      new.id,
      jsonb_build_object('fields', changed_fields)
    );
  end if;

  return new;
end;
$$;

create function public.audit_attendance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_fields text[];
begin
  if tg_op = 'DELETE' then
    insert into public.admin_activity (
      workspace_id, actor_user_id, action, target_type, target_id
    )
    values (
      old.workspace_id, (select auth.uid()), 'attendance.deleted', 'attendance', old.id
    );
    return old;
  end if;

  changed_fields := array_remove(array[
    case when old.process is distinct from new.process then 'process' end,
    case when old.attended_at is distinct from new.attended_at then 'attended_at' end
  ], null);

  if cardinality(changed_fields) > 0 then
    insert into public.admin_activity (
      workspace_id, actor_user_id, action, target_type, target_id, details
    )
    values (
      new.workspace_id,
      (select auth.uid()),
      'attendance.updated',
      'attendance',
      new.id,
      jsonb_build_object('fields', changed_fields)
    );
  end if;

  return new;
end;
$$;

drop trigger attendances_audit_delete on public.attendances;
create trigger attendances_audit_change
  after update or delete on public.attendances
  for each row execute function public.audit_attendance_change();

revoke all on function public.audit_person_change() from public, anon, authenticated;
revoke all on function public.audit_attendance_change() from public, anon, authenticated;
