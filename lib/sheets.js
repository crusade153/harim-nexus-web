import { supabase } from '@/lib/supabase'

// ==============================================================================
// 1. [READ] 데이터 가져오기 (Supabase DB -> 앱 데이터 변환)
// ==============================================================================
export async function getRealData() {
  try {
    // 5개의 테이블에서 데이터를 동시에 가져옵니다 (Promise.all로 속도 최적화)
    const [tasksRes, postsRes, archivesRes, projectsRes, todosRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('archives').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('todos').select('*').order('id', { ascending: true })
    ])

    // 에러 체크
    if (tasksRes.error) console.error('Tasks 로딩 에러:', tasksRes.error)
    if (postsRes.error) console.error('Posts 로딩 에러:', postsRes.error)

    // ---------------------------------------------------------
    // DB의 데이터(영어 컬럼)를 앱에서 사용하는 데이터(한글 속성)로 변환
    // ---------------------------------------------------------

    // 1. 업무 (Tasks)
    const tasks = (tasksRes.data || []).map(t => ({
      ID: t.id.toString(),
      제목: t.title,
      상태: t.status,
      우선순위: t.priority,
      담당자명: t.assignee,
      마감일: t.due_date || '',
      내용: t.content || '',
      댓글: [] // 댓글 테이블은 아직 없으므로 빈 배열
    }))

    // 2. 게시판 (Posts)
    const posts = (postsRes.data || []).map(p => ({
      ID: p.id.toString(),
      태그: p.tag,
      제목: p.title,
      내용: p.content,
      작성자명: p.author_name,
      날짜: p.created_at ? p.created_at.split('T')[0] : '', // '2025-01-01' 형식으로 자르기
      조회수: p.views || 0,
      댓글: p.comment_count || 0
    }))

    // 3. 아카이브 (Archives)
    const archives = (archivesRes.data || []).map(a => ({
      ID: a.id.toString(),
      카테고리: a.category,
      제목: a.title,
      링크: a.link || '',
      내용: a.content || '',
      작성자: a.author,
      날짜: a.created_at ? a.created_at.split('T')[0] : ''
    }))

    // 4. 프로젝트 & 할 일 (Projects & Todos)
    const allTodos = todosRes.data || []
    const projects = (projectsRes.data || []).map(p => ({
      ID: p.id.toString(),
      제목: p.title,
      작성자: p.author,
      기간: p.period || '',
      // 해당 프로젝트 ID를 가진 할 일만 필터링해서 넣기
      todos: allTodos
        .filter(todo => todo.project_id === p.id)
        .map(todo => ({
          ID: todo.id.toString(),
          항목: todo.content,
          담당자: todo.assignee,
          완료: todo.is_done
        }))
    }))

    // 5. 아직 DB가 없는 데이터(멤버, 일정 등)는 Mock 데이터와 병합
    const mockData = getSampleData()

    return {
      ...mockData, // currentUser, members, schedules 등 유지
      tasks,
      posts,
      archives,
      projects
    }

  } catch (error) {
    console.error('치명적인 에러 발생:', error)
    return getSampleData() // 에러 발생 시 가짜 데이터로 폴백(안전장치)
  }
}

// ==============================================================================
// 2. [WRITE] 데이터 저장하기 (앱 -> Supabase DB)
// ==============================================================================

// [게시판] 새 글 저장
export async function createPost(newPost) {
  const { error } = await supabase.from('posts').insert([{
    title: newPost.제목,
    tag: newPost.태그,
    content: newPost.내용,
    author_name: newPost.작성자명,
    views: 0,
    comment_count: 0
  }])
  if (error) throw error
}

// [아카이브] 새 문서 저장
export async function createArchive(newDoc) {
  const { error } = await supabase.from('archives').insert([{
    category: newDoc.카테고리,
    title: newDoc.제목,
    link: newDoc.링크,
    content: newDoc.내용,
    author: '유경덕' // 로그인 연동 전 임시 작성자
  }])
  if (error) throw error
}

// [프로젝트] 새 프로젝트 저장
export async function createProject(newProject) {
  const { error } = await supabase.from('projects').insert([{
    title: newProject.제목,
    author: '유경덕',
    period: newProject.기간
  }])
  if (error) throw error
}

