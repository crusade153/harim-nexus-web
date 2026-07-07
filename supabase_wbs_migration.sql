-- WBS 하위 업무(계층 구조) 기능용 마이그레이션
-- ✅ 2026-07-04 Supabase SQL Editor에서 실행 완료됨 (재실행해도 무해 - if not exists)
-- parent_id: 상위 업무의 id. 상위 업무가 삭제되면 하위 업무도 함께 삭제됩니다.

alter table tasks add column if not exists parent_id bigint references tasks(id) on delete cascade;
create index if not exists idx_tasks_parent_id on tasks(parent_id);

-- WBS 운영 고도화: 주요업무, 완료 기준, 산출물, 지연 사유, 선행업무, 표시 순서
alter table tasks add column if not exists is_key_task boolean default false;
alter table tasks add column if not exists acceptance_criteria text;
alter table tasks add column if not exists deliverable_url text;
alter table tasks add column if not exists delay_reason text;
alter table tasks add column if not exists predecessor_id bigint references tasks(id) on delete set null;
alter table tasks add column if not exists wbs_order numeric default 0;

create index if not exists idx_tasks_predecessor_id on tasks(predecessor_id);
create index if not exists idx_tasks_project_wbs_order on tasks(project_id, parent_id, wbs_order);
