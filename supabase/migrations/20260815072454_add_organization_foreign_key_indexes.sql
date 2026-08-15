create index if not exists idx_org_units_manager_member
  on public.org_units(manager_member_id);

create index if not exists idx_mbo_org_unit
  on public.mbo_objectives(org_unit_id);

create index if not exists idx_assignments_member
  on public.responsibility_assignments(member_id);

create index if not exists idx_attendance_created_by
  on public.attendance_events(created_by);
