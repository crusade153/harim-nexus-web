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
- **팀장 약 6개월 부재 예정** → 부재 중에는 **DeepSeek AI(`DeepSeek-V4-Pro-0813`)가 팀장 대신** 팀원의 업무 기록에 후속 질문하고, 정리한 요약을 팀원에게 확인받는 방식으로 운영 (Phase A, 미구현)
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

### ① P1 + Phase A — 홈 · 주간보고 · AI 팀장 대리 (팀장 부재 전 필수)
- **홈 화면**: 지연/오늘/이번 주 내 업무, 요청받은 일, 알림 피드, 주간보고 상태 카드 (`getWorkHubData()`·`classifyDueDate` 재사용)
- **주간보고 `/weekly`**: 한 주 완료·진행·다음 주 마감·지연 사유로 초안 자동 생성(`buildWeeklyDraft` 순수 함수 + 테스트) → 팀원 다듬고 제출 → 팀장(부재 시 대리 관리자) 취합·인쇄(`ExecutiveReport.jsx` 인쇄 스타일 재사용). 메뉴 `lib/nav.js` 에 추가
- **DB 마이그레이션** (harim_nexus 스키마 기준, 새 파일 `supabase/bootstrap/02_*.sql`):
  `tasks` 에 `completed_at`(완료 전환 트리거), `updated_at`, `requested_by_member_id`, `accepted_at`, `source`, `source_ref`, `closing_run_id` /
  `weekly_reports` / `ai_reviews`(entity, member, trigger, status, round, summary jsonb, risk_level, model, 토큰 수) / `ai_review_messages` /
  `workspace_settings.ai_guidelines`. RLS 는 `harim_nexus_private.has_workspace_access()` 패턴.
  알림 생성(배정·내 업무 댓글·완료)을 DB 트리거로 옮기기
- **AI 대리 (DeepSeek)**: `lib/ai/deepseek.js`(서버 전용, OpenAI 호환 `POST {DEEPSEEK_BASE_URL}/chat/completions`, `fetch`, JSON 출력 강제, 파싱 실패 1회 재시도, 30초 타임아웃), `lib/ai/prompts.js`, `app/api/ai/review/route.js`
  - 흐름: 팀원 기록(업무 완료/지연/주간보고 제출/월마감 항목) → AI 후속 질문 1~3개(최대 2라운드) → 답변 → 요약(한 일/근거·산출물/다음 할 일/리스크) → 팀원 [확인] → 확정 요약만 공식 기록·주간보고 반영. 리스크 높음 → 에스컬레이션 목록
  - AI 는 질문·정리만. 업무 상태·담당·마감은 절대 직접 바꾸지 않음
  - 안전장치: 1인 하루 호출 상한, 월 토큰 예산, API 실패 시에도 기록은 먼저 저장(`failed` 로 남기고 재시도)
  - ⚠️ 모델 ID `DeepSeek-V4-Pro-0813` 이 API 상 정확한 ID인지 `GET /models` 로 먼저 확인 → `DEEPSEEK_MODEL`
  - ⚠️ 업무 내용이 외부 API 로 전송됨 — 회사 보안 정책 확인 필요(팀장에게 안내함). 필요 시 숫자 가림 옵션
  - 관리자 설정에 "AI 운영 지침" 입력칸 (팀장이 부재 전 작성)
- 부재 중 **대리 관리자 1명** 지정 권장 (members.role='admin' 으로 바꾸면 코드 수정 없이 동작)

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
다음 작업은 "4-① P1 + Phase A (홈·주간보고·AI 팀장 대리)" 야.
DB 변경은 supabase/bootstrap/02_*.sql 로 만들고, 적용은 내가 SQL Editor 에서 할게.
```
