-- WBS 하위 업무(계층 구조) 기능용 마이그레이션
-- ✅ 2026-07-04 Supabase SQL Editor에서 실행 완료됨 (재실행해도 무해 - if not exists)
-- parent_id: 상위 업무의 id. 상위 업무가 삭제되면 하위 업무도 함께 삭제됩니다.

alter table tasks add column if not exists parent_id bigint references tasks(id) on delete cascade;
create index if not exists idx_tasks_parent_id on tasks(parent_id);
