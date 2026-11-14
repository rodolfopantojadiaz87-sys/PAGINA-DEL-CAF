create function public.count_distinct_attended_people(
  target_workspace_id uuid,
  period_start date,
  period_end date
)
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  distinct_people bigint;
begin
  if period_start > period_end then
    raise exception 'Period start must not be after period end'
      using errcode = '22023';
  end if;

  if not public.is_active_workspace_member(target_workspace_id) then
    raise exception 'Active workspace membership is required'
      using errcode = '42501';
  end if;

  select count(distinct attendance.person_id)
    into distinct_people
  from public.attendances as attendance
  where attendance.workspace_id = target_workspace_id
    and attendance.attended_at between period_start and period_end;

  return distinct_people;
end;
$$;

revoke all on function public.count_distinct_attended_people(uuid, date, date)
  from public, anon;
grant execute on function public.count_distinct_attended_people(uuid, date, date)
  to authenticated;
