-- Harim Nexus Work OS foundation (P0-P2)
-- P0: workspace isolation, typed comments, soft deletion, auditability and RLS
-- P1: notifications, files, templates, saved views and task relationships
-- P2: goals, automation, webhooks and enterprise workspace settings

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  default_locale text not null default 'ko-KR',
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.workspaces (id, slug, name, description)
values (
  '00000000-0000-4000-8000-000000000001',
  'harim-foods-cost',
  'Harim Foods 원가팀',
  'Harim Nexus 기본 워크스페이스'
)
on conflict (id) do update
set name = excluded.name, description = excluded.description;

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'guest')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, member_id)
);

insert into public.workspace_members (workspace_id, member_id, role)
select
  '00000000-0000-4000-8000-000000000001',
  m.id,
  case when m.role = 'admin' then 'owner' else 'member' end
from public.members m
where m.approved is true
on conflict (workspace_id, member_id) do update
set role = excluded.role, active = true;

create or replace function private.current_nexus_member_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members m
  where m.auth_id = (select auth.uid())
    and m.approved is true
    and m.status <> 'pending'
  limit 1;
$$;

create or replace function private.has_workspace_access(
  target_workspace uuid,
  allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.workspace_members wm
    join public.members m on m.id = wm.member_id
    where wm.workspace_id = target_workspace
      and wm.active is true
      and m.auth_id = (select auth.uid())
      and m.approved is true
      and m.status <> 'pending'
      and (allowed_roles is null or wm.role = any(allowed_roles))
  );
$$;

revoke all on function private.current_nexus_member_id() from public, anon;
revoke all on function private.has_workspace_access(uuid, text[]) from public, anon;
grant execute on function private.current_nexus_member_id() to authenticated;
grant execute on function private.has_workspace_access(uuid, text[]) to authenticated;

