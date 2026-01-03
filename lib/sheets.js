import { supabase } from '@/lib/supabase'

// ==============================================================================
// 1. [READ] 모든 데이터 DB에서 가져오기 (가짜 데이터 제거됨)
// ==============================================================================
export async function getRealData() {
  try {
    // 모든 테이블 데이터 병렬 호출
    const [
      tasksRes, postsRes, archivesRes, projectsRes, 
      todosRes, commentsRes, membersRes, schedulesRes, 
      linksRes, activitiesRes
    ] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('archives').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('todos').select('*').order('id', { ascending: true }),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('members').select('*').order('name', { ascending: true }),     // ✅ 추가됨
      supabase.from('schedules').select('*').order('date', { ascending: true }),   // ✅ 추가됨
      supabase.from('quick_links').select('*').order('id', { ascending: true }),   // ✅ 추가됨
      supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10) // ✅ 추가됨 (최근 10개만)
    ])

    // --- 데이터 가공 ---

    // 1. 기본 데이터
    const tasks = (tasksRes.data || []).map(t => ({
      ID: t.id.toString(), 제목: t.title, 상태: t.status, 우선순위: t.priority,
      담당자명: t.assignee, 마감일: t.due_date || '', 내용: t.content || '', 댓글: []
    }))

    const archives = (archivesRes.data || []).map(a => ({
      ID: a.id.toString(), 카테고리: a.category, 제목: a.title, 링크: a.link || '',
      내용: a.content || '', 작성자: a.author, 날짜: a.created_at ? a.created_at.split('T')[0] : ''
    }))

    // 2. 게시판 + 댓글
    const allComments = commentsRes.data || []
    const posts = (postsRes.data || []).map(p => {
      const myComments = allComments.filter(c => c.post_id === p.id).map(c => ({
        작성자: c.author_name, 내용: c.content, 시간: c.created_at ? c.created_at.split('T')[0] : ''
      }))
      return {
        ID: p.id.toString(), 태그: p.tag, 제목: p.title, 내용: p.content,
        작성자명: p.author_name, 날짜: p.created_at ? p.created_at.split('T')[0] : '',
        조회수: p.views || 0, 댓글: myComments, 댓글수: myComments.length
      }
    })

    // 3. 프로젝트 + 할 일
    const allTodos = todosRes.data || []
    const projects = (projectsRes.data || []).map(p => ({
      ID: p.id.toString(), 제목: p.title, 작성자: p.author, 기간: p.period || '',
      todos: allTodos.filter(todo => todo.project_id === p.id).map(todo => ({
        ID: todo.id.toString(), 항목: todo.content, 담당자: todo.assignee, 완료: todo.is_done
      }))
    }))

    // 4. ✅ [New] 팀원, 일정, 링크, 활동로그 매핑
    const members = (membersRes.data || []).map(m => ({
      ID: m.id.toString(), 이름: m.name, 직위: m.position, 부서: m.department,
      이메일: m.email, 상태: m.status, 입사일: m.joined_at, 스킬: m.skills || []
    }))

    const schedules = (schedulesRes.data || []).map(s => ({
      ID: s.id.toString(), 유형: s.type, 세부유형: s.sub_type, 내용: s.content,
      날짜: s.date, 시간: s.time, 대상자: s.target || '전체'
    }))

    const quickLinks = (linksRes.data || []).map(l => ({
      ID: l.id.toString(), 이름: l.name, URL: l.url
    }))

    const activities = (activitiesRes.data || []).map(a => ({
      ID: a.id.toString(), 사용자: a.user_name, 행동: a.action,
      시간: a.created_at ? new Date(a.created_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}) : ''
    }))

    // 5. ✅ [CurrentUser] 로그인 전이라 하드코딩 유지 (나중에 Auth 붙이면 제거)
    const currentUser = { 
      ID: 'admin', 이름: '유경덕', 이메일: 'yukd@harim.com', 
      직위: '팀장', 부서: '원가팀', avatar: '유' 
    }

    // 휴일 정보는 DB보다 하드코딩이 편할 수 있음 (선택 사항)
    const holidays = [
      { date: '2026-01-01', name: '신정' },
      { date: '2026-02-16', name: '설날 연휴' }
    ]

    return { 
      currentUser, members, tasks, projects, archives, 
      posts, schedules, holidays, quickLinks, activities 
    }

  } catch (error) {
    console.error('데이터 로딩 실패:', error)
    return getSampleData()
  }
}

// ==============================================================================
// 2. [WRITE] 저장 함수들 (활동 로그 기록 기능 추가)
// ==============================================================================

// 활동 로그 기록용 내부 함수
async function logActivity(action) {
  await supabase.from('activities').insert([{ user_name: '유경덕', action }])
}

export async function createPost(newPost) {
  const { error } = await supabase.from('posts').insert([{
    title: newPost.제목, tag: newPost.태그, content: newPost.내용, author_name: newPost.작성자명
  }])
  if (error) throw error
  logActivity(`님이 게시글 [${newPost.제목}]을 작성했습니다.`) // 로그 기록
}

export async function createComment(newComment) {
  const { error } = await supabase.from('comments').insert([{
    post_id: Number(newComment.postID), content: newComment.content, author_name: newComment.authorName
  }])
  if (error) throw error
}

export async function createArchive(newDoc) {
  const { error } = await supabase.from('archives').insert([{
    category: newDoc.카테고리, title: newDoc.제목, link: newDoc.링크, content: newDoc.내용, author: '유경덕'
  }])
  if (error) throw error
  logActivity(`님이 지식고에 [${newDoc.제목}]을 추가했습니다.`)
}

export async function createProject(newProject) {
  const { error } = await supabase.from('projects').insert([{
    title: newProject.제목, author: '유경덕', period: newProject.기간
  }])
  if (error) throw error
  logActivity(`님이 새 프로젝트 [${newProject.제목}]을 생성했습니다.`)
}

export async function createTodo(newTodo) {
  const { error } = await supabase.from('todos').insert([{
    project_id: Number(newTodo.projectID), content: newTodo.항목, assignee: newTodo.담당자
  }])
  if (error) throw error
}

export async function toggleTodo(todoId, currentStatus) {
  const { error } = await supabase.from('todos').update({ is_done: !currentStatus }).eq('id', todoId)
  if (error) throw error
}

export async function createTask(newTask) {
  const { error } = await supabase.from('tasks').insert([{
    title: newTask.제목, status: '대기', priority: newTask.우선순위 || '보통',
    assignee: newTask.담당자명, due_date: newTask.마감일, content: newTask.내용
  }])
  if (error) throw error
  logActivity(`님이 새 업무 [${newTask.제목}]을 등록했습니다.`)
}

// ==============================================================================
// 3. [MOCK] 빈 껍데기만 남김 (에러 시 빈 화면 표시)
// ==============================================================================
export function getSampleData() {
  return {
    currentUser: { 이름: '유경덕' }, // 최소한의 정보
    members: [], tasks: [], projects: [], archives: [], 
    posts: [], schedules: [], activities: [], quickLinks: []
  }
}
export const SHEET_ID = 'TEST_ID'
export async function getSheetData() { return [] }