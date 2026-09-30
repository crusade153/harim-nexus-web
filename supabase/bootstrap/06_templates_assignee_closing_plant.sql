-- 06: 업무 템플릿 담당자·마감 오프셋 + 월마감 항목 플랜트 구분
-- 01~05 적용 후 SQL Editor 에서 실행. 다시 실행해도 안전하다. public/Auth/Storage 는 변경하지 않는다.
begin;

-- 1. 업무 템플릿: 담당자(여러 명)와 "생성 후 N영업일" 마감
--    담당자가 비어 있으면 기존처럼 수동 생성은 누른 사람, 자동 생성은 템플릿 저장자에게 배정된다.
alter table harim_nexus.task_templates
  add column if not exists assignee_member_ids bigint[] not null default '{}',
  add column if not exists due_offset_days integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'task_templates_due_offset_check') then
    alter table harim_nexus.task_templates add constraint task_templates_due_offset_check
      check (due_offset_days between 0 and 30);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_templates_assignee_count_check') then
    alter table harim_nexus.task_templates add constraint task_templates_assignee_count_check
      check (cardinality(assignee_member_ids) <= 20);
  end if;
end $$;

-- 2. 월마감 항목: 플랜트 구분 (공통·K1·K2·K3). 기존 항목은 모두 '공통'
alter table harim_nexus.closing_template_items
  add column if not exists plant text not null default '공통';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'closing_template_items_plant_check') then
    alter table harim_nexus.closing_template_items add constraint closing_template_items_plant_check
      check (plant in ('공통', 'K1', 'K2', 'K3'));
  end if;
end $$;

commit;
