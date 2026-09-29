-- ============================================================
-- Harim Nexus 옛 데이터 정리 — 옛 공유 프로젝트(edqfvyylizfpmpnkgozi) 전용
--
-- 새 전용 프로젝트(supabase/bootstrap/)로 전환해 로그인·업무 등록을 확인한 뒤에 실행한다.
-- 새 프로젝트에서는 실행하지 않는다.
--
-- 실행 위치: 옛 공유 프로젝트의 Supabase 대시보드 > SQL Editor
-- 실행 순서: [1] 사전 점검 → 결과 확인 → [2] 백업(CSV 내보내기) → [3] 초기화 → [4] 사후 점검
--
-- ⚠️ 이 프로젝트는 snop-mgt, 경영진 대시보드, 원가 테이블과 공유된다.
--    Nexus 테이블과 '@harim-nexus.com' 로그인 계정만 지운다.
--    Free 플랜이라 PITR 백업이 없으니 [2]를 건너뛰지 말 것.
-- ============================================================


-- ------------------------------------------------------------
-- [1] 사전 점검 (읽기 전용) — 각 쿼리를 따로 실행해 결과를 확인한다
-- ------------------------------------------------------------

-- 1-a) 삭제될 Nexus 행 수
select 'members' as t, count(*) from public.members
union all select 'tasks', count(*) from public.tasks
union all select 'projects', count(*) from public.projects
union all select 'posts', count(*) from public.posts
union all select 'archives', count(*) from public.archives
union all select 'comments', count(*) from public.comments
union all select 'schedules', count(*) from public.schedules
union all select 'activities', count(*) from public.activities
union all select 'notifications', count(*) from public.notifications
union all select 'attendance_events', count(*) from public.attendance_events
union all select 'workspace_files', count(*) from public.workspace_files
union all select 'storage nexus-files', count(*) from storage.objects where bucket_id = 'nexus-files';

-- 1-b) 삭제될 로그인 계정 (Nexus 전용 이메일만)
select id, email, created_at, last_sign_in_at
from auth.users
where email like '%@harim-nexus.com'
order by created_at;

-- 1-c) 지워지면 안 되는 다른 앱 계정 수 (초기화 후 [4]에서 같은 값이어야 한다)
select count(*) as other_app_users
from auth.users
where email not like '%@harim-nexus.com';

-- 1-d) Nexus 계정에 붙어 있는 snop profiles 행
--      (2026-07-24 계정 복구 때 handle_new_user 트리거가 만든 중복 행)
--      snop 에서 실제로 이 행(= @harim-nexus.com 계정)으로 로그인하는 사람이 있으면 초기화를 멈추고 알릴 것
select p.*
from public.profiles p
join auth.users u on u.id = p.id
where u.email like '%@harim-nexus.com';

-- 1-e) auth.users 를 참조하는 외래키 (on delete 동작 확인용)
select c.conrelid::regclass as referencing_table,
       a.attname as column_name,
       case c.confdeltype when 'c' then 'CASCADE' when 'n' then 'SET NULL'
            when 'a' then 'NO ACTION' when 'r' then 'RESTRICT' else c.confdeltype::text end as on_delete
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
order by 1;


-- ------------------------------------------------------------
-- [2] 백업
--   Table Editor 에서 아래 테이블을 각각 'Export to CSV' 로 내려받아
--   로컬 backup/<날짜>/ 폴더에 보관한다 (backup/ 은 .gitignore 대상).
--   members, tasks, projects, posts, archives, comments, schedules, quick_links,
--   activities, attendance_events, org_units, member_role_profiles, mbo_objectives,
--   work_responsibilities, responsibility_assignments, notifications
--   Storage > nexus-files 에 파일이 있으면 필요한 것만 내려받는다.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- [3] 초기화 — 아래 begin ~ commit 을 한 번에 실행
--   TRUNCATE 에 CASCADE 를 쓰지 않는다. 목록에 없는 (다른 앱의) 테이블이
--   이 테이블들을 참조하고 있으면 에러로 멈추게 하기 위해서다.
-- ------------------------------------------------------------
begin;

truncate table
  public.comments,
  public.task_relations,
  public.goal_links,
  public.goals,
  public.webhook_deliveries,
  public.webhook_endpoints,
  public.automation_runs,
  public.automation_rules,
  public.notifications,
  public.notification_preferences,
  public.saved_views,
  public.task_templates,
  public.workspace_files,
  public.audit_events,
  public.attendance_events,
  public.responsibility_assignments,
  public.work_responsibilities,
  public.mbo_objectives,
  public.member_role_profiles,
  public.org_units,
  public.tasks,
  public.projects,
  public.posts,
  public.archives,
  public.schedules,
  public.quick_links,
  public.activities,
  public.workspace_members,
  public.members
restart identity;

-- 업로드 파일 메타데이터 삭제 (실제 파일은 Storage 화면에서 폴더째 삭제)
delete from storage.objects where bucket_id = 'nexus-files';

-- 1-d 에서 확인한 중복 snop profiles 행 정리 (FK 가 CASCADE 라면 아래 auth 삭제로 같이 지워진다)
delete from public.profiles p
using auth.users u
where u.id = p.id and u.email like '%@harim-nexus.com';

-- Nexus 로그인 계정만 삭제
delete from auth.users where email like '%@harim-nexus.com';

-- 워크스페이스 기본 행은 유지 (없으면 다시 만든다)
insert into public.workspaces (id, slug, name, description)
values ('00000000-0000-4000-8000-000000000001', 'harim-foods-cost', 'Harim Foods 원가팀', 'Harim Nexus 기본 워크스페이스')
on conflict (id) do nothing;
insert into public.workspace_settings (workspace_id)
values ('00000000-0000-4000-8000-000000000001')
on conflict (workspace_id) do nothing;

commit;


-- ------------------------------------------------------------
-- [4] 사후 점검
-- ------------------------------------------------------------
select
  (select count(*) from public.members) as members,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from auth.users where email like '%@harim-nexus.com') as nexus_users,
  (select count(*) from auth.users where email not like '%@harim-nexus.com') as other_app_users; -- 1-c 와 같아야 함

-- 다음 단계: scripts/seed-admin.mjs 로 admin 계정 생성
