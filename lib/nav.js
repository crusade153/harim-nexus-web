import {
  Home, KanbanSquare, Megaphone, Users, FileBarChart2,
} from 'lucide-react'

// 사이드바는 묶음(섹션) 단위로만 보여주고, 같은 묶음의 화면은 상단 탭으로 오간다.
// 기존 주소(/kanban, /timeline ...)는 그대로 유지해 북마크가 깨지지 않는다.
export const NAV_SECTIONS = [
  {
    id: 'home', name: '홈', icon: Home,
    tabs: [
      { name: '팀 대시보드', path: '/dashboard' },
      { name: '내 업무 · 알림', path: '/work' },
    ],
  },
  {
    id: 'tasks', name: '업무', icon: KanbanSquare,
    tabs: [
      { name: '보드', path: '/kanban' },
      { name: '프로젝트 WBS', path: '/timeline' },
      { name: '프로젝트 체크리스트', path: '/todos' },
    ],
  },
  {
    id: 'knowledge', name: '공지 · 지식', icon: Megaphone,
    tabs: [
      { name: '게시판 · 이슈', path: '/board' },
      { name: '팀 아카이브', path: '/archive' },
    ],
  },
  {
    id: 'team', name: '팀', icon: Users,
    tabs: [
      { name: '캘린더 · 근태', path: '/calendar' },
      { name: '조직 · MBO', path: '/organization' },
      { name: '팀원', path: '/members' },
    ],
  },
  {
    id: 'report', name: '경영진 보고', icon: FileBarChart2, adminOnly: true,
    tabs: [{ name: '경영진 보고', path: '/report' }],
  },
]

export function findSection(pathname) {
  return NAV_SECTIONS.find(section => section.tabs.some(tab => pathname === tab.path || pathname.startsWith(`${tab.path}/`))) || null
}
