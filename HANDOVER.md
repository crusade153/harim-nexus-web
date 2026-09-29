# Harim Nexus 인수인계 (HANDOVER)

> 다른 세션에서 이어서 작업할 때 이 문서부터 읽는다. 마지막 갱신: 2026-09-29
> ⚠️ 이 저장소는 **공개(Public)** 다. 키·PIN·가입코드·비밀번호를 이 문서나 코드에 절대 적지 않는다.

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

### ② P2 — 월마감 + Google Workspace 연동
- `/closing`: `task_templates`(checklist·recurrence_rule 이미 있음) 를 마감 템플릿으로, `closing_runs` 로 매월 업무 자동 생성·배정. 영업일 계산 `addBusinessDays` + 테스트
- Google Chat 팀 스페이스 Incoming Webhook(`GOOGLE_CHAT_WEBHOOK_URL`, 서버 env) — 즉시 알림(멘션·배정·보고 제출) + 평일 아침 브리핑 + 금요일 주간보고 리마인드 (Vercel Cron, `CRON_SECRET`). 개인 멘션 형식은 실제 스페이스에서 검증 필요
- 구글 캘린더 구독(ICS): `app/api/calendar/[token]` (개인 토큰)
- 알림 실시간화: `alter publication supabase_realtime add table harim_nexus.notifications` 후 헤더 구독 (지금은 1분 폴링)

### ③ P3 — 원가 데이터 연동 (API 확보 후)
일일원가·재료비 차이·S&OP 재고·자재 수급 대시보드의 서버 API 를 캐시해 홈·월마감에 "원가 신호" 표시 → "업무로 만들기"(`source='signal'`, 중복 방지). 수치는 원 시스템 값·기준시각 그대로 인용. **각 대시보드 HTTP 엔드포인트·인증 방식 확인 전에는 착수 보류**

### ④ 정리 작업
- 옛 공유 프로젝트(`edqfvyylizfpmpnkgozi`) Nexus 데이터 정리 — `supabase/reset/nexus_full_reset.sql` (1단계 사전 점검부터, snop 계정 영향 확인)
- 업무 허브(`/work`)의 자동화·웹훅·감사·보안설정 탭 → 관리자 설정으로 이동
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
다음 작업은 "4-② P2 (월마감 + Google Chat 연동)" 야.
DB 변경은 supabase/bootstrap/02_*.sql 로 만들고, 적용은 내가 SQL Editor 에서 할게.
```
