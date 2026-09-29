import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, HelpCircle, KanbanSquare, MessageSquareText, NotebookPen, Users } from 'lucide-react'

export const metadata = {
  title: '사용 설명서 | Harim Nexus',
  description: 'Harim Nexus 가입부터 일일 기록, 업무 보드, 캘린더, 주간보고, 이슈 공유까지 따라 하는 공개 사용 설명서',
}

const contents = [
  ['start', '처음 시작'], ['map', '화면 둘러보기'], ['daily', '일일 업무 기록'],
  ['task', '업무 보드 · WBS'], ['calendar', '캘린더'], ['projects', '프로젝트 · 월마감'],
  ['weekly', '주간보고'], ['share', '이슈 · 팀 아카이브'], ['assistant', '비서몬'], ['presence', '접속자 · 검색'], ['faq', '자주 묻는 질문'],
]

function Section({ id, eyebrow, title, children }) {
  return <section id={id} className="scroll-mt-28 rounded-[1.8rem] border border-[#dce9dc] bg-white/90 p-6 shadow-[0_12px_36px_rgba(69,93,71,.05)] sm:p-9">
    <p className="text-xs font-extrabold tracking-[.16em] text-[#478674]">{eyebrow}</p>
    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-[#263a36] sm:text-[1.8rem]">{title}</h2>
    <div className="mt-5 space-y-5 text-sm leading-7 text-[#53645a] sm:text-[15px]">{children}</div>
  </section>
}

function Steps({ items }) {
  return <ol className="space-y-3">{items.map((item, index) => <li key={index} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e2f0e7] text-xs font-extrabold text-[#317362]">{index + 1}</span><span>{item}</span></li>)}</ol>
}

function Note({ children }) {
  return <div className="rounded-2xl border border-[#d4e6d8] bg-[#f3f9f2] px-4 py-3 text-[#355c4d]">{children}</div>
}

function Feature({ icon: Icon, title, href, children }) {
  return <Link href={href} className="group rounded-2xl border border-[#d8e7dc] bg-white/80 p-5 transition hover:-translate-y-0.5 hover:border-[#a6cbb3] hover:shadow-lg">
    <Icon size={22} className="text-[#367766]" /><strong className="mt-3 block text-[#293d36]">{title}</strong><span className="mt-1 block text-xs leading-6 text-[#607268]">{children}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#367766]">열기 <ArrowRight size={13} /></span>
  </Link>
}

export default function GuidePage() {
  return <div className="nexus-landing min-h-screen bg-[#f8f8f0] text-[#263a36]">
    <header className="sticky top-0 z-30 border-b border-[#dbe8df] bg-[#fffdf7]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-extrabold"><span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#377d6e] text-white">N</span>Harim Nexus</Link>
        <div className="flex items-center gap-2 text-xs font-bold sm:text-sm"><Link href="/" className="rounded-full px-3 py-2 hover:bg-[#eaf3e9]">홈</Link><Link href="/login" className="rounded-full bg-[#2f6d60] px-4 py-2 text-white hover:bg-[#24584e]">업무공간</Link></div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-[#e5e7d5] bg-gradient-to-br from-[#e5f0de] via-[#f8f4e8] to-[#f8e5d4] px-7 py-12 sm:px-12 lg:py-16">
        <div className="relative z-10 max-w-[690px]"><p className="inline-flex items-center gap-2 rounded-full border border-[#b7d6c3] bg-white/65 px-3 py-1.5 text-xs font-bold text-[#33705e]"><BookOpen size={14} /> 누구나 볼 수 있는 설명서</p>
          <h1 className="mt-6 text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[1.18] tracking-[-.05em]">Nexus 사용 설명서</h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#526b5d]">처음 로그인하는 방법부터 기록·업무·일정·보고까지. 필요한 항목을 눌러 순서대로 따라 해보세요.</p>
          <div className="mt-7 flex flex-wrap gap-2"><a href="#start" className="rounded-xl bg-[#2f6d60] px-5 py-3 text-sm font-bold text-white">처음부터 보기</a><a href="#faq" className="rounded-xl border border-[#bbd2bf] bg-white/75 px-5 py-3 text-sm font-bold text-[#2f6d60]">문제 해결</a></div>
        </div>
        <img src="/nexus-mascot-guide.webp" alt="책을 펼쳐 안내하는 Nexus 로봇" className="pointer-events-none absolute -bottom-8 -right-14 w-64 opacity-90 sm:-bottom-8 sm:right-1 sm:w-80 lg:bottom-[-12px] lg:right-12 lg:w-[390px]" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[215px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start"><nav aria-label="설명서 목차" className="rounded-2xl border border-[#dce9dc] bg-white/90 p-4 shadow-sm"><p className="mb-2 px-2 text-xs font-extrabold text-[#6b806e]">바로 찾기</p><div className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1">{contents.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-[#4e6659] hover:bg-[#e8f3e9] hover:text-[#2f6d60]">{label}</a>)}</div></nav></aside>
        <div className="space-y-6">
          <Section id="start" eyebrow="01 · 시작" title="가입하고 첫 화면 열기">
            <Steps items={[<>첫 화면의 <strong>팀 합류하기</strong>에서 아이디, 이름, 직위, 숫자 6자리 PIN을 입력하세요. 팀 가입코드를 안내받았다면 함께 입력합니다.</>, <>가입이 끝나면 업무공간으로 이동합니다. 이동하지 않았다면 <Link className="font-bold text-[#2f6d60] underline" href="/login">로그인</Link>에서 아이디와 PIN을 입력하세요.</>, <>왼쪽 메뉴의 <strong>홈</strong>을 열어 오늘의 홈, 내 작업공간, 내 업무 · 알림, 주간보고 탭을 확인하세요. 휴대폰에서는 왼쪽 위 메뉴 버튼으로 목록을 엽니다.</>]} />
            <Note>아이디와 PIN은 본인만 사용하세요. 가입코드가 필요한 팀이라면 팀 관리자에게 코드를 확인하세요. 예전에 만든 계정이 승인 대기 상태라면 관리자에게 문의하세요.</Note>
          </Section>

          <Section id="map" eyebrow="02 · 둘러보기" title="어디서 무엇을 하나요?">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Feature icon={NotebookPen} title="내 작업공간" href="/desk">하루 기록 작성과 비서몬 요청</Feature><Feature icon={KanbanSquare} title="업무" href="/kanban">보드, 프로젝트 WBS·체크리스트, 월마감</Feature><Feature icon={CalendarDays} title="팀" href="/calendar">캘린더·근태, 조직·MBO, 팀원</Feature><Feature icon={ClipboardList} title="주간보고" href="/weekly">내 기록과 업무를 검토해 보고서 작성</Feature><Feature icon={MessageSquareText} title="공지 · 지식" href="/board">게시판·이슈와 팀 아카이브</Feature><Feature icon={Users} title="내 업무 · 알림" href="/work">내 업무 목록과 알림 확인</Feature></div>
            <p>왼쪽 메뉴는 큰 묶음입니다. 묶음을 누른 뒤 화면 위쪽의 탭으로 세부 화면을 이동합니다. 관리자 메뉴는 권한이 있는 계정에서만 보입니다.</p>
          </Section>

          <Section id="daily" eyebrow="03 · 매일" title="일일 업무 기록 남기기">
            <Steps items={[<><strong>홈 → 내 작업공간</strong>에서 이번 주 또는 지난주를 선택하고 기록할 날짜를 누릅니다.</>, <>일일 업무 기록 칸에 한 줄에 한 가지씩 적습니다. 예: “단가 변경 건 확인, 구매팀 답변 대기”.</>, <>입력을 멈추면 자동 저장됩니다. 아래의 <strong>저장됨</strong> 표시를 확인하세요. 바로 저장하려면 Ctrl+S(맥은 ⌘+S)를 누릅니다.</>, <>주간보고가 필요할 때 <strong>홈 → 주간보고</strong>의 “내 기록에서 보고로”에서 날짜별 기록을 골라 항목에 넣습니다. 문장을 확인한 뒤 저장 또는 제출합니다.</>]} />
            <Note>일일 기록은 본인만 볼 수 있습니다. 기록만 작성했다고 주간보고에 자동 제출되지는 않습니다. 넣을 내용과 보고 항목을 직접 선택해야 합니다.</Note>
          </Section>

          <Section id="task" eyebrow="04 · 업무" title="보드와 WBS로 업무 관리하기">
            <Steps items={[<><strong>업무 → 보드</strong>에서 <strong>새 업무 추가</strong>를 누르고 제목, 우선순위, 담당자, 마감일, 내용을 입력합니다.</>, <>업무 카드를 열어 내용을 고치거나 댓글을 남깁니다. 진행 단계는 대기·진행중·완료·중단으로 관리합니다. 완료하려면 비서몬 점검 질문에 답한 뒤 확정합니다.</>, <>진행 중인 업무는 계속 보입니다. 완료 업무는 기본적으로 최근 30일만 표시합니다. 이전 기록은 <strong>완료 업무 조회</strong>에서 90일 또는 시작·종료일을 입력해 찾습니다.</>, <>일정을 길게 보는 업무는 <strong>업무 → 프로젝트 WBS</strong>에서 확인합니다. WBS 업무 일정은 팀 캘린더에도 표시됩니다.</>]} />
            <Note>완료 카드는 삭제되지 않고 보관됩니다. 완료 칸의 “더 보기”를 누르면 현재 조회 기간의 카드가 펼쳐집니다. 한 번에 표시되는 완료 업무가 200건에 닿으면 기간을 좁혀 다시 조회하세요.</Note>
          </Section>

          <Section id="calendar" eyebrow="05 · 일정" title="팀 일정과 근태 확인하기">
            <Steps items={[<><strong>팀 → 캘린더 · 근태</strong>에서 월을 이동합니다. 색상 버튼으로 WBS 업무, 팀 일정, 근태·휴가 표시를 켜고 끌 수 있습니다. <strong>내 일정만</strong>으로 범위를 좁힐 수도 있습니다.</>, <>팀 일정은 <strong>팀 일정</strong> 버튼이나 날짜를 눌러 등록합니다. 유형에서 회의·교육·출장·파견·행사·마감을 고르고 시간, 내용, 참석자를 입력합니다.</>, <>휴가나 근태는 <strong>근태 등록</strong>을 열어 종류와 날짜, 차감 일수 등을 확인하고 등록합니다. 근태 등록 기능이 아직 준비되지 않은 환경에서는 화면의 안내를 따르세요.</>]} />
            <Note>출장과 파견은 팀 일정 유형입니다. WBS 업무와 근태는 각각 별도 항목으로 표시되므로 알맞은 등록 화면을 사용하세요.</Note>
          </Section>

          <Section id="projects" eyebrow="06 · 프로젝트" title="프로젝트와 월마감 관리하기">
            <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[#f6f8f2] p-5"><h3 className="font-bold text-[#2d5548]">프로젝트 WBS · 체크리스트</h3><p className="mt-2"><strong>업무 → 프로젝트 WBS</strong>에서 프로젝트를 고르거나 “새 프로젝트”를 만듭니다. 프로젝트의 문제점·개선방향·개선목표를 적고 저장한 뒤 “일정 추가”로 실행 업무, 담당자, 시작일·마감일, 완료 기준을 등록합니다. 하위 업무가 필요하면 상위 업무를 지정하세요. <strong>프로젝트 체크리스트</strong>는 등록된 업무를 프로젝트별로 살펴보는 화면입니다. 업무 추가는 WBS 화면에서 합니다.</p></div><div className="rounded-2xl bg-[#f6f8f2] p-5"><h3 className="font-bold text-[#2d5548]">월마감 · 팀 현황</h3><p className="mt-2"><strong>업무 → 월마감</strong>에서 해당 월의 마감 항목과 진행 상태를 확인합니다. 반복 업무는 템플릿에서 생성됩니다. <strong>홈 → 오늘의 홈</strong>에서는 팀 전체 또는 내 업무만 골라 진행 업무, 마감 일정, 팀 소식을 보고, <strong>홈 → 팀 현황</strong>에서는 팀 단위 상태를 확인합니다.</p></div></div>
            <Note>프로젝트에 일정을 넣어야 WBS와 연결됩니다. 제목만 만든 프로젝트의 실행 업무는 빈 상태로 보입니다.</Note>
          </Section>

          <Section id="weekly" eyebrow="07 · 보고" title="주간보고 작성하고 제출하기">
            <Steps items={[<><strong>홈 → 주간보고</strong>에서 보고 주차를 확인합니다. 다른 주차는 날짜 선택으로 이동합니다.</>, <>업무 상태에서 만든 초안을 살펴보고, 필요한 경우 <strong>업무 초안 다시 적용</strong>을 누릅니다. 이때 작성 중인 내용은 먼저 확인하세요.</>, <>“내 기록에서 보고로”에서 넣을 보고 항목을 선택하고, 원하는 날짜 기록 옆의 <strong>선택한 항목에 넣기</strong>를 누릅니다. 비서몬 초안도 같은 방법으로 넣을 수 있습니다.</>, <>내용을 직접 다듬고 <strong>초안 저장</strong>으로 보관하거나 <strong>제출</strong>로 팀에 공유합니다. 팀 보고 취합은 권한이 있는 사람에게만 보입니다.</>]} />
            <Note>내 기록, WBS, 비서몬 답변은 보고서 작성에 참고할 재료입니다. 실제 보고서는 내용을 확인한 뒤 저장·제출해야 반영됩니다. 과거 주차를 볼 때 진행 상태는 현재 업무 상태를 기준으로 표시될 수 있습니다.</Note>
          </Section>

          <Section id="share" eyebrow="08 · 공유" title="이슈와 팀 자료 남기기">
            <div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[#f6f8f2] p-5"><h3 className="font-bold text-[#2d5548]">게시판 · 이슈</h3><p className="mt-2">공지 · 지식 → 게시판 · 이슈에서 글을 등록합니다. 이슈라면 <strong>이슈</strong> 태그를 고르고, 사실·영향·필요한 지원을 짧게 적으면 다음 행동이 분명해집니다. 비서몬 답변의 “팀에 이슈 공유”를 누르면 초안을 옮길 수 있습니다. 게시 전 내용을 확인하세요.</p></div><div className="rounded-2xl bg-[#f6f8f2] p-5"><h3 className="font-bold text-[#2d5548]">팀 아카이브</h3><p className="mt-2">공지 · 지식 → 팀 아카이브에서 매뉴얼, 온보딩, 트러블슈팅 등의 자료를 찾습니다. 새 지식을 추가할 때 분류에서 <strong>+ 새 분류 만들기</strong>를 선택하면 필요한 분류를 만들 수 있습니다. 제목·내용·링크를 확인하고 저장하세요.</p></div></div>
          </Section>

          <Section id="assistant" eyebrow="09 · 도움" title="비서몬 활용하기">
            <p>내 작업공간의 비서몬에 “이번 주 3줄 요약”이나 “이슈 리포트” 같은 버튼이 있습니다. 직접 질문도 입력할 수 있습니다. 답변 아래에서 <strong>복사</strong>, <strong>주간보고에 반영</strong>, <strong>팀에 이슈 공유</strong>를 선택하세요. 이동한 초안은 해당 화면에서 검토하고 저장해야 합니다.</p>
            <p>비서몬 대화에는 지난주·이번 주 일일 기록과 업무 목록이 사용됩니다. 외부 AI 전송이 꺼져 있으면 대화 버튼을 사용할 수 없지만 일일 기록은 계속 저장할 수 있습니다. 답변은 참고용이므로 날짜·숫자·담당자를 확인하세요.</p>
            <Note>비서몬의 완료 점검 기록은 <strong>홈 → 비서몬 점검</strong>에서 확인할 수 있습니다.</Note>
          </Section>

          <Section id="presence" eyebrow="10 · 팀" title="접속자·알림·검색 사용하기">
            <p>로그인한 업무공간 오른쪽 위의 <strong>현재 접속자 N명</strong>을 누르면 접속 중인 팀원 목록이 열립니다. 다시 누르면 접힙니다. 접속 인원은 브라우저 연결 상태에 따라 바뀔 수 있습니다.</p><p>오른쪽 위 알림 버튼을 누르면 <strong>내 업무 · 알림</strong>의 알림 화면으로 이동합니다. 새 업무 배정과 팀 공유 사항을 수시로 확인하세요.</p>
            <p>상단 <strong>통합검색 후 Enter</strong> 칸에 업무, 프로젝트, 게시글, 아카이브의 찾을 말을 적고 Enter를 누르세요. 입력 중에는 검색하지 않으므로 단어를 마친 뒤 실행합니다. 팀원의 역할과 목표는 <strong>팀 → 조직 · MBO</strong>에서 연도와 팀원을 골라 확인할 수 있습니다.</p>
          </Section>

          <Section id="faq" eyebrow="11 · 문제 해결" title="자주 묻는 질문">
            <div className="space-y-3">{[
              ['기록을 썼는데 주간보고에 없어요.', '내 작업공간에서 “저장됨”을 확인하고, 주간보고의 “내 기록에서 보고로”에서 해당 날짜를 찾아 “선택한 항목에 넣기”를 누르세요. 그다음 보고서를 저장하거나 제출하세요.'],
              ['오래된 완료 업무가 사라졌어요.', '보드의 “완료 업무 조회”에서 최근 90일 또는 직접 기간을 선택하세요. 완료일이 없는 이전 업무는 “완료일 미상”에서 확인하세요.'],
              ['비서몬 버튼을 누를 수 없어요.', '서버 연결 설정이나 관리자의 외부 전송 허용이 필요할 수 있습니다. 화면의 안내를 확인하세요. 일일 기록은 비서몬 없이도 사용할 수 있습니다.'],
              ['캘린더에 내 업무가 안 보여요.', 'WBS 업무 표시가 켜져 있는지, “내 일정만” 필터가 선택되어 있는지 확인하세요. 팀 일정·근태는 서로 다른 표시 항목입니다.'],
              ['로그인이 안 돼요.', '아이디와 숫자 6자리 PIN을 확인하세요. 승인 대기 안내가 나오거나 PIN을 잊었다면 팀 관리자에게 문의하세요.'],
              ['접속자 수가 예상과 달라요.', '열려 있는 브라우저의 실시간 연결을 기준으로 표시됩니다. 잠시 기다리거나 화면을 새로 열어 확인하세요.'],
            ].map(([question, answer]) => <details key={question} className="group rounded-xl border border-[#dce9dc] bg-[#fbfdf9] px-4 py-3"><summary className="cursor-pointer list-none font-bold text-[#334c40] marker:hidden">{question} <span className="float-right text-[#79a889] group-open:rotate-45">+</span></summary><p className="mt-2 text-[#5b6f61]">{answer}</p></details>)}</div>
            <div className="flex flex-wrap gap-3 pt-2"><Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#2f6d60] px-5 py-3 font-bold text-white">업무공간 열기 <ArrowRight size={16} /></Link><a href="#start" className="inline-flex items-center gap-2 rounded-xl border border-[#bfd6c3] px-5 py-3 font-bold text-[#2f6d60]"><HelpCircle size={16} /> 맨 위로</a></div>
          </Section>
        </div>
      </div>
    </main>
    <footer className="border-t border-[#dce8dd] bg-[#eff4eb] px-6 py-7 text-center text-xs text-[#728273]">Harim Nexus · 공개 사용 설명서 · 로그인 없이 열람 가능</footer>
  </div>
}
