-- Valida en el servidor lo que antes solo validaba el navegador:
-- el proceso debe ser uno de los identificadores actuales y la fecha no puede ser futura.
-- Se usa la fecha de Brasil con un día de margen para no rechazar atenciones del día por zona horaria.
create or replace function public.register_attendance(
  target_workspace_id uuid,
  target_person_id uuid,
  person_full_name text,
  person_nationality text,
  person_phone text,
  person_email text,
  target_process text,
  target_attended_at date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  person_id uuid;
  attendance_id uuid;
  existing_person public.persons%rowtype;
begin
  if not public.is_active_workspace_member(target_workspace_id) then
    raise exception 'Active workspace membership is required'
      using errcode = '42501';
  end if;

  if length(trim(coalesce(target_process, ''))) = 0 then
    raise exception 'Process is required'
      using errcode = '22023';
  end if;
  if length(trim(coalesce(person_full_name, ''))) = 0
    or length(trim(coalesce(person_nationality, ''))) = 0
  then
    raise exception 'Name and nationality are required'
      using errcode = '22023';
  end if;

  if trim(target_process) not in (
    'RESIDENCIA',
    'CAMBIO DE DIRECCION',
    'DESARCHIVAR',
    'CPF',
    'RNM',
    'RENOVACION',
    'ELABORACION DE CURRICULUM'
  ) then
    raise exception 'Unknown process: %', trim(target_process)
      using errcode = '22023';
  end if;
  if target_attended_at > (now() at time zone 'America/Sao_Paulo')::date + 1 then
    raise exception 'Attendance date cannot be in the future'
      using errcode = '22023';
  end if;

  if target_person_id is null then
    insert into public.persons (
      workspace_id,
      full_name,
      nationality,
      phone,
      email,
      created_by,
      updated_by
    )
    values (
      target_workspace_id,
      trim(person_full_name),
      trim(person_nationality),
      trim(coalesce(person_phone, '')),
      trim(coalesce(person_email, '')),
      (select auth.uid()),
      (select auth.uid())
    )
    returning id into person_id;
  else
    select person.*
      into existing_person
    from public.persons as person
    where person.id = target_person_id
      and person.workspace_id = target_workspace_id
      and person.archived_at is null;

    if existing_person.id is null then
      raise exception 'The selected person is unavailable in this workspace'
        using errcode = '22023';
    end if;

    if existing_person.full_name is distinct from trim(person_full_name)
      or existing_person.nationality is distinct from trim(person_nationality)
      or existing_person.phone is distinct from trim(coalesce(person_phone, ''))
      or existing_person.email is distinct from trim(coalesce(person_email, ''))
    then
      if existing_person.created_by <> (select auth.uid())
        and not public.is_workspace_admin(target_workspace_id)
      then
        raise exception 'Only the record creator or a workspace administrator can edit this person'
          using errcode = '42501';
      end if;

      update public.persons
      set full_name = trim(person_full_name),
          nationality = trim(person_nationality),
          phone = trim(coalesce(person_phone, '')),
          email = trim(coalesce(person_email, '')),
          updated_by = (select auth.uid())
      where id = existing_person.id
        and workspace_id = target_workspace_id;
    end if;

    person_id := existing_person.id;
  end if;

  insert into public.attendances (
    workspace_id,
    person_id,
    process,
    attended_at,
    created_by
  )
  values (
    target_workspace_id,
    person_id,
    trim(target_process),
    coalesce(target_attended_at, current_date),
    (select auth.uid())
  )
  returning id into attendance_id;

  return attendance_id;
end;
$$;

revoke all on function public.register_attendance(
  uuid, uuid, text, text, text, text, text, date
) from public, anon;
grant execute on function public.register_attendance(
  uuid, uuid, text, text, text, text, text, date
) to authenticated;
