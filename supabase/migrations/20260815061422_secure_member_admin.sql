alter table public.members
  add column if not exists role text not null default 'member';

update public.members
set role = 'admin', approved = true
where login_id = 'crusade153';

update public.members
set role = 'member'
where login_id <> 'crusade153' and role not in ('admin', 'member');

alter table public.members
  drop constraint if exists members_role_check;

alter table public.members
  add constraint members_role_check check (role in ('admin', 'member'));

create unique index if not exists members_auth_id_unique
  on public.members (auth_id)
  where auth_id is not null;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_nexus_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.members
    where auth_id = (select auth.uid())
      and role = 'admin'
      and approved = true
      and status <> 'pending'
  );
$$;

revoke all on function private.is_nexus_admin() from public, anon;
grant execute on function private.is_nexus_admin() to authenticated;

create or replace function private.is_nexus_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.members
    where auth_id = (select auth.uid())
      and approved = true
      and status <> 'pending'
  );
$$;

revoke all on function private.is_nexus_member() from public, anon;
grant execute on function private.is_nexus_member() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.email like '%@harim-nexus.com' then
    return new;
  end if;

  insert into public.profiles (id, email, status)
  values (new.id, new.email, 'pending')
  on conflict (id) do nothing;

  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.members enable row level security;

drop policy if exists "members_read_self_or_admin" on public.members;
create policy "members_read_self_or_admin"
on public.members for select
to authenticated
using ((select private.is_nexus_member()));

drop policy if exists "members_update_own_presence" on public.members;
create policy "members_update_own_presence"
on public.members for update
to authenticated
using ((select auth.uid()) = auth_id)
with check ((select auth.uid()) = auth_id);

revoke all on table public.members from anon;
revoke insert, delete, truncate, references, trigger on table public.members from authenticated;
revoke update on table public.members from authenticated;
grant select on table public.members to authenticated;
grant update (status, message) on table public.members to authenticated;

alter table public.activities enable row level security;

drop policy if exists "activities_read_members" on public.activities;
create policy "activities_read_members"
on public.activities for select
to authenticated
using (
  (select private.is_nexus_member())
);

drop policy if exists "activities_insert_members" on public.activities;
create policy "activities_insert_members"
on public.activities for insert
to authenticated
with check (
  (select private.is_nexus_member())
);

revoke all on table public.activities from anon;
revoke update, delete, truncate, references, trigger on table public.activities from authenticated;
grant select, insert on table public.activities to authenticated;
