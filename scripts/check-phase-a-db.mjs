// npm install --prefix <scratch> @electric-sql/pglite@0.3.14
// PGLITE_MODULE=<scratch>/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-phase-a-db.mjs
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const workspace = '00000000-0000-4000-8000-000000000001'
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
const rejects = async (sql, pattern) => assert.rejects(db.exec(sql), pattern)
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
// PGlite에는 pgcrypto 확장이 없지만 본 스키마의 gen_random_uuid는 PostgreSQL 내장이다.
await db.exec((await readFile(new URL('../supabase/bootstrap/01_nexus_schema.sql', import.meta.url),'utf8')).replace(/create extension if not exists pgcrypto[^;]*;/i, ''))
const migration = await readFile(new URL('../supabase/bootstrap/02_p1_phase_a.sql', import.meta.url),'utf8')
await db.exec(migration)
await db.exec(migration)
console.log('PASS bootstrap + migration + repeat migration')
await db.exec(`
  insert into auth.users(id) values('${uid(11)}'),('${uid(12)}'),('${uid(13)}');
  insert into harim_nexus.members(id,auth_id,login_id,name,role,approved,status) values
    (11,'${uid(11)}','test-a','테스트 A','member',true,'active'),
    (12,'${uid(12)}','test-b','테스트 B','member',true,'active'),
    (13,'${uid(13)}','test-admin','테스트 관리자','admin',true,'active');
  insert into harim_nexus.workspace_members(workspace_id,member_id,role) values('${workspace}',11,'member'),('${workspace}',12,'member'),('${workspace}',13,'member');
  set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false);
  insert into harim_nexus.tasks(id,title,status,assignee_member_id,created_by_member_id,due_date) values(101,'검증 업무','대기',12,11,'2026-09-28');
  reset role;
`)
assert.equal(await scalar("select count(*)::int from harim_nexus.notifications where kind='assignment'"),1)
assert.equal(await scalar('select requested_by_member_id from harim_nexus.tasks where id=101'),11)
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(12)}',false); update harim_nexus.tasks set status='완료' where id=101; reset role;`)
assert.ok(await scalar('select completed_at from harim_nexus.tasks where id=101'))
assert.equal(await scalar("select count(*)::int from harim_nexus.notifications where kind='status'"),2)
const review = (await db.query("select * from harim_nexus.ai_reviews where entity_id=101 and status='queued'")).rows[0]
assert.ok(review)
console.log('PASS assignment/completion triggers, requester, AI queue')
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false); insert into harim_nexus.comments(entity_type,entity_id,author_member_id,content) values('task',101,11,'산출물 확인 요청'); reset role;`)
assert.equal(await scalar("select count(*)::int from harim_nexus.notifications where kind='comment'"),1)
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.ai_reviews'),0)
await rejects(`select harim_nexus.nexus_ai_transition(${review.id},12,'run',null)`,/permission denied/)
await rejects(`insert into harim_nexus.weekly_reports(workspace_id,member_id,week_start) values('${workspace}',11,'2026-09-28')`,/permission denied/)
await db.exec('reset role; set role service_role;')
await rejects(`select harim_nexus.nexus_ai_transition(${review.id},11,'run',null)`,/내 AI/)
let claimed = (await db.query(`select * from harim_nexus.nexus_ai_transition(${review.id},12,'run',null)`)).rows[0]
await rejects(`select harim_nexus.nexus_ai_transition(${review.id},12,'run',null)`,/이미 처리/)
await rejects(`select harim_nexus.nexus_reserve_ai_call(${review.id},'${claimed.lease_id}',4000)`,/활성화/)
await db.exec(`update harim_nexus.workspace_settings set ai_enabled=true,ai_daily_limit=2,ai_monthly_token_budget=10000 where workspace_id='${workspace}';`)
await db.exec(`select harim_nexus.nexus_reserve_ai_call(${review.id},'${claimed.lease_id}',4000);`)
await rejects(`select harim_nexus.nexus_reserve_ai_call(${review.id},'${claimed.lease_id}',7000)`,/월 AI/)
await db.exec(`select harim_nexus.nexus_reserve_ai_call(${review.id},'${claimed.lease_id}',4000);`)
await rejects(`select harim_nexus.nexus_reserve_ai_call(${review.id},'${claimed.lease_id}',1000)`,/오늘의 AI/)
console.log('PASS owner isolation, duplicate claim, disabled AI, monthly and daily limits')
const result = { questions: ['근거는?'], summary:{done:'완료',evidence:'미확인',next:'공유',risks:'지원 필요'},risk_level:'high',model:'test-model' }
await db.exec(`select harim_nexus.nexus_finish_ai_review(${review.id},'${claimed.lease_id}','${JSON.stringify(result)}',null);`)
await rejects(`select harim_nexus.nexus_ai_transition(${review.id},12,'confirm',null)`,/확인 가능한/)
claimed = (await db.query(`select * from harim_nexus.nexus_ai_transition(${review.id},12,'answer','["문서 링크"]')`)).rows[0]
await db.exec(`select harim_nexus.nexus_finish_ai_review(${review.id},'${claimed.lease_id}',null,'provider timeout');`)
assert.equal(await scalar(`select count(*)::int from harim_nexus.ai_review_messages where review_id=${review.id} and role='user'`),1)
claimed = (await db.query(`select * from harim_nexus.nexus_ai_transition(${review.id},12,'run',null)`)).rows[0]
await db.exec(`select harim_nexus.nexus_finish_ai_review(${review.id},'${claimed.lease_id}','${JSON.stringify({...result,questions:[]})}',null); select harim_nexus.nexus_ai_transition(${review.id},12,'confirm',null); reset role;`)
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid(13)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.ai_reviews'),1)
assert.equal(await scalar('select count(*)::int from harim_nexus.ai_review_messages'),0)
await db.exec('reset role;')
await db.exec(`update harim_nexus.tasks set title='수정 기록' where id=101;`)
assert.equal(await scalar(`select status from harim_nexus.ai_reviews where id=${review.id}`),'superseded')
assert.equal(await scalar(`select harim_nexus.nexus_finish_ai_review(${review.id},'${claimed.lease_id}','${JSON.stringify({...result,questions:[]})}',null)`),false)
await db.exec(`update harim_nexus.tasks set status='진행중' where id=101;`)
assert.equal(await scalar('select completed_at from harim_nexus.tasks where id=101'),null)
console.log('PASS answer persistence on failure, confirmation gate, admin visibility, source invalidation, reopen')
await db.exec(`set role service_role;`)
const report = (await db.query(`select * from harim_nexus.nexus_save_weekly('${workspace}',11,'2026-09-28','{"completed":"주간 실적"}',false,null)`)).rows[0]
report.updated_at = await scalar(`select updated_at::text from harim_nexus.weekly_reports where id=${report.id}`)
await rejects(`select harim_nexus.nexus_save_weekly('${workspace}',11,'2026-09-28','{}',true,null)`,/다른 창/)
await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${uid(13)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.weekly_reports'),0)
await db.exec(`reset role; set role service_role; select harim_nexus.nexus_save_weekly('${workspace}',11,'2026-09-28','{"completed":"주간 실적"}',true,'${report.updated_at}'); reset role; set role authenticated; select set_config('request.jwt.claim.sub','${uid(13)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.weekly_reports'),1)
await db.exec(`select set_config('request.jwt.claim.sub','${uid(12)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.weekly_reports'),0)
await db.exec(`reset role; update harim_nexus.workspace_members set active=false where member_id=11; set role authenticated; select set_config('request.jwt.claim.sub','${uid(11)}',false);`)
assert.equal(await scalar('select count(*)::int from harim_nexus.weekly_reports'),0)
await db.exec('reset role; set role anon;')
await rejects('select * from harim_nexus.weekly_reports',/permission denied/)
console.log('PASS report optimistic lock, draft/submitted RLS, revoked membership, anonymous access')
await db.close()
