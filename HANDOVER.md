# Harim Nexus 인수인계 (HANDOVER)

> 다른 세션에서 이어서 작업할 때 이 문서부터 읽는다. 마지막 갱신: 2026-09-29
> ⚠️ 이 저장소는 **공개(Public)** 다. 키·PIN·가입코드·비밀번호를 이 문서나 코드에 절대 적지 않는다.

## 0. 한눈에 보는 현재 상태 (2026-09-29 마감 시점)

| 단계 | 상태 |
|---|---|
| R 리빌드 (harim_nexus 스키마, PIN 가입, 역할 기반 관리자) | ✅ 완료·운영 중 |
| P0 메뉴 정리·딥링크·빠른 추가 | ✅ 완료·운영 중 |
| P1 + A 홈·주간보고·AI 팀장 대리 | ✅ 완료·운영 DB 적용·실제 검증 |
| P2 월마감·Google Chat·캘린더 구독 | ✅ 완료·운영 DB 적용·실제 검증·**배포 확인** |
| AF AI 친구 완료 점검 + 팀장 검토 (AI 팀장 → AI 친구) | ✅ 완료·운영 DB 적용·배포·실제 검증 (2026-09-29) |
| BS 비서몬 이름 변경 + 내 작업공간(일일 기록 → 회의자료) | ✅ 05 SQL 운영 적용(팀장)·배포 (2026-09-29) |
| P3 원가 데이터 연동 | ⏸ 보류 (팀장 결정, 2026-09-29) |

- 운영 주소 `https://team.zettai.co.kr` (Vercel, main 푸시 시 자동 배포 ~1분). DB 는 공유 Supabase 프로젝트 `hvjtsxaztavskhvexnct` 의 `harim_nexus` 스키마. 적용된 SQL: `supabase/bootstrap/01`·`02`·`03`·`04`
- 운영 DB 회원은 `admin` 1명(팀장). 팀장이 직접 만든 테스트 업무 "대시보드점검"과 그 AI 검토 기록이 있음 — 지우지 말 것
- AI 외부 전송은 **켜져 있음**(2026-09-29 확인, 1인 10회/일·팀 100만 토큰/월). 팀장이 켜야 동작하는 것: Google Chat 알림(`/closing` 관리자 설정, 현재 꺼짐), 월마감 템플릿(0개). `/ai` 운영 지침(= AI 친구가 꼭 물어볼 것)은 아직 비어 있음
- 다음 새 SQL 파일 번호는 `06_*.sql` (`05` 까지 운영 적용)

### 남은 작업 한눈에 (2026-09-29)
| 구분 | 할 일 | 누가 |
|---|---|---|
| 운영 적용 | `05_desk_daily_logs.sql` SQL Editor 적용 → 커밋·푸시(배포) → 운영에서 작업공간 기록·비서몬 대화 1회 확인 | 팀장 → 개발 |
| 운영 설정 | `/ai` 운영 설정에 **완료 점검 지침**(AI 친구가 꼭 물어볼 것) 작성 | 팀장 |
| 운영 설정 | 월마감 템플릿 등록·공휴일 확인, Google Chat 알림 켜기(선택) | 팀장 |
| 운영 확인 | 팀원 실제 사용 후 AI 질문 품질·속도(수 초)·일시 실패 빈도 확인 → 지침/프롬프트 조정 | 팀장 → 개발 |
| 정리 | 옛 프로젝트 `edqfvyylizfpmpnkgozi` Nexus 데이터 정리, 미추적 옛 파일 처리 결정 (4-④) | 개발 |
| 보류 | P3 원가 데이터 연동 (팀장이 다시 요청할 때) | — |

---

## 1. 왜 이 작업을 하나

원가팀 워크스페이스(Nexus)를 팀원들이 잘 쓰지 않아 "매일 여는 업무·소통 앱"으로 업그레이드 중이다.