-- Add a workspace/security envelope to the existing collaboration records.
alter table public.tasks
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists assignee_member_id bigint references public.members(id) on delete set null,
  add column if not exists created_by_member_id bigint references public.members(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.projects
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists author_member_id bigint references public.members(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.posts
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists author_member_id bigint references public.members(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.archives
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists author_member_id bigint references public.members(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.comments
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists entity_type text,
  add column if not exists entity_id bigint,
  add column if not exists author_member_id bigint references public.members(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.schedules
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists created_by_member_id bigint references public.members(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.quick_links
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.activities
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists actor_member_id bigint references public.members(id) on delete set null;

update public.tasks t
set workspace_id = '00000000-0000-4000-8000-000000000001',
    assignee_member_id = coalesce(t.assignee_member_id, (
      select m.id from public.members m where trim(m.name) = trim(t.assignee) limit 1
    ))
where t.workspace_id is null or t.assignee_member_id is null;

update public.projects p
set workspace_id = '00000000-0000-4000-8000-000000000001',
    author_member_id = coalesce(p.author_member_id, (
      select m.id from public.members m where trim(m.name) = trim(p.author) limit 1
    ))
where p.workspace_id is null or p.author_member_id is null;

update public.posts p
set workspace_id = '00000000-0000-4000-8000-000000000001',
    author_member_id = coalesce(p.author_member_id, (
      select m.id from public.members m where trim(m.name) = trim(p.author_name) limit 1
    ))
where p.workspace_id is null or p.author_member_id is null;

update public.archives a
set workspace_id = '00000000-0000-4000-8000-000000000001',
    author_member_id = coalesce(a.author_member_id, (
      select m.id from public.members m where trim(m.name) = trim(a.author) limit 1
    ))
where a.workspace_id is null or a.author_member_id is null;

-- Existing comments were verified against production: all eight belong to tasks.
update public.comments c
set workspace_id = '00000000-0000-4000-8000-000000000001',
    entity_type = coalesce(c.entity_type, 'task'),
    entity_id = coalesce(c.entity_id, c.post_id),
    author_member_id = coalesce(c.author_member_id, (
      select m.id from public.members m where trim(m.name) = trim(c.author_name) limit 1
    ))
where c.workspace_id is null or c.entity_type is null or c.entity_id is null or c.author_member_id is null;

update public.schedules s
set workspace_id = '00000000-0000-4000-8000-000000000001',
    created_by_member_id = coalesce(s.created_by_member_id, (
      select m.id from public.members m where trim(m.name) = trim(s.target) limit 1
    ))
where s.workspace_id is null or s.created_by_member_id is null;

update public.quick_links set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
update public.activities a
set workspace_id = '00000000-0000-4000-8000-000000000001',
    actor_member_id = coalesce(a.actor_member_id, (
      select m.id from public.members m where trim(m.name) = trim(a.user_name) limit 1
    ))
where a.workspace_id is null or a.actor_member_id is null;

alter table public.tasks alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.projects alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.posts alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.archives alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.comments alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.schedules alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.quick_links alter column workspace_id set default '00000000-0000-4000-8000-000000000001';
alter table public.activities alter column workspace_id set default '00000000-0000-4000-8000-000000000001';

alter table public.tasks alter column workspace_id set not null;
alter table public.projects alter column workspace_id set not null;
alter table public.posts alter column workspace_id set not null;
alter table public.archives alter column workspace_id set not null;
alter table public.comments alter column workspace_id set not null;
alter table public.comments alter column entity_type set not null;
alter table public.comments alter column entity_id set not null;
alter table public.schedules alter column workspace_id set not null;
alter table public.quick_links alter column workspace_id set not null;
alter table public.activities alter column workspace_id set not null;

alter table public.comments drop constraint if exists comments_entity_type_check;
alter table public.comments add constraint comments_entity_type_check
  check (entity_type in ('task', 'post', 'archive', 'project'));

create index if not exists idx_tasks_workspace_due on public.tasks(workspace_id, due_date) where deleted_at is null;
create index if not exists idx_tasks_assignee_status on public.tasks(assignee_member_id, status) where deleted_at is null;
create index if not exists idx_projects_workspace on public.projects(workspace_id) where deleted_at is null;
create index if not exists idx_posts_workspace_created on public.posts(workspace_id, created_at desc) where deleted_at is null;
create index if not exists idx_archives_workspace_created on public.archives(workspace_id, created_at desc) where deleted_at is null;
create index if not exists idx_comments_entity on public.comments(workspace_id, entity_type, entity_id, created_at) where deleted_at is null;
create index if not exists idx_schedules_workspace_date on public.schedules(workspace_id, date) where deleted_at is null;

create table if not exists public.audit_events (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_member_id bigint references public.members(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null check (action in ('create', 'update', 'soft_delete', 'restore', 'delete', 'automation')),
  changed_fields text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_workspace_created on public.audit_events(workspace_id, created_at desc);
create index if not exists idx_audit_entity on public.audit_events(entity_type, entity_id, created_at desc);

create or replace function private.audit_nexus_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_json jsonb;
  old_json jsonb;
  action_name text;
  changed text[];
begin
  row_json := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_json := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;

  if tg_op = 'INSERT' then
    action_name := 'create';
  elsif tg_op = 'DELETE' then
    action_name := 'delete';
  elsif (old_json->>'deleted_at') is null and (row_json->>'deleted_at') is not null then
    action_name := 'soft_delete';
  elsif (old_json->>'deleted_at') is not null and (row_json->>'deleted_at') is null then
    action_name := 'restore';
  else
    action_name := 'update';
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(key order by key), '{}') into changed
    from jsonb_each(row_json) n(key, value)
    where old_json->n.key is distinct from n.value
      and n.key not in ('updated_at');
  else
    changed := '{}';
  end if;

  insert into public.audit_events (
    workspace_id, actor_id, actor_member_id, entity_type, entity_id, action, changed_fields
  ) values (
    (row_json->>'workspace_id')::uuid,
    (select auth.uid()),
    (select private.current_nexus_member_id()),
    tg_table_name,
    row_json->>'id',
    action_name,
    changed
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_nexus_change() from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['tasks', 'projects', 'posts', 'archives', 'comments', 'schedules', 'quick_links'] loop
    execute format('drop trigger if exists audit_nexus_change on public.%I', table_name);
    execute format(
      'create trigger audit_nexus_change after insert or update or delete on public.%I for each row execute function private.audit_nexus_change()',
      table_name
    );
  end loop;
end $$;

-- P1 daily collaboration loop.
create table if not exists public.notifications (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_member_id bigint not null references public.members(id) on delete cascade,
  actor_member_id bigint references public.members(id) on delete set null,
  kind text not null check (kind in ('assignment', 'mention', 'comment', 'due', 'status', 'system', 'automation')),
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_relations (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_task_id bigint not null references public.tasks(id) on delete cascade,
  target_task_id bigint not null references public.tasks(id) on delete cascade,
  relation_type text not null check (relation_type in ('blocks', 'related', 'duplicate')),
  created_by_member_id bigint references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source_task_id, target_task_id, relation_type),
  check (source_task_id <> target_task_id)
);

create table if not exists public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text,
  entity_id text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  version integer not null default 1 check (version > 0),
  uploaded_by_member_id bigint references public.members(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.task_templates (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  default_priority text not null default '보통',
  default_status text not null default '대기',
  content text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  recurrence_rule text,
  created_by_member_id bigint references public.members(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table if not exists public.saved_views (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  name text not null,
  surface text not null,
  filters jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, member_id, surface, name)
);

create table if not exists public.notification_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id bigint not null references public.members(id) on delete cascade,
  in_app boolean not null default true,
  email boolean not null default false,
  mentions boolean not null default true,
  assignments boolean not null default true,
  due_reminders boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, member_id)
);

create index if not exists idx_notifications_member_unread on public.notifications(recipient_member_id, created_at desc) where read_at is null;
create index if not exists idx_task_relations_source on public.task_relations(source_task_id);
create index if not exists idx_task_relations_target on public.task_relations(target_task_id);
create index if not exists idx_workspace_files_entity on public.workspace_files(workspace_id, entity_type, entity_id) where deleted_at is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nexus-files', 'nexus-files', false, 52428800,
  array['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- P2 automation, integrations, portfolio and enterprise controls.
create table if not exists public.goals (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_goal_id bigint references public.goals(id) on delete set null,
  owner_member_id bigint references public.members(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'on_track' check (status in ('on_track', 'at_risk', 'off_track', 'completed', 'paused')),
  progress integer not null default 0 check (progress between 0 and 100),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_links (
  goal_id bigint not null references public.goals(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'task', 'mbo')),
  entity_id text not null,
  weight numeric(5,2) not null default 0 check (weight between 0 and 100),
  primary key (goal_id, entity_type, entity_id)
);

create table if not exists public.automation_rules (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('manual', 'task_created', 'task_status_changed', 'task_due')),
  conditions jsonb not null default '{}'::jsonb,
  action_type text not null check (action_type in ('notify', 'update_task', 'webhook')),
  action_config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_by_member_id bigint references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_id bigint not null references public.automation_rules(id) on delete cascade,
  status text not null check (status in ('running', 'success', 'failed', 'skipped')),
  trigger_payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  endpoint_url text not null,
  event_types text[] not null default '{}',
  enabled boolean not null default true,
  created_by_member_id bigint references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (endpoint_url ~ '^https://')
);

create table if not exists public.webhook_deliveries (
  id bigint generated by default as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  response_status integer,
  error_message text,
  attempted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  require_mfa boolean not null default false,
  allowed_email_domains text[] not null default '{}',
  session_timeout_minutes integer not null default 480 check (session_timeout_minutes between 15 and 43200),
  data_retention_days integer not null default 3650 check (data_retention_days between 30 and 36500),
  audit_retention_days integer not null default 3650 check (audit_retention_days between 90 and 36500),
  updated_by_member_id bigint references public.members(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.workspace_settings (workspace_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (workspace_id) do nothing;

create index if not exists idx_goals_workspace_status on public.goals(workspace_id, status, due_date);
create index if not exists idx_automation_rules_trigger on public.automation_rules(workspace_id, trigger_type) where enabled is true;
create index if not exists idx_automation_runs_rule_started on public.automation_runs(rule_id, started_at desc);
create index if not exists idx_webhook_deliveries_pending on public.webhook_deliveries(status, created_at) where status = 'pending';

-- Workspace-aware RLS for every Harim Nexus table exposed to PostgREST.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.posts enable row level security;
alter table public.archives enable row level security;
alter table public.comments enable row level security;
alter table public.schedules enable row level security;
alter table public.quick_links enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.task_relations enable row level security;
alter table public.workspace_files enable row level security;
alter table public.task_templates enable row level security;
alter table public.saved_views enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.goals enable row level security;
alter table public.goal_links enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_runs enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.workspace_settings enable row level security;

drop policy if exists workspaces_read_members on public.workspaces;
create policy workspaces_read_members on public.workspaces for select to authenticated
using ((select private.has_workspace_access(id, null)));

drop policy if exists workspaces_admin_update on public.workspaces;
create policy workspaces_admin_update on public.workspaces for update to authenticated
using ((select private.has_workspace_access(id, array['owner','admin'])))
with check ((select private.has_workspace_access(id, array['owner','admin'])));

drop policy if exists workspace_members_read on public.workspace_members;
create policy workspace_members_read on public.workspace_members for select to authenticated
using ((select private.has_workspace_access(workspace_id, null)));

drop policy if exists workspace_members_admin_insert on public.workspace_members;
create policy workspace_members_admin_insert on public.workspace_members for insert to authenticated
with check ((select private.has_workspace_access(workspace_id, array['owner','admin'])));

drop policy if exists workspace_members_admin_update on public.workspace_members;
create policy workspace_members_admin_update on public.workspace_members for update to authenticated
using ((select private.has_workspace_access(workspace_id, array['owner','admin'])))
with check ((select private.has_workspace_access(workspace_id, array['owner','admin'])));

drop policy if exists workspace_members_admin_delete on public.workspace_members;
create policy workspace_members_admin_delete on public.workspace_members for delete to authenticated
using ((select private.has_workspace_access(workspace_id, array['owner','admin'])));

do $$
declare table_name text;
begin
  foreach table_name in array array['tasks', 'projects', 'posts', 'archives', 'comments', 'schedules'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_workspace_access(workspace_id, null)) and (deleted_at is null or (select private.has_workspace_access(workspace_id, array[''owner'',''admin'']))))',
      table_name || '_workspace_read', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.has_workspace_access(workspace_id, array[''owner'',''admin'',''member''])))',
      table_name || '_workspace_insert', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.has_workspace_access(workspace_id, array[''owner'',''admin'',''member'']))) with check ((select private.has_workspace_access(workspace_id, array[''owner'',''admin'',''member''])))',
      table_name || '_workspace_update', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.has_workspace_access(workspace_id, array[''owner'',''admin''])))',
      table_name || '_workspace_delete', table_name
    );
  end loop;
end $$;

drop policy if exists quick_links_workspace_read on public.quick_links;
create policy quick_links_workspace_read on public.quick_links for select to authenticated
using ((select private.has_workspace_access(workspace_id, null)) and (deleted_at is null or (select private.has_workspace_access(workspace_id, array['owner','admin']))));
drop policy if exists quick_links_workspace_admin_insert on public.quick_links;
create policy quick_links_workspace_admin_insert on public.quick_links for insert to authenticated
with check ((select private.has_workspace_access(workspace_id, array['owner','admin'])));
drop policy if exists quick_links_workspace_admin_update on public.quick_links;
create policy quick_links_workspace_admin_update on public.quick_links for update to authenticated
using ((select private.has_workspace_access(workspace_id, array['owner','admin'])))
with check ((select private.has_workspace_access(workspace_id, array['owner','admin'])));
drop policy if exists quick_links_workspace_admin_delete on public.quick_links;
create policy quick_links_workspace_admin_delete on public.quick_links for delete to authenticated
using ((select private.has_workspace_access(workspace_id, array['owner','admin'])));

drop policy if exists activities_read_members on public.activities;
create policy activities_read_members on public.activities for select to authenticated
using ((select private.has_workspace_access(workspace_id, null)));
drop policy if exists activities_insert_members on public.activities;
create policy activities_insert_members on public.activities for insert to authenticated
with check ((select private.has_workspace_access(workspace_id, array['owner','admin','member'])));

-- Standard workspace tables: members can read/write collaboration data; admin-only tables are handled below.
do $$
declare table_name text;
begin
  foreach table_name in array array['task_relations', 'workspace_files', 'task_templates', 'saved_views', 'notification_preferences', 'goals'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.has_workspace_access(workspace_id, null)))',
      table_name || '_workspace_read', table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_workspace_write', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.has_workspace_access(workspace_id, array[''owner'',''admin'',''member'']))) with check ((select private.has_workspace_access(workspace_id, array[''owner'',''admin'',''member''])))',
      table_name || '_workspace_write', table_name
    );
  end loop;
end $$;

-- goal_links derives workspace from goals and therefore needs its own policy.
drop policy if exists goal_links_workspace_read on public.goal_links;
drop policy if exists goal_links_workspace_write on public.goal_links;
create policy goal_links_read on public.goal_links for select to authenticated
using (exists (
  select 1 from public.goals g
  where g.id = goal_id and (select private.has_workspace_access(g.workspace_id, null))
));
create policy goal_links_write on public.goal_links for all to authenticated
using (exists (
  select 1 from public.goals g
  where g.id = goal_id and (select private.has_workspace_access(g.workspace_id, array['owner','admin','member']))
))
with check (exists (
  select 1 from public.goals g
  where g.id = goal_id and (select private.has_workspace_access(g.workspace_id, array['owner','admin','member']))
));

drop policy if exists notifications_recipient_read on public.notifications;
create policy notifications_recipient_read on public.notifications for select to authenticated
using (
  recipient_member_id = (select private.current_nexus_member_id())
  or (select private.has_workspace_access(workspace_id, array['owner','admin']))
);
drop policy if exists notifications_member_insert on public.notifications;
create policy notifications_member_insert on public.notifications for insert to authenticated
with check ((select private.has_workspace_access(workspace_id, array['owner','admin','member'])));
drop policy if exists notifications_recipient_update on public.notifications;
create policy notifications_recipient_update on public.notifications for update to authenticated
using (recipient_member_id = (select private.current_nexus_member_id()))
with check (recipient_member_id = (select private.current_nexus_member_id()));

drop policy if exists audit_events_admin_read on public.audit_events;
create policy audit_events_admin_read on public.audit_events for select to authenticated
using ((select private.has_workspace_access(workspace_id, array['owner','admin'])));

do $$
declare table_name text;
begin
  foreach table_name in array array['automation_rules', 'automation_runs', 'webhook_endpoints', 'webhook_deliveries', 'workspace_settings'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.has_workspace_access(workspace_id, array[''owner'',''admin'']))) with check ((select private.has_workspace_access(workspace_id, array[''owner'',''admin''])))',
      table_name || '_admin_all', table_name
    );
  end loop;
