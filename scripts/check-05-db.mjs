// 05(내 작업공간 일일 기록 + 비서몬 문구) SQL 점검 — 운영 DB 와 분리된 PGlite 에서 실행한다.
// npm install --prefix <scratch> @electric-sql/pglite@0.3.14
// PGLITE_MODULE=<scratch>/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-05-db.mjs
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
const as = async n => db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid(n)}',false); set role authenticated;`)
const asServer = async () => db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role service_role;`)

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
for (const name of ['02_p1_phase_a.sql', '03_p2_closing_chat.sql', '04_ai_friend_completion_check.sql']) await db.exec(await read(name))
const sql05 = await read('05_desk_daily_logs.sql')
await db.exec(sql05)
await db.exec(sql05)
console.log('PASS bootstrap 01~05 + 05 재실행')

await db.exec(`
  insert into auth.users(id) values('${uid(11)}'),('${uid(12)}'),('${uid(13)}');
  insert into harim_nexus.members(id,auth_id,login_id,name,role,approved,status) values
    (11,'${uid(11)}','m-a','팀원A','member',true,'active'),
    (12,'${uid(12)}','m-b','팀원B','member',true,'active'),
    (13,'${uid(13)}','m-admin','팀장','admin',true,'active');
  insert into harim_nexus.workspace_members(workspace_id,member_id,role) values('${W}',11,'member'),('${W}',12,'member'),('${W}',13,'owner');
  insert into harim_nexus.tasks(id,workspace_id,title,status,assignee,assignee_member_id,created_by_member_id,due_date)
    values(1,'${W}','원가 대사','대기','팀원A',11,13,'2099-12-31');
`)

// 서버(service_role)가 저장·같은 날 덮어쓰기
await asServer()
await db.exec(`insert into harim_nexus.daily_logs(workspace_id,member_id,log_date,content) values('${W}',11,'2026-09-29','SAP 대사'),('${W}',12,'2026-09-29','B 기록')`)
await db.exec(`insert into harim_nexus.daily_logs(workspace_id,member_id,log_date,content) values('${W}',11,'2026-09-29','SAP 대사 완료')
  on conflict(workspace_id,member_id,log_date) do update set content=excluded.content,updated_at=now()`)
assert.equal(await scalar(`select content from harim_nexus.daily_logs where member_id=11`), 'SAP 대사 완료')
await rejects(`insert into harim_nexus.daily_logs(workspace_id,member_id,log_date,content) values('${W}',11,'2026-09-30','')`, /check/)
console.log('PASS 서버 저장·같은 날 1건·빈 기록 거부')

// 본인만 읽기 (팀장도 남의 기록은 못 봄), 브라우저 직접 쓰기 불가
await as(11)
assert.equal(await scalar(`select count(*)::int from harim_nexus.daily_logs`), 1)
await rejects(`insert into harim_nexus.daily_logs(workspace_id,member_id,log_date,content) values('${W}',11,'2026-10-01','x')`, /permission denied/)
await rejects(`update harim_nexus.daily_logs set content='x'`, /permission denied/)
await as(13)
assert.equal(await scalar(`select count(*)::int from harim_nexus.daily_logs`), 0)
await db.exec(`reset role; set role anon;`)
await rejects(`select * from harim_nexus.daily_logs`, /permission denied/)
console.log('PASS 본인만 조회·팀장도 남의 기록 조회 불가·브라우저 쓰기 불가')

// 완료 가드 문구가 비서몬으로 바뀌었고 동작은 그대로
await as(11)
await rejects(`update harim_nexus.tasks set status='완료' where id=1`, /비서몬 완료 점검/)
await db.exec(`update harim_nexus.tasks set status='진행중' where id=1`)
await asServer()
await db.exec(`update harim_nexus.tasks set status='완료' where id=1`)
assert.ok(await scalar(`select completed_at is not null from harim_nexus.tasks where id=1`))
console.log('PASS 완료 가드(비서몬 문구)·서버 완료·completed_at 유지')