| 안 쓰는 원인 (팀장 확인) | 대응 |
|---|---|
| 메뉴가 많아 헷갈림 (11개, 같은 업무를 5곳에서 보여줌) | P0: 4개 묶음 + 상단 탭 ✅ |
| 이중 입력 (주간보고·월마감을 따로 작성) | P1 주간보고 자동 초안, P2 월마감 자동 생성 |
| 앱을 열 이유가 없음 (알림이 앱 안에만) | P0 딥링크 ✅, P2 Google Chat 알림 |
| 팀장 보고용 도구로 인식 | 팀원에게 돌아오는 이득(보고 자동화) 우선 |

팀 환경: **Google Workspace (Google Chat + Gmail)**. 대체할 루틴: **주간 업무보고, 월마감 반복업무**.

### 사용자(팀장) 결정 사항
- **완전 리빌드**: 기존 회원·업무 데이터는 옮기지 않고 새로 시작
- 기본 관리자 아이디 `admin` (PIN은 팀장만 앎)
- **가입은 간단히**: 아이디 + 이름 + 숫자 6자리 PIN, 승인 없이 바로 사용. 권한은 너무 보수적이지 않게
- **팀장 약 6개월 부재 예정** → 부재 중에는 **DeepSeek AI가 팀장 대신** 팀원의 업무 기록에 후속 질문하고, 정리한 요약을 팀원에게 확인받는 방식으로 운영. Phase A 코드 구현 완료, 운영 SQL 적용·외부 전송 활성화 대기. 실제 API 모델 ID는 `deepseek-v4-pro`.
- Supabase 무료 프로젝트 2개를 이미 써서, **기존 프로젝트 안의 별도 스키마**를 사용

---

## 2. 현재 인프라

| 항목 | 값 |
|---|---|
| Supabase 프로젝트 | `hvjtsxaztavskhvexnct` (공유. `public` 스키마는 기말재고 등 다른 용도 — 건드리지 않음) |
| 넥서스 표 | `harim_nexus` 스키마 (Data API > Exposed schemas 에 추가됨) |
| 권한 확인용 내부 함수 | `harim_nexus_private` 스키마 (**노출하면 안 됨**) |
| 로그인 방식 | 아이디 → `<아이디>@harim-nexus.com` 이메일로 변환해 Supabase Auth 사용, 비밀번호 = 6자리 PIN |
| 기본 워크스페이스 ID | `00000000-0000-4000-8000-000000000001` |
| 배포 | Vercel 가정 (`vercel.json` 크론). 배포처 환경변수 갱신 필요 여부는 팀장 확인 |
| 옛 프로젝트 | `edqfvyylizfpmpnkgozi` (snop 등과 공유). 옛 Nexus 데이터 **아직 정리 안 함** |

