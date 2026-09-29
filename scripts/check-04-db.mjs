// 04(AI 친구 완료 점검) SQL 점검 — 운영 DB 와 분리된 PGlite 에서 실행한다.
// npm install --prefix <scratch> @electric-sql/pglite@0.3.14
// PGLITE_MODULE=<scratch>/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-04-db.mjs
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href)
const db = new PGlite()
const W = '00000000-0000-4000-8000-000000000001'
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const scalar = async sql => Object.values((await db.query(sql)).rows[0])[0]
const row = async sql => (await db.query(sql)).rows[0]
const rejects = async (sql, pattern) => assert.rejects(db.exec(sql), pattern)
const read = name => readFile(new URL(`../supabase/bootstrap/${name}`, import.meta.url), 'utf8')
const as = async n => db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid(n)}',false); set role authenticated;`)
const asServer = async () => db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); set role service_role;`)
const draft = async (task, member, questions = ['산출물은 어디에?', '원천과 대사했나요?']) => scalar(`
  insert into harim_nexus.task_completion_checks(workspace_id,task_id,member_id,task_version,task_snapshot,questions,question_source)
  select workspace_id,id,${member},updated_at,jsonb_build_object('title',title),'${JSON.stringify(questions)}'::jsonb,'default' from harim_nexus.tasks where id=${task}
  returning id`)
const submit = (id, member, answers) => `select harim_nexus.nexus_submit_completion_check(${id},${member},'${JSON.stringify(answers)}'::jsonb)`

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
await db.exec(await read('03_p2_closing_chat.sql'))
const sql04 = await read('04_ai_friend_completion_check.sql')
await db.exec(sql04)
await db.exec(sql04)
console.log('PASS bootstrap 01~04 + 04 재실행')

await db.exec(`
  insert into auth.users(id) values('${uid(11)}'),('${uid(12)}'),('${uid(13)}');
  insert into harim_nexus.members(id,auth_id,login_id,name,role,approved,status) values
    (11,'${uid(11)}','m-a','팀원A','member',true,'active'),
    (12,'${uid(12)}','m-b','팀원B','member',true,'active'),
    (13,'${uid(13)}','m-admin','팀장','admin',true,'active');
  insert into harim_nexus.workspace_members(workspace_id,member_id,role) values('${W}',11,'member'),('${W}',12,'member'),('${W}',13,'owner');
  insert into harim_nexus.tasks(id,workspace_id,title,status,assignee,assignee_member_id,created_by_member_id,due_date)
    values(1,'${W}','원가 대사','대기','팀원A',11,13,'2099-12-31'),(2,'${W}','재고 점검','대기','팀원A',11,13,'2099-12-31');
