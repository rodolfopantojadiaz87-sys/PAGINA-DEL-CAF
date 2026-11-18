create function public.remove_workspace_member(
  target_workspace_id uuid,
  target_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := (select auth.uid());
  member_user_id uuid;
  member_is_owner boolean;
begin
  if requester_id is null
    or not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Se requiere una cuenta administradora activa.'
      using errcode = '42501';
  end if;

  select member.user_id, member.is_owner
  into member_user_id, member_is_owner
  from public.workspace_members as member
  where member.id = target_member_id
    and member.workspace_id = target_workspace_id
  for update;

  if not found then
    raise exception 'No se encontró el colaborador en el espacio.'
      using errcode = 'P0002';
  end if;

  if member_user_id = requester_id then
    raise exception 'No puedes quitar tu propia cuenta del espacio.'
      using errcode = '42501';
  end if;

  if member_is_owner then
    raise exception 'No se puede quitar al propietario del espacio.'
      using errcode = '42501';
  end if;

  delete from public.workspace_members
  where id = target_member_id
    and workspace_id = target_workspace_id;
end;
$$;

revoke all on function public.remove_workspace_member(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid)
  to authenticated;
