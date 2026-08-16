-- Cost-safe, RLS-aware read APIs for the global shell and search surface.

create or replace function public.nexus_unread_notification_count()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
  from public.notifications n
  where n.recipient_member_id = (select private.current_nexus_member_id())
    and n.read_at is null;
$$;

revoke all on function public.nexus_unread_notification_count() from public, anon;
grant execute on function public.nexus_unread_notification_count() to authenticated;

create or replace function public.nexus_global_search(
  query_text text,
  per_type_limit integer default 8
)
returns table (
  entity_type text,
  entity_id bigint,
  title text,
  content text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      '%' || replace(replace(trim(query_text), '%', ''), '_', '') || '%' as pattern,
      greatest(1, least(coalesce(per_type_limit, 8), 20)) as row_limit,
      length(trim(coalesce(query_text, ''))) >= 2 as valid
  )
  select result.entity_type, result.entity_id, result.title, result.content, result.metadata, result.created_at
  from (
    (
      select 'task'::text as entity_type, t.id as entity_id, coalesce(t.title, '') as title,
        coalesce(t.content, '') as content,
        jsonb_build_object('status', t.status, 'due_date', t.due_date, 'priority', t.priority) as metadata,
        t.created_at as created_at
      from public.tasks t, params p
      where p.valid and t.deleted_at is null
        and (t.title ilike p.pattern or t.content ilike p.pattern)
      order by t.created_at desc
      limit (select row_limit from params)
    )
    union all
    (
      select 'project'::text, pjt.id, coalesce(pjt.title, ''),
        concat_ws(E'\n', pjt.problem, pjt.direction, pjt.goal),
        jsonb_build_object('period', pjt.period), pjt.created_at
      from public.projects pjt, params p
      where p.valid and pjt.deleted_at is null
        and (pjt.title ilike p.pattern or pjt.problem ilike p.pattern or pjt.direction ilike p.pattern or pjt.goal ilike p.pattern)
      order by pjt.created_at desc
      limit (select row_limit from params)
    )
    union all
    (
      select 'post'::text, p.id, coalesce(p.title, ''), coalesce(p.content, ''),
        jsonb_build_object('tag', p.tag), p.created_at
      from public.posts p, params prm
      where prm.valid and p.deleted_at is null
        and (p.title ilike prm.pattern or p.content ilike prm.pattern)
      order by p.created_at desc
      limit (select row_limit from params)
    )
    union all
    (
      select 'archive'::text, a.id, coalesce(a.title, ''), coalesce(a.content, ''),
        jsonb_build_object('category', a.category), a.created_at
      from public.archives a, params p
      where p.valid and a.deleted_at is null
        and (a.title ilike p.pattern or a.content ilike p.pattern)
      order by a.created_at desc
      limit (select row_limit from params)
    )
  ) result
  order by result.created_at desc nulls last;
$$;

revoke all on function public.nexus_global_search(text, integer) from public, anon;
grant execute on function public.nexus_global_search(text, integer) to authenticated;
