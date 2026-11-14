-- Shared CAF workspace schema. Apply after linking the intended Supabase project.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('admin', 'attendant')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (workspace_id, id)
);

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  nationality text not null check (length(trim(nationality)) > 0),
  phone text not null default '',
  email text not null default '',
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (workspace_id, id)
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  person_id uuid not null,
  process text not null check (length(trim(process)) > 0),
  attended_at date not null default current_date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, person_id)
    references public.persons (workspace_id, id) on delete cascade
);

create table public.nationality_colors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  nationality_key text not null check (length(trim(nationality_key)) > 0),
  nationality_label text not null check (length(trim(nationality_label)) > 0),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, nationality_key)
);

create table public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index workspace_members_user_active_idx
  on public.workspace_members (user_id, workspace_id) where is_active;
create index persons_workspace_name_idx
  on public.persons (workspace_id, full_name);
create index persons_workspace_created_by_idx
  on public.persons (workspace_id, created_by);
create index persons_workspace_phone_idx
  on public.persons (workspace_id, phone);
create index persons_workspace_email_idx
  on public.persons (workspace_id, email);
create index attendances_workspace_person_date_idx
  on public.attendances (workspace_id, person_id, attended_at desc);
create index attendances_workspace_date_idx
  on public.attendances (workspace_id, attended_at);
create index attendances_workspace_created_by_idx
  on public.attendances (workspace_id, created_by);
create index admin_activity_workspace_date_idx
  on public.admin_activity (workspace_id, created_at desc);

-- A fixed ID makes the initial shared workspace easy to provision securely.
insert into public.workspaces (id, name)
values ('11111111-1111-4111-8111-111111111111', 'CAF - Espacio compartido')
on conflict (id) do nothing;

create function public.is_active_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = (select auth.uid())
      and member.is_active
  );
$$;

create function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = (select auth.uid())
      and member.is_active
      and member.role = 'admin'
  );
$$;

create function public.can_modify_record(
  target_workspace_id uuid,
  record_creator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_workspace_member(target_workspace_id)
    and (
      public.is_workspace_admin(target_workspace_id)
      or record_creator_id = (select auth.uid())
    );
$$;

create function public.can_view_profile(target_user_id uuid)
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
        and target_member.is_active
        and current_member.user_id = (select auth.uid())
        and current_member.is_active
    );
$$;