### 환경변수 (`.env.local` / 배포처) — 값은 문서에 적지 않는다
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_NEXUS_DB_SCHEMA=harim_nexus`, `DEEPSEEK_API_KEY`, `NEXUS_SIGNUP_CODE`(설정됨), `CRON_SECRET`(선택).
목록과 설명은 `.env.example`.
⚠️ 로컬 `.env.local` 맨 위에 옛 프로젝트 URL·키 두 줄이 중복으로 남아 있었음(뒤쪽 새 값이 적용됨). 팀장에게 삭제 요청해 둠.

### DB 설치 파일
- `supabase/bootstrap/01_nexus_schema.sql` — 스키마 전체 (이미 적용 완료). 설치 절차: `supabase/bootstrap/README.md`
- `scripts/seed-admin.mjs` — admin 계정 생성·PIN 재설정 (여러 번 실행해도 안전)
  `$env:NEXUS_ADMIN_PASSWORD = '<6자리>'; node --env-file=.env.local scripts/seed-admin.mjs`
- `supabase/reset/nexus_full_reset.sql` — **옛 프로젝트** 정리용 (미실행). 실행 전 `delete from storage.objects ...` 줄 삭제 필요
- `supabase/migrations/*` — 옛 공유 프로젝트용 기록. 새 스키마에는 bootstrap 파일이 기준

---

## 3. 완료된 작업 (2026-09-29, 실제 DB·브라우저로 검증)

### Phase R — 리빌드 기반
- 관리자 판정을 `'crusade153'` 하드코딩 12곳 → `lib/roles.js` `isAdmin()`(members.role) 로 통일. `admin` 계정은 삭제·강등·아이디 변경 불가(`isSystemAdmin`)
- 회원 관리 Edge Function 삭제 → Next 서버 라우트 `app/api/admin/members/route.js` (목록·생성·수정·승인·PIN 재설정·삭제)
- 셀프 가입 `app/api/auth/signup/route.js` + `app/signup/page.js` (가입코드 `NEXUS_SIGNUP_CODE` 설정 시 필수)
- PIN 규칙 통일: `lib/auth-id.js` `isValidPin()` (숫자 6자리) — 로그인·가입·팀원관리·설정 화면
- 스키마 연결: `lib/db-config.js`(`NEXUS_DB_SCHEMA`), `lib/supabase.js`, 서버용 `lib/supabase-admin.js`
- 권한 완화: 퀵링크 팀원 누구나 추가·수정, 본인 프로필 직접 수정
- **기존 버그 수정**: 팀원이 휴지통 이동(soft delete) 시 RLS 거부 → 읽기 정책에서 `deleted_at` 조건 제거, 화면 조회에서 `deleted_at is null` 로 거름(캘린더 조회 2곳 보완)
- 무료 프로젝트 일시정지 방지: `app/api/cron/keepalive` + `vercel.json` 매일 1회

### Phase P0 — 헷갈림 제거
- 사이드바 11개 → **홈 · 업무 · 공지·지식 · 팀** (+관리자: 경영진 보고). 정의: `lib/nav.js`
- 같은 묶음 화면은 상단 탭 `components/SectionTabs.jsx` (기존 주소 그대로 유지)
- 딥링크 `lib/links.js` `entityUrl()`: `/kanban?task=ID`, `/board?post=ID`, `/archive?doc=ID`, `/timeline?project=ID` — 알림·통합검색·대시보드·내 업무에서 해당 항목이 바로 열림
- 빠른 추가 `components/QuickAdd.jsx` (헤더 "+ 업무" / 키보드 N): `제목 @담당자 ~금 !높음`. 파서 `parseQuickTask` (`lib/work-os-utils.mjs`, 테스트 있음)
- 업무 변경 신호 `TASKS_CHANGED_EVENT` → 대시보드·보드·체크리스트·내 업무가 새로고침 없이 갱신
- 헤더 미확인 알림 수 1분마다·창 복귀 시 갱신, 로그인 상태면 랜딩 → 대시보드
- 대시보드 "내 업무" 판정을 이름 → 회원 ID 기준으로

### 검증 방법 (재사용)
- 단위 테스트: `npm test` (5개 통과)
- SQL 검증: 스크래치 폴더에 `@electric-sql/pglite` 설치 → `auth`/`storage` 스텁 스키마 만들고 bootstrap SQL 실행 → `set role authenticated` + `request.jwt.claim.sub` 로 RLS 시나리오 확인
- 실제 DB 점검: 임시 계정(`zztest0N`)을 가입 API로 만들고 → 확인 → service_role 스크립트로 계정·업무·활동·감사 기록 삭제. 스크립트는 `scripts/.xxx.tmp.mjs` 로 만들어 실행 후 바로 삭제(커밋 금지)

---

## 4. 다음 할 일 (우선순위 순)

### ① P1 + Phase A — 완료·운영 DB 적용·실제 검증 끝 (2026-09-29)
- **적용 안내:** `supabase/bootstrap/PHASE_A.md`. **`02_p1_phase_a.sql` 운영 DB 적용 완료(팀장, 2026-09-29).** 새 표 4개·tasks 새 칸 확인함.
- 홈 `/dashboard`: 내 업무 마감 3분류, 요청 확인, 알림 피드, 보고 상태, AI 대기 건수. `getWorkHubData({surface:'home'})` 사용. 기존 대시보드 `/team-dashboard` 보존.
- `/weekly`: `buildWeeklyDraft` 한국시간 주차·완료일 기준 초안, 직접 편집·저장·제출, 관리자 취합·인쇄. 동시 수정 방지. 완료일 미상 기존 업무는 자동 완료 목록에서 제외.
- `/ai`: 기록 저장 시 DB에 검토 대기열 생성 → 팀원이 질문 시작 → 최대 2라운드 → 요약 확인 → 공식 기록. 확인된 높은 리스크만 관리자에게 알림. 원본 수정 시 이전 검토 제외. 월마감 실행 생성은 P2.
- `lib/ai/deepseek.js`: 서버 전용 fetch, JSON+스키마 검증, 파싱 1회 재시도, 요청당 30초 제한. DB 원자적 호출 예약으로 일·월 상한/중복 실행 보호. 답변은 외부 호출 전에 저장.
- 관리자 `/ai` 운영 설정: 운영 지침, 외부 전송 활성화(기본 꺼짐), 숫자 가림(기본 켜짐), 일 호출/월 토큰 예산.
- 모델 `GET /models` 확인: `deepseek-v4-pro`. 로컬 `.env.local` 모델 설정 완료. 가상 문서로 실제 JSON 응답 1회 확인. **실제 업무 데이터는 전송하지 않았다.** 배포 환경변수는 별도 확인.
- 새 표/상태 전이 SQL: `weekly_reports`, `ai_reviews`, `ai_review_messages`, `ai_call_usage`; 업무 완료 시각/요청/출처 필드, 알림 트리거. RLS·서버 본인 검증. 공유 `public`/Auth/Storage는 변경하지 않음.
- 검증: 단위 테스트 15개, Next 빌드, 분리된 PGlite로 SQL 재실행·RLS·쿼터·확인·동시성 경계. 브라우저는 실제 앱+가상 응답으로 확인. 운영 Supabase Data API/배포/Functions 지표는 아직 미검증.
- **운영 DB 실제 검증 (2026-09-29, 임시 계정 zztest03~05, 가상 내용만 DeepSeek 전송, 끝나고 전부 삭제):**
  업무 완료 → 완료시각·관리자 알림·AI 대기열 / 외부전송 꺼짐이면 호출 0건(503) / AI 질문 3개 → 일부만 답하면 거부 → 답변 → 요약 → 확인 / 확정 후 재실행 불가 /
  주간보고 초안에 완료 업무+AI 요약 포함 → 제출 → 주간보고 AI 검토 → 관리자 취합에 표시, 팀원은 취합 못 봄 / 홈·주간보고·AI 화면 실제 로그인으로 표시·콘솔 오류 없음.
  호출 1건당 대략 입력 450~600 / 출력 160~210 토큰.
- 검증 중 고친 것: AI 요약에 `record.title=` 같은 필드명이 섞임 → 프롬프트에 자연스러운 문장 지시 추가(`lib/ai/prompts.js`).
  숫자 가림이 날짜까지 가려 "10월 2일"이 "[숫자]월 [숫자]일"로 기록됨 → 날짜·주차·시각은 남기고 금액·수량·비율만 가리도록 `maskNumbers` 수정 + 테스트.
- 팀장 할 일 (남음): Vercel 환경변수(`DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL=deepseek-v4-pro`, `DEEPSEEK_BASE_URL`) → `/ai` 운영 설정에서 지침 작성 → 회사 보안 정책 확인 후 외부 전송 켜기(현재 **꺼짐**) → 대리 관리자 지정.
- 커밋·푸시 완료 (2026-09-29). 배포는 Vercel 자동 배포 여부·환경변수 확인 필요.

### ② P2 — 월마감 + Google Workspace 연동 (완료·운영 적용·실제 검증, 2026-09-29)
- 적용 안내·동작 규칙: `supabase/bootstrap/P2.md`. DB: `03_p2_closing_chat.sql` **운영 적용 완료(팀장, 2026-09-29)**. Vercel 환경변수(GOOGLE_CHAT_WEBHOOK_URL·NEXT_PUBLIC_APP_URL=https://team.zettai.co.kr·CRON_SECRET) 설정 완료
- `/closing` (업무 > 월마감 탭): 진행률·지연·항목 체크·지난달 몇 영업일째 완료 비교. 관리자: 새 월마감 시작(미리보기), 템플릿 관리(D+영업일·기본 담당·참고 링크·자동 시작), 공휴일, Google Chat 설정·연결 테스트·브리핑 지금 보내기
- 서버: `app/api/closing`, `lib/closing-server.js`(실행 생성 RPC 1회로 원자적), `lib/closing-utils.mjs`(영업일 계산, 테스트)
- Google Chat: `lib/google-chat.js`(웹훅은 `chat.googleapis.com` 만 허용), `lib/chat-utils.mjs`(문구), 즉시 전송 `app/api/notify/flush` ← `lib/chat-client.js` `requestChatFlush()` (업무 생성·담당 변경·멘션 저장 후 1.5초 디바운스), 고위험 AI 확인 시 서버에서 전송
- 크론 `app/api/cron/daily` (vercel.json 23:40 UTC = 08:40 KST, 1개로 통합): 일시정지 방지 + 영업일이면 월마감 자동 시작·밀린 알림·아침 브리핑(하루 1회). `CRON_SECRET` 없으면 조회만. 옛 `api/cron/keepalive` 삭제
- 캘린더 구독: `app/api/calendar/token`(발급·재발급), `app/api/calendar/[token]`(ICS, `lib/ics.mjs`), 설정 모달 `components/CalendarSubscription.jsx`
- 헤더 알림 Realtime 구독 (+1분 폴링 유지)
- 환경변수 추가: `GOOGLE_CHAT_WEBHOOK_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`
- 검증: 단위 테스트 20개, `scripts/check-p2-db.mjs`(PGlite) 5개 묶음, 빌드.
- **운영 DB E2E (임시 계정 zztest06~08, 끝나고 삭제, Chat 설정 원복)**: 팀원 조회만·저장 403 / 템플릿 저장·같은 이름 409·영업일 범위 400 / 월마감 시작(업무 2건, D+0·D+2 영업일)·중복 409 / 배정 알림 Chat 1회 전송·재호출 0건 / 체크 → 진행률·AI 대기(closing_item) / 캘린더 발급·ICS(내 미완료만, 배포 주소 링크)·재발급 시 예전 주소 404 / 크론 비밀값 없으면 401, 브리핑 하루 1회 / 관리자 화면 표시.
  실제 Chat 스페이스로 테스트 메시지 4건 전송됨(연결 테스트 1, 배정 1, 브리핑 2 — 아래 캐시 버그로 브리핑 1건 중복).
- **검증 중 고친 버그 (중요)**: Next.js 14 가 서버 fetch(POST 포함)를 캐시해 Supabase 조회·RPC 결과가 재사용됨 → 재발급한 캘린더 옛 주소가 계속 통하고 브리핑 "오늘 이미 보냄"이 무시됨. `lib/supabase-admin.js` 에 `cache: 'no-store'` fetch 지정으로 모든 서버 라우트 해결 (P1 주간보고·AI API 도 같은 클라이언트라 함께 보호). **서버에서 Supabase 클라이언트를 새로 만들 때 반드시 getAdminClient() 를 쓸 것**
- 운영 상태: Chat 알림 **꺼짐**(관리자가 /closing > Google Chat 알림에서 켜야 함), 템플릿 0개, 공휴일 기본 16일
- **배포 확인 (2026-09-29)**: 푸시 후 약 1분에 반영. 운영 `/api/cron/daily` 비밀값 없이 401(= 새 코드 + Vercel `CRON_SECRET` 설정됨), `/closing` 200, 옛 `/api/cron/keepalive` 404. 첫 자동 크론은 2026-09-30 08:40 KST
- 팀장 할 일: 템플릿 등록(자동 시작 여부) → 공휴일 확인 → Chat 알림 켜기(선택: 이메일 멘션 — 실제 멘션 동작 확인 필요)

### ②-b AI 친구 완료 점검 (2026-09-29, 완료·운영 적용·배포·실제 검증)
팀장 결정: "AI 팀장"을 **AI 친구**로 바꾸고, 업무 완료 때 AI 가 "이것은 점검해야 하지 않을까요?" 질문 → 팀원이 답해야 완료 → **팀장이 검토**. (팀장 부재 대리 방식에서 팀장 직접 검토로 전환)
- 흐름: 완료 버튼(보드 드래그·상세 "완료하기"·상태 선택·체크리스트·WBS 체크·월마감 체크·홈 "완료") → `lib/completion-gate.js` → 레이아웃의 `components/CompletionCheck.jsx` 창 → `/api/ai/check` prepare(질문 2~4개) → 답변 제출 시 서버 RPC 가 답변 저장 + 업무 완료(한 트랜잭션) → 팀장 `/ai` "완료 점검 > 검토 대기"에서 **확인 완료** 또는 **보완 요청**(의견 필수, 업무를 진행중으로 되돌리고 팀원에게 알림·Chat)
- AI 외부 전송이 꺼져 있거나 한도 초과·실패면 **기본 점검 질문**(외부 전송 없음, `lib/ai/check-utils.mjs`)으로 대신해 완료가 막히지 않는다. 켜져 있으면 DeepSeek 가 업무 내용 + 운영 지침(= "AI 친구가 꼭 물어볼 것")으로 질문 생성. 같은 업무 버전에서 창을 다시 열면 질문 재사용(호출 절약), 작성 중 답변은 세션에 임시 저장
- DB(`04`): `task_completion_checks`(draft→submitted→approved/returned, 다시 열리면 superseded), RPC `nexus_submit_completion_check`·`nexus_review_completion_check`·`nexus_reserve_member_ai_call`(service_role 전용), `ai_call_usage.check_id`. **브라우저에서 점검 없이 '완료'로 바꾸면 DB 트리거가 거부**(서버·자동화 규칙은 가능). 완료 시 옛 AI 대기열(completed/closing_item)은 더 만들지 않음 — 지연·주간보고 AI 정리는 "보고·지연 정리" 탭에 그대로. 팀장 완료 알림은 `/ai?task=ID` 로 연결
- 일괄 수정으로 '완료' 불가(한 건씩). 주간보고 초안 완료 항목에 점검 답변 요약 포함. 홈 AI 카드: 팀장은 검토 대기 수. 아침 브리핑: "팀장 검토 대기 완료 점검 N건"
- 검증: `npm test` 25개, `scripts/check-04-db.mjs`(PGlite 8묶음: 점검 없이 완료 거부·제출·권한·보완 요청·재오픈·예산), 빌드, 로컬 브라우저(임시 계정 zztest09 + 점검 API 가짜 응답으로 창·취소·답변 복원·제출·팀장 검토 화면, 끝나고 계정 삭제)
- **운영 적용·배포 (2026-09-29)**: 팀장이 04 SQL 적용 → 커밋 `3375718` 푸시 → 약 1분 후 `/api/ai/check` 401(새 코드). 운영 E2E(임시 계정 zztest10·11, 가상 업무만, 끝나고 전부 삭제):
  브라우저 직접 완료 거부 / prepare 기본·AI 질문 3개, 재호출 시 같은 점검 재사용 / 답변 부족 409 / 제출 → 업무 완료·completed_at·팀장 알림(`/ai?task`) / 팀원 검토 시도 403 / 보완 요청 → 진행중·팀원 system 알림(`/ai?check`) / 주간보고 API 200 / AI 사용량 check_id 연결.
  첫 AI 호출 1회는 일시 실패 → 설계대로 기본 질문 대체(완료 안 막힘). 재시도 시 운영 AI 질문 생성 정상(약 7초, 입력 455·출력 121 토큰). 실패 원인은 로그 미확인 — 반복되면 Vercel 함수 로그 확인
- 알아둘 점: AI 질문 생성은 창이 뜬 뒤 수 초 걸린다(대기 문구 표시). 점검 기록을 지우면 연결된 AI 사용량 행도 함께 지워져 월 예산 집계에서 빠진다(테스트 정리 시만 해당)

### ②-c 비서몬 + 내 작업공간 (2026-09-29, 05 SQL 운영 적용·배포)
팀장 결정: 화면에 "DeepSeek" 가 보이지 않게 하고, AI 이름을 **비서몬**으로 통일. 팀원이 들어올 이유가 되도록 **개인 작업공간**을 추가.
- 이름: 화면·알림·오류의 "AI 친구/AI" → "비서몬". 모델명(deepseek-…)·DeepSeek 문구는 화면에서 제거(운영 설정은 "연결 상태"만 표시, `/api/ai/settings` 는 모델명을 내려주지 않음). DB 함수가 올리는 "AI …" 메시지는 `assistantMessage()`(`lib/ai/review-utils.mjs`)로 서버에서 바꿔 보여 줌. 환경변수·파일명(`lib/ai/deepseek.js`, `DEEPSEEK_*`)은 내부용이라 그대로
- 메뉴: 홈 > **내 작업공간**(`/desk`, 새 탭), `/ai` 탭 이름은 **비서몬 점검**. 홈에 작업공간 카드
- `/desk` (`components/DeskPage.jsx`, `app/api/desk/route.js`): 전주·금주 14일 날짜 칩 → 하루 기록 작성(1.2초 자동 저장·Ctrl+S, "이날 완료한 업무 넣기") → 오른쪽 비서몬 대화(회의자료 만들기/전주 실적만/금주 계획만/3줄 요약 버튼 + 자유 입력) → 답변 복사. 대화는 탭 세션에만 보관(sessionStorage, DB 저장 안 함)
- 비서몬에 보내는 자료(`lib/ai/desk-utils.mjs` `deskContext`): 전주~금주 일일 기록, 기간 내 완료 업무(+완료 점검 답변 요약), 진행 업무 40건, 두 주의 주간보고. 숫자 가림이 켜져 있으면 숫자를 `[#1]` 자리표시로 보내고 답에서 되돌림(`createMasker`) — 회의자료에 숫자가 살아 있음. 호출은 완료 점검과 같은 1인 하루 상한·팀 월 예산을 씀(대화 1번 = 1회, 출력 최대 4096 토큰, 100초 제한)
- DB(`05`): `daily_logs`(회원·날짜당 1건, 8000자). **본인만 조회(팀장도 못 봄)**, 쓰기는 서버만. 04 완료 가드 문구를 "비서몬"으로 교체(동작 동일)
- 검증: `npm test` 30개, `scripts/check-05-db.mjs`(PGlite 4묶음: 재실행·저장/덮어쓰기·본인만 조회·완료 가드), 빌드, 로컬 브라우저(임시 계정 zztest12, `/api/desk` 가짜 응답으로 기록·완료 업무 넣기·자동 저장·대화·복사, 점검/홈 화면 DeepSeek·AI 친구 문구 없음, 끝나고 계정 삭제). **실제 비서몬 대화(외부 전송)는 05 적용 후 운영에서 확인 필요**
- 알아둘 점: 1인 하루 호출 상한 기본 10회라 대화가 많으면 금방 찬다 → 사용해 보고 `/ai` 운영 설정에서 조정

### ③ P3 — 원가 데이터 연동 (보류)
일일원가·재료비 차이·S&OP 재고·자재 수급 대시보드의 서버 API 를 캐시해 홈·월마감에 "원가 신호" 표시 → "업무로 만들기"(`source='signal'`, 중복 방지). 수치는 원 시스템 값·기준시각 그대로 인용. **각 대시보드 HTTP 엔드포인트·인증 방식 확인 전에는 착수 보류**

### ④ 정리 작업
- 옛 공유 프로젝트(`edqfvyylizfpmpnkgozi`) Nexus 데이터 정리 — `supabase/reset/nexus_full_reset.sql` (1단계 사전 점검부터, snop 계정 영향 확인)
- 업무 허브(`/work`)의 자동화·웹훅·감사·보안설정 탭 → `/admin/settings`로 이동. 기존 `/work?tab=automation|governance` 주소는 새 위치로 이동. 목록 조회는 기존 관리자 `/work` 12개 → 기본 `/work` 2개, 파일·템플릿 탭은 3개, 목표 탭은 4개, 관리자 설정 각 탭은 2개로 분리(인증·회원 조회 제외). 목표 연결은 조회한 목표 ID로 `IN` 배치 조회. DB 변경 없음.
- 커밋하지 않은 옛 파일(아래 5번) 처리 결정

---

## 5. 주의사항 · 함정

- **공개 저장소**: 커밋 전 비밀값 확인. 아래 추적 안 된 옛 파일들은 임시 비밀번호·실명 데이터가 있어 **일부러 커밋하지 않았다**:
  `migration/`, `supabase_*.sql`(루트), `scripts/repair-member-auth.*`, `scripts/reset-admin-password.ps1`
- **`next build` 를 개발 서버 실행 중에 돌리지 말 것** — `.next` 가 덮여 dev 화면 CSS 가 깨진다. 빌드 전 dev 서버 중지
- **워크스페이스 구성원 행 필수**: `workspace_members` 행이 없으면 RLS 때문에 아무것도 못 본다. 가입·회원생성·seed 스크립트가 자동으로 넣는다. 회원을 SQL 로 직접 넣을 때 주의
- **공유 Auth**: `auth.users` 는 프로젝트 전체 공용. 넥서스 계정은 모두 `@harim-nexus.com`. Authentication 설정(공개 가입 등)은 다른 앱 영향 때문에 바꾸지 않는다 — 넥서스 가입은 service_role 서버 라우트가 처리
- 새 스키마 표를 만들면 `grant` 를 명시하고, 필요하면 Exposed schemas 확인. `harim_nexus_private` 는 절대 노출하지 않는다
- 서버 라우트에서 Supabase 클라이언트는 반드시 `lib/supabase-admin.js` 의 `getAdminClient()` 사용(스키마 지정 포함)
- 브라우저 점검 시 viewport 에뮬레이션을 켜면 클릭 좌표가 어긋난다 → 입력은 `form_input`, 끝나면 desktop 프리셋으로 복구
- 한국어 UI·주석 유지. 날짜는 `YYYY-MM-DD` 문자열로 다룬다(시간대 변환 회피)

---

## 6. 다음 세션 시작용 프롬프트 예시

```
HANDOVER.md 를 읽고 이어서 작업해줘.
HANDOVER.md 를 읽고 이어서 작업해줘. (0장 "남은 작업 한눈에" 참고)
DB 변경은 supabase/bootstrap/05_*.sql 로 만들고, 적용은 내가 SQL Editor 에서 할게.
DB 변경은 supabase/bootstrap/04_*.sql 로 만들고, 적용은 내가 SQL Editor 에서 할게.
```
