# Nexus 설치 — 기존 Supabase 프로젝트 안의 별도 스키마 (2026-09-29 완전 리빌드)

- 대상 프로젝트: `hvjtsxaztavskhvexnct` (무료 프로젝트 2개를 이미 써서 새 프로젝트 대신 사용)
- `public` 스키마(기말재고 등)는 건드리지 않는다. 넥서스 표는 `harim_nexus`, 권한 확인용 내부 함수는 `harim_nexus_private`
- 가입: 아이디 + 이름 + 숫자 6자리 PIN, 승인 없이 바로 사용 (`/api/auth/signup`)
- 로그인 계정(`auth.users`)은 프로젝트 전체가 함께 쓴다. 넥서스 계정은 모두 `@harim-nexus.com` 주소라서 구분된다.
  다른 앱에서 이 주소의 계정을 지우지 않도록 주의

## 1. SQL 실행
SQL Editor → New query → `01_nexus_schema.sql` 전체 붙여 넣기 → Run

## 2. 스키마 노출
Project Settings → Data API → **Exposed schemas** 에 `harim_nexus` 추가 → Save
(`harim_nexus_private` 는 추가하지 않는다)

> 인증(Authentication) 설정은 바꾸지 않는다. 공유 프로젝트라 다른 앱에 영향을 줄 수 있고,
> 넥서스 가입은 서버가 service_role 로 처리하므로 공개 가입 설정과 상관없다.

## 3. 환경변수 (`.env.local`, 배포처 동일)
```
NEXT_PUBLIC_SUPABASE_URL=https://hvjtsxaztavskhvexnct.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon 키>
SUPABASE_SERVICE_ROLE_KEY=<service_role 키>   # 채팅에 붙이지 말 것
NEXT_PUBLIC_NEXUS_DB_SCHEMA=harim_nexus
DEEPSEEK_API_KEY=<DeepSeek 키>
NEXUS_SIGNUP_CODE=                            # 선택: 팀 가입코드
CRON_SECRET=                                  # 선택: 예약 실행 보호
```

## 4. 관리자 계정
```powershell
$env:NEXUS_ADMIN_PASSWORD = '<숫자 6자리>'; node --env-file=.env.local scripts/seed-admin.mjs
```

## 5. 확인
- `admin` 로그인 → 사이드바에 관리자 메뉴가 보이는지
- `/signup` 에서 테스트 계정 가입 → 바로 로그인되고 업무 등록·휴지통 이동이 되는지

## 6. 옛 공유 프로젝트(edqfvyylizfpmpnkgozi) 정리 — 전환 확인 후
`../reset/nexus_full_reset.sql` (1단계 사전 점검부터). `delete from storage.objects` 줄은 실행 전에 지운다.