create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Usuario'
    ),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create function public.set_record_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and (
      new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'Profile identity and email are managed by Supabase Auth'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

create trigger persons_set_updated_at
  before update on public.persons
  for each row execute function public.set_record_updated_at();

create trigger attendances_set_updated_at
  before update on public.attendances
  for each row execute function public.set_record_updated_at();

create function public.guard_person_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not public.is_workspace_admin(old.workspace_id)
  then
    if new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
      or new.archived_at is distinct from old.archived_at
    then
      raise exception 'Attendants cannot change person ownership, workspace, or archive state'
        using errcode = '42501';
    end if;
    if new.updated_by is distinct from (select auth.uid()) then
      raise exception 'updated_by must identify the authenticated user'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger persons_guard_update
  before update on public.persons
  for each row execute function public.guard_person_update();

create function public.guard_attendance_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
    and not public.is_workspace_admin(old.workspace_id)
    and (
      new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.person_id is distinct from old.person_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'Attendants cannot change attendance ownership or person'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger attendances_guard_update
  before update on public.attendances
  for each row execute function public.guard_attendance_update();

create function public.protect_last_active_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and (
      new.id is distinct from old.id
      or new.workspace_id is distinct from old.workspace_id
      or new.user_id is distinct from old.user_id
    )
  then
    raise exception 'Membership identity and workspace cannot be changed'
      using errcode = '42501';
  end if;

  if old.role = 'admin' and old.is_active
    and (
      tg_op = 'DELETE'
      or new.role is distinct from 'admin'
      or new.is_active is distinct from true
    )
  then
    perform 1
    from public.workspaces
    where id = old.workspace_id
    for update;

    if (
      select count(*)
      from public.workspace_members as member
      where member.workspace_id = old.workspace_id
        and member.role = 'admin'
        and member.is_active
    ) <= 1
    then
      raise exception 'A workspace must keep at least one active administrator'
        using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workspace_members_protect_last_admin
  before update or delete on public.workspace_members
  for each row execute function public.protect_last_active_admin();

create function public.audit_workspace_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_workspace_id uuid;
  changed_user_id uuid;
  changed_member_id uuid;
  event_action text;
  event_details jsonb;
begin
  if tg_op = 'DELETE' then
    changed_workspace_id := old.workspace_id;
    changed_user_id := old.user_id;
    changed_member_id := old.id;
    event_action := 'member.removed';
    event_details := jsonb_build_object(
      'role', old.role,
      'is_active', old.is_active
    );
  elsif tg_op = 'INSERT' then
    changed_workspace_id := new.workspace_id;
    changed_user_id := new.user_id;
    changed_member_id := new.id;
    event_action := 'member.added';
    event_details := jsonb_build_object(
      'role', new.role,
      'is_active', new.is_active
    );
  else
    if old.role is not distinct from new.role
      and old.is_active is not distinct from new.is_active
    then
      return new;
    end if;
    changed_workspace_id := new.workspace_id;
    changed_user_id := new.user_id;
    changed_member_id := new.id;
    event_action := 'member.updated';
    event_details := jsonb_build_object(
      'old_role', old.role,
      'new_role', new.role,
      'old_is_active', old.is_active,
      'new_is_active', new.is_active
    );
  end if;

  insert into public.admin_activity (
    workspace_id, actor_user_id, action, target_type, target_id, details
  )
  values (
    changed_workspace_id,
    (select auth.uid()),
    event_action,
    'workspace_member',
    changed_member_id,
    event_details || jsonb_build_object('user_id', changed_user_id)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger workspace_members_audit
  after insert or update or delete on public.workspace_members
  for each row execute function public.audit_workspace_member_change();

create function public.audit_person_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
  return new;
end;
$$;

create trigger persons_audit_change
  after update or delete on public.persons
  for each row execute function public.audit_person_change();

create function public.audit_attendance_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_activity (
    workspace_id, actor_user_id, action, target_type, target_id
  )
  values (
    old.workspace_id, (select auth.uid()), 'attendance.deleted', 'attendance', old.id
  );
  return old;
end;
$$;

create trigger attendances_audit_delete
  after delete on public.attendances
  for each row execute function public.audit_attendance_deletion();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.persons enable row level security;
alter table public.attendances enable row level security;
alter table public.nationality_colors enable row level security;
alter table public.admin_activity enable row level security;

create policy profiles_select
  on public.profiles for select to authenticated
  using (public.can_view_profile(id));
create policy profiles_insert_self
  on public.profiles for insert to authenticated
  with check (
    id = (select auth.uid())
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  );
create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy profiles_no_delete
  on public.profiles for delete to authenticated
  using (false);

create policy workspaces_select_member
  on public.workspaces for select to authenticated
  using (public.is_active_workspace_member(id));
create policy workspaces_no_insert
  on public.workspaces for insert to authenticated
  with check (false);
create policy workspaces_no_update
  on public.workspaces for update to authenticated
  using (false) with check (false);
create policy workspaces_no_delete
  on public.workspaces for delete to authenticated
  using (false);

create policy workspace_members_select
  on public.workspace_members for select to authenticated
  using (
    public.is_workspace_admin(workspace_id)
    or (user_id = (select auth.uid()) and is_active)
  );
create policy workspace_members_insert_admin
  on public.workspace_members for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));
create policy workspace_members_update_admin
  on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy workspace_members_delete_admin
  on public.workspace_members for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

create policy persons_select_member
  on public.persons for select to authenticated
  using (public.is_active_workspace_member(workspace_id));
create policy persons_insert_member
  on public.persons for insert to authenticated
  with check (
    public.is_active_workspace_member(workspace_id)
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );
create policy persons_update_creator_or_admin
  on public.persons for update to authenticated
  using (public.can_modify_record(workspace_id, created_by))
  with check (
    public.can_modify_record(workspace_id, created_by)
    and updated_by = (select auth.uid())
  );
create policy persons_delete_admin
  on public.persons for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

create policy attendances_select_member
  on public.attendances for select to authenticated
  using (public.is_active_workspace_member(workspace_id));
create policy attendances_insert_member
  on public.attendances for insert to authenticated
  with check (
    public.is_active_workspace_member(workspace_id)
    and created_by = (select auth.uid())
  );
create policy attendances_update_creator_or_admin
  on public.attendances for update to authenticated
  using (public.can_modify_record(workspace_id, created_by))
  with check (public.can_modify_record(workspace_id, created_by));
create policy attendances_delete_admin
  on public.attendances for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

create policy nationality_colors_select_member
  on public.nationality_colors for select to authenticated
  using (public.is_active_workspace_member(workspace_id));
create policy nationality_colors_insert_admin
  on public.nationality_colors for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));
create policy nationality_colors_update_admin
  on public.nationality_colors for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));
create policy nationality_colors_delete_admin
  on public.nationality_colors for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

create policy admin_activity_select_admin
  on public.admin_activity for select to authenticated
  using (public.is_workspace_admin(workspace_id));
create policy admin_activity_no_insert
  on public.admin_activity for insert to authenticated
  with check (false);
create policy admin_activity_no_update
  on public.admin_activity for update to authenticated
  using (false) with check (false);
create policy admin_activity_no_delete
  on public.admin_activity for delete to authenticated
  using (false);

revoke all on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.persons,
  public.attendances,
  public.nationality_colors,
  public.admin_activity
from anon, public;

grant select, insert, update on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.persons to authenticated;
grant select, insert, update, delete on public.attendances to authenticated;
grant select, insert, update, delete on public.nationality_colors to authenticated;
grant select, insert, update, delete on public.admin_activity to authenticated;

revoke all on function public.is_active_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.can_modify_record(uuid, uuid) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.is_active_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.can_modify_record(uuid, uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.set_record_updated_at() from public, anon, authenticated;
revoke all on function public.guard_profile_update() from public, anon, authenticated;
revoke all on function public.guard_person_update() from public, anon, authenticated;
revoke all on function public.guard_attendance_update() from public, anon, authenticated;
revoke all on function public.protect_last_active_admin() from public, anon, authenticated;
revoke all on function public.audit_workspace_member_change() from public, anon, authenticated;
revoke all on function public.audit_person_change() from public, anon, authenticated;
revoke all on function public.audit_attendance_deletion() from public, anon, authenticated;
