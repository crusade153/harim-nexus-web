// P2(월마감·Chat·캘린더) SQL 점검 — 운영 DB 와 분리된 PGlite 에서 실행한다.
// npm install --prefix <scratch> @electric-sql/pglite@0.3.14
// PGLITE_MODULE=<scratch>/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-p2-db.mjs
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const W = '00000000-0000-4000-8000-000000000001'
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
const rejects = async (sql, pattern) => assert.rejects(db.exec(sql), pattern)
const read = name => readFile(new URL(`../supabase/bootstrap/${name}`, import.meta.url), 'utf8')

await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to authenticated,service_role;
  create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid,name text,bucket_id text,owner uuid);
  create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
`)
await db.exec((await read('01_nexus_schema.sql')).replace(/create extension if not exists pgcrypto[^;]*;/i, ''))
await db.exec(await read('02_p1_phase_a.sql'))
const p2 = await read('03_p2_closing_chat.sql')
await db.exec(p2)
await db.exec(p2)
assert.equal((await scalar(`select array_length(holidays,1) from harim_nexus.workspace_settings where workspace_id='${W}'`)) > 0, true)
console.log('PASS bootstrap + P1 + P2 + P2 재실행')

await db.exec(`
  insert into auth.users(id) values('${uid(11)}'),('${uid(12)}'),('${uid(13)}');
  insert into harim_nexus.members(id,auth_id,login_id,name,role,approved,status) values
    (11,'${uid(11)}','m-a','팀원A','member',true,'active'),
    (12,'${uid(12)}','m-b','팀원B','member',true,'active'),
    (13,'${uid(13)}','m-admin','관리자','admin',true,'active');
  insert into harim_nexus.workspace_members(workspace_id,member_id,role) values('${W}',11,'member'),('${W}',12,'member'),('${W}',13,'owner');
  set role service_role;
  insert into harim_nexus.closing_templates(id,name,created_by_member_id) values(1,'월 결산',13),(2,'중단된 템플릿',13);
  update harim_nexus.closing_templates set active=false where id=2;
  insert into harim_nexus.closing_template_items(id,template_id,title,offset_days,default_assignee_member_id,sort_order) values
    (1,1,'재고 마감',0,11,1),(2,1,'원가 대사',2,12,2);
  insert into harim_nexus.member_calendar_tokens(member_id) values(11);
  reset role;