// [할 일] 새 할 일 추가
export async function createTodo(newTodo) {
  const { error } = await supabase.from('todos').insert([{
    project_id: Number(newTodo.projectID),
    content: newTodo.항목,
    assignee: newTodo.담당자,
    is_done: false
  }])
  if (error) throw error
}

// [할 일] 상태 토글 (완료 <-> 미완료)
export async function toggleTodo(todoId, currentStatus) {
  const { error } = await supabase.from('todos')
    .update({ is_done: !currentStatus })
    .eq('id', todoId)
  if (error) throw error
}

// [업무] 새 업무 추가 (Kanban)
export async function createTask(newTask) {
  const { error } = await supabase.from('tasks').insert([{
    title: newTask.제목,
    status: '대기', // 기본 상태
    priority: newTask.우선순위 || '보통',
    assignee: newTask.담당자명,
    due_date: newTask.마감일,
    content: newTask.내용
  }])
  if (error) throw error
}


// ==============================================================================
// 3. [MOCK] 가짜 데이터 (DB 연결 실패 시 혹은 아직 DB 없는 기능용)
// ==============================================================================
export function getSampleData() {
  const currentUser = { 
    ID: 'user_1',
    이름: '유경덕', 
    이메일: 'yukd2022@harim-foods.com',
    직위: '팀장',
    권한: 'admin',
    부서: '원가팀',
    avatar: '유' 
  }

  return {
    currentUser,
    members: [
      { ID: 'user_1', 이름: '유경덕', 직위: '팀장', 부서: '원가팀', 상태: '온라인', 입사일: '2015-03-02', 스킬: ['원가기획', '시스템'] },
      { ID: 'user_2', 이름: '전용주', 직위: '팀원', 부서: '원가팀', 상태: '자리비움', 입사일: '2019-11-15', 스킬: ['목표원가', '데이터분석'] },
      { ID: 'user_3', 이름: '김리아', 직위: '팀원', 부서: '원가팀', 상태: '온라인', 입사일: '2021-06-01', 스킬: ['시스템', '목표원가'] },
      { ID: 'user_4', 이름: '박혜린', 직위: '팀원', 부서: '원가팀', 상태: '방해금지', 입사일: '2022-01-10', 스킬: ['목표원가', '테이터분석'] }
    ],
    // 아래 데이터는 DB 연결 시 덮어씌워지지만, 에러 대비용으로 남겨둠
    tasks: [],
    projects: [],
    archives: [],
    posts: [],
    schedules: [
      { ID: '1', 유형: '회의', 세부유형: '주간회의', 내용: '원가팀 신년 회의', 날짜: '2026-01-02', 시간: '10:00' },
      { ID: '2', 유형: '연차', 세부유형: '연차', 내용: '전용주 연차', 날짜: '2026-01-05', 시간: '종일' },
      { ID: '3', 유형: '외근', 세부유형: '출장', 내용: '본사 보고', 날짜: '2026-01-08', 시간: '14:00' }
    ],
    holidays: [
      { date: '2026-01-01', name: '신정' },
      { date: '2026-02-16', name: '설날 연휴' },
      { date: '2026-02-17', name: '설날' },
      { date: '2026-02-18', name: '설날 연휴' },
      { date: '2026-03-01', name: '삼일절' }
    ],
    quickLinks: [
      { 이름: '그룹웨어', URL: '#' },
      { 이름: 'SAP ERP', URL: '#' },
      { 이름: '국세청', URL: '#' },
      { 이름: '공용 드라이브', URL: '#' }
    ],
    activities: [
      { ID: '1', 사용자: '유경덕', 행동: '님이 [2025년 결산 보고서] 상태를 "진행중"으로 변경했습니다.', 시간: '10분 전' },
      { ID: '2', 사용자: '시스템', 행동: '일일 백업이 완료되었습니다.', 시간: '어제' }
    ]
  }
}

// 레거시 코드 호환용 (사용 안 함)
export const SHEET_ID = 'TEST_ID'
export async function getSheetData() { return [] }