end $$;

-- Private bucket: first path segment must be a workspace UUID the user belongs to.
drop policy if exists nexus_files_select on storage.objects;
create policy nexus_files_select on storage.objects for select to authenticated
using (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (select private.has_workspace_access(((storage.foldername(name))[1])::uuid, null))
);
drop policy if exists nexus_files_insert on storage.objects;
create policy nexus_files_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (select private.has_workspace_access(((storage.foldername(name))[1])::uuid, array['owner','admin','member']))
);
drop policy if exists nexus_files_update on storage.objects;
create policy nexus_files_update on storage.objects for update to authenticated
using (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (select private.has_workspace_access(((storage.foldername(name))[1])::uuid, array['owner','admin','member']))
)
with check (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (select private.has_workspace_access(((storage.foldername(name))[1])::uuid, array['owner','admin','member']))
);
drop policy if exists nexus_files_delete on storage.objects;
create policy nexus_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'nexus-files'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and (select private.has_workspace_access(((storage.foldername(name))[1])::uuid, array['owner','admin']))
);

-- Explicit API grants are required for new Supabase projects and future Data API defaults.
revoke all on table public.workspaces, public.workspace_members, public.audit_events,
  public.notifications, public.task_relations, public.workspace_files, public.task_templates,
  public.saved_views, public.notification_preferences, public.goals, public.goal_links,
  public.automation_rules, public.automation_runs, public.webhook_endpoints,
  public.webhook_deliveries, public.workspace_settings from anon;

grant select, insert, update, delete on table public.workspaces, public.workspace_members,
  public.notifications, public.task_relations, public.workspace_files, public.task_templates,
  public.saved_views, public.notification_preferences, public.goals, public.goal_links,
  public.automation_rules, public.automation_runs, public.webhook_endpoints,
  public.webhook_deliveries, public.workspace_settings to authenticated;
grant select on table public.audit_events to authenticated;

grant select, insert, update, delete on table public.tasks, public.projects, public.posts,
  public.archives, public.comments, public.schedules, public.quick_links to authenticated;
revoke all on table public.tasks, public.projects, public.posts, public.archives,
  public.comments, public.schedules, public.quick_links from anon;

grant usage, select on sequence
  public.audit_events_id_seq,
  public.notifications_id_seq,
  public.task_relations_id_seq,
  public.task_templates_id_seq,
  public.saved_views_id_seq,
  public.goals_id_seq,
  public.automation_rules_id_seq,
  public.automation_runs_id_seq,
  public.webhook_deliveries_id_seq
to authenticated;