`)

// 팀원: 읽기만, 쓰기·토큰 조회 불가
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.closing_template_items'), 2)
await rejects(`insert into harim_nexus.closing_templates(name) values('몰래')`, /permission denied/)
await rejects(`update harim_nexus.closing_template_items set title='x'`, /permission denied/)
await rejects('select * from harim_nexus.member_calendar_tokens', /permission denied/)
await rejects(`select harim_nexus.nexus_create_closing_run('${W}',1,'2026-09','2026-10-01',11,'[]'::jsonb)`, /permission denied/)
await db.exec('reset role;')
console.log('PASS 팀원은 템플릿 읽기만, 변경·실행·캘린더 토큰 조회 불가')

// 서버(관리자 검증 후): 실행 생성
await db.exec("select set_config('request.jwt.claim.sub','',false); set role service_role;")
const tasksJson = JSON.stringify([
  { item_id: 1, title: '[2026-09 마감] 재고 마감', content: '', assignee: '팀원A', assignee_member_id: 11, due_date: '2026-10-01' },
  { item_id: 2, title: '[2026-09 마감] 원가 대사', content: '', assignee: '팀원B', assignee_member_id: 12, due_date: '2026-10-06' },
])
const run = (await db.query(`select * from harim_nexus.nexus_create_closing_run('${W}',1,'2026-09','2026-10-01',13,'${tasksJson}'::jsonb)`)).rows[0]
assert.equal(run.period, '2026-09')
const created = (await db.query(`select * from harim_nexus.tasks where closing_run_id=${run.id} order by closing_item_id`)).rows
assert.deepEqual(created.map(t => [t.closing_item_id, t.source, t.source_ref, t.assignee_member_id, t.due_date, String(t.requested_by_member_id)]),
  [[1, 'closing', '2026-09', 11, '2026-10-01', '13'], [2, 'closing', '2026-09', 12, '2026-10-06', '13']])
assert.equal(await scalar(`select count(*)::int from harim_nexus.notifications where kind='assignment'`), 2)
await rejects(`select harim_nexus.nexus_create_closing_run('${W}',1,'2026-09','2026-10-01',13,'${tasksJson}'::jsonb)`, /이미 시작된/)
assert.equal(await scalar(`select count(*)::int from harim_nexus.tasks where closing_run_id=${run.id}`), 2)
await rejects(`select harim_nexus.nexus_create_closing_run('${W}',2,'2026-09','2026-10-01',13,'${tasksJson}'::jsonb)`, /사용 중인/)
await rejects(`select harim_nexus.nexus_create_closing_run('${W}',1,'2026-08','2026-09-01',13,'[]'::jsonb)`, /항목이 없습니다/)
await rejects(`delete from harim_nexus.closing_templates where id=1`, /violates foreign key/)
await db.exec('reset role;')
console.log('PASS 월마감 실행 생성(원자적), 중복·중단 템플릿·빈 항목 거부, 배정 알림, 실행 있는 템플릿 삭제 방지')

// 팀원이 월마감 업무 완료 → AI 검토 대기열(closing_item)
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false);
  update harim_nexus.tasks set status='완료' where closing_item_id=1; reset role;`)
assert.equal(await scalar(`select trigger_type from harim_nexus.ai_reviews where entity_id=${created[0].id} and status='queued'`), 'closing_item')
console.log('PASS 월마감 항목 완료 → AI 검토(closing_item) 대기')

// Chat 알림 집어 오기: 꺼져 있으면 0건, 켠 뒤 생성분만 1회
await db.exec("select set_config('request.jwt.claim.sub','',false); set role service_role;")
assert.equal(await scalar(`select count(*)::int from harim_nexus.nexus_claim_chat_notifications('${W}',array['assignment','system'],20)`), 0)
await db.exec(`update harim_nexus.workspace_settings set chat_enabled=true, chat_enabled_at=now() where workspace_id='${W}';
  insert into harim_nexus.notifications(workspace_id,recipient_member_id,kind,title,created_at) values
    ('${W}',11,'assignment','켜기 전 알림',now()-interval '1 hour'),
    ('${W}',11,'assignment','새 배정',now()+interval '1 second'),
    ('${W}',12,'comment','댓글(즉시 대상 아님)',now()+interval '1 second');`)
const claimed = (await db.query(`select title from harim_nexus.nexus_claim_chat_notifications('${W}',array['assignment','mention','system'],20)`)).rows
assert.deepEqual(claimed.map(r => r.title), ['새 배정'])
assert.equal(await scalar(`select count(*)::int from harim_nexus.nexus_claim_chat_notifications('${W}',array['assignment','mention','system'],20)`), 0)
assert.equal(await scalar(`select harim_nexus.nexus_claim_daily_brief('${W}','2026-10-01')`), true)
assert.equal(await scalar(`select harim_nexus.nexus_claim_daily_brief('${W}','2026-10-01')`), false)
assert.equal(await scalar(`select harim_nexus.nexus_claim_daily_brief('${W}','2026-10-02')`), true)
await db.exec('reset role;')
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false);`)
await rejects(`select * from harim_nexus.nexus_claim_chat_notifications('${W}',array['assignment'],20)`, /permission denied/)
await db.exec('reset role;')
console.log('PASS Chat: 꺼짐 0건, 켜기 전 알림·비대상 종류 제외, 한 번만 전송, 아침 브리핑 하루 1회, 팀원 호출 불가')