`)

// 브라우저(팀원)는 점검 없이 완료 불가, 다른 상태 변경은 가능
await as(11)
await rejects(`update harim_nexus.tasks set status='완료' where id=1`, /AI 친구 완료 점검/)
await db.exec(`update harim_nexus.tasks set status='진행중' where id=1`)
await rejects(`insert into harim_nexus.tasks(workspace_id,title,status) values('${W}','몰래 완료','완료')`, /AI 친구 완료 점검/)
assert.equal(await scalar('select count(*)::int from harim_nexus.task_completion_checks'), 0)
await rejects(`insert into harim_nexus.task_completion_checks(workspace_id,task_id,member_id,task_version,task_snapshot,questions,question_source) values('${W}',1,11,now(),'{}','["q"]','default')`, /permission denied/)
await rejects(submit(1, 11, ['a']), /permission denied/)
await rejects(`select harim_nexus.nexus_review_completion_check(1,13,'approve',null)`, /permission denied/)
await rejects(`select harim_nexus.nexus_reserve_member_ai_call('${W}',11,100)`, /permission denied/)
console.log('PASS 팀원은 점검 없이 완료 불가(수정·생성 모두), 점검 표 쓰기·RPC 호출 불가, 다른 상태 변경은 가능')

// 서버: 점검 제출 → 업무 완료
await asServer()
const c1 = await draft(1, 11)
await rejects(submit(c1, 11, ['하나만']), /모든 질문/)
await rejects(submit(c1, 11, ['공유폴더', '   ']), /1~3000자/)
await rejects(submit(c1, 12, ['a', 'b']), /내 완료 점검만/)
await db.exec(submit(c1, 11, ['  공유폴더/최종  ', 'SAP 원천과 대사']))
let c = await row(`select * from harim_nexus.task_completion_checks where id=${c1}`)
assert.equal(c.status, 'submitted')
assert.deepEqual(c.answers, ['공유폴더/최종', 'SAP 원천과 대사'])
let t = await row('select status,completed_at from harim_nexus.tasks where id=1')
assert.equal(t.status, '완료'); assert.ok(t.completed_at)
const n = (await db.query(`select recipient_member_id,actor_member_id,title,action_url from harim_nexus.notifications where kind='status' and entity_id='1' order by id`)).rows
assert.deepEqual(n.map(x => [x.recipient_member_id, x.actor_member_id, x.action_url]), [[13, 11, '/ai?task=1']])
assert.match(n[0].title, /완료 점검을 검토해 주세요/)
assert.equal(await scalar(`select count(*)::int from harim_nexus.ai_reviews where trigger_type in ('completed','closing_item')`), 0)
await rejects(submit(c1, 11, ['a', 'b']), /이미 제출/)
const c1b = await draft(1, 12)
await rejects(submit(c1b, 12, ['a', 'b']), /이미 완료된 업무/)
console.log('PASS 제출 시 답변 정리·업무 완료·팀장에게만 검토 알림(/ai?task), 완료 AI 대기열 생성 안 함, 중복 제출·완료된 업무 거부')

// 읽기 권한: 본인·팀장만
await as(11); assert.equal(await scalar('select count(*)::int from harim_nexus.task_completion_checks'), 1)
await as(12); assert.equal(await scalar('select count(*)::int from harim_nexus.task_completion_checks'), 1) // 본인이 만든 draft 1건만
assert.equal(await scalar(`select count(*)::int from harim_nexus.task_completion_checks where id=${c1}`), 0)
await as(13); assert.equal(await scalar('select count(*)::int from harim_nexus.task_completion_checks'), 2)
console.log('PASS 점검 기록은 본인과 팀장(관리자)만 조회')

// 팀장 보완 요청 → 업무 진행중, 팀원에게 알림
await asServer()
await rejects(`select harim_nexus.nexus_review_completion_check(${c1},13,'return','   ')`, /보완할 내용/)
await rejects(`select harim_nexus.nexus_review_completion_check(${c1},13,'delete',null)`, /잘못된 검토/)
await db.exec(`select harim_nexus.nexus_review_completion_check(${c1},13,'return','대사 파일 링크를 붙여 주세요')`)
c = await row(`select * from harim_nexus.task_completion_checks where id=${c1}`)
assert.deepEqual([c.status, c.lead_comment, c.reviewed_by_member_id], ['returned', '대사 파일 링크를 붙여 주세요', 13])
assert.equal(await scalar('select status from harim_nexus.tasks where id=1'), '진행중')
const back = await row(`select * from harim_nexus.notifications where entity_type='completion_check' and entity_id='${c1}'`)
assert.deepEqual([back.recipient_member_id, back.actor_member_id, back.kind, back.action_url], [11, 13, 'system', `/ai?check=${c1}`])
await rejects(`select harim_nexus.nexus_review_completion_check(${c1},13,'approve',null)`, /검토 대기 중인 점검이 아닙니다/)
console.log('PASS 보완 요청은 의견 필수, 업무를 진행중으로 되돌리고 팀원에게 system 알림, 다시 검토 불가')

// 다시 완료 → 팀원이 스스로 다시 열면 검토 대상에서 제외
const c2 = await draft(1, 11)
await db.exec(submit(c2, 11, ['링크 추가', '재대사 완료']))
await as(11); await db.exec(`update harim_nexus.tasks set status='대기' where id=1`)
await asServer()
assert.equal(await scalar(`select status from harim_nexus.task_completion_checks where id=${c2}`), 'superseded')
assert.equal(await scalar(`select status from harim_nexus.task_completion_checks where id=${c1}`), 'returned')
// 확인 완료 후 다시 열어도 확인 기록 유지
const c3 = await draft(2, 11)
await db.exec(submit(c3, 11, ['a', 'b']))
await db.exec(`select harim_nexus.nexus_review_completion_check(${c3},13,'approve',null)`)
assert.equal(await scalar(`select kind from harim_nexus.notifications where entity_type='completion_check' and entity_id='${c3}'`), 'status')
await as(11); await db.exec(`update harim_nexus.tasks set status='진행중' where id=2`)
await asServer()
assert.equal(await scalar(`select status from harim_nexus.task_completion_checks where id=${c3}`), 'approved')
// 삭제(휴지통)하면 작성 중 점검 제외
const c4 = await draft(2, 11)
await as(11); await db.exec(`update harim_nexus.tasks set deleted_at=now() where id=2`)
await asServer()
assert.equal(await scalar(`select status from harim_nexus.task_completion_checks where id=${c4}`), 'superseded')
console.log('PASS 다시 열면 검토 대기 제외·확인 기록은 유지, 휴지통 이동 시 작성 중 점검 제외, 확인은 status 알림')

// AI 호출 예약 (회원 기준 일·월 한도)
await rejects(`select harim_nexus.nexus_reserve_member_ai_call('${W}',11,100)`, /외부 전송을 활성화/)
await db.exec(`update harim_nexus.workspace_settings set ai_enabled=true,ai_daily_limit=1 where workspace_id='${W}'`)
const call = await scalar(`select harim_nexus.nexus_reserve_member_ai_call('${W}',11,100)`)
assert.equal(await scalar(`select review_id is null from harim_nexus.ai_call_usage where id=${call}`), true)
await db.exec(`update harim_nexus.ai_call_usage set check_id=${c2} where id=${call}`)
await rejects(`select harim_nexus.nexus_reserve_member_ai_call('${W}',11,100)`, /호출 상한/)
await db.exec(`update harim_nexus.workspace_settings set ai_daily_limit=10,ai_monthly_token_budget=1000 where workspace_id='${W}'`)
await rejects(`select harim_nexus.nexus_reserve_member_ai_call('${W}',11,5000)`, /토큰 예산/)
console.log('PASS 점검 질문 호출도 외부 전송 설정·일 호출·월 예산 한도 적용')

// 지연 기록 정리는 그대로
await as(11); await db.exec(`update harim_nexus.tasks set delay_reason='자료 대기' where id=1`)
await asServer()
assert.equal(await scalar(`select count(*)::int from harim_nexus.ai_reviews where entity_id=1 and trigger_type='delayed' and status='queued'`), 1)
console.log('PASS 지연 기록 AI 정리는 기존대로 생성')
