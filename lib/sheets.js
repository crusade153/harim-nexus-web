import { supabase } from '@/lib/supabase'

// ==============================================================================
// 1. [READ] 모든 데이터 DB에서 가져오기
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
      // ✅ 멤버는 가입일(joined_at) 순으로 정렬
      supabase.from('members').select('*').order('joined_at', { ascending: true }),
      supabase.from('schedules').select('*').order('date', { ascending: true }),
      supabase.from('quick_links').select('*').order('id', { ascending: true }),
      supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10)
    ])

    // --- 데이터 가공 ---

    // 1. 업무 (Tasks)
    const tasks = (tasksRes.data || []).map(t => ({
      ID: t.id.toString(), 
      제목: t.title, 
      상태: t.status, 
      우선순위: t.priority,
      담당자명: t.assignee, 
      마감일: t.due_date || '', 
      내용: t.content || '', 
      댓글: []
    }))

    // 2. 아카이브 (Archives)
    const archives = (archivesRes.data || []).map(a => ({
      ID: a.id.toString(), 
      카테고리: a.category, 
      제목: a.title, 
      링크: a.link || '',
      내용: a.content || '', 
      작성자: a.author, 
      날짜: a.created_at ? a.created_at.split('T')[0] : ''
    }))

    // 3. 게시판 + 댓글 (Posts)
    const allComments = commentsRes.data || []
    const posts = (postsRes.data || []).map(p => {
      const myComments = allComments.filter(c => c.post_id === p.id).map(c => ({
        작성자: c.author_name, 
        내용: c.content, 
        시간: c.created_at ? c.created_at.split('T')[0] : ''
      }))
      return {
        ID: p.id.toString(), 
        태그: p.tag, 
        제목: p.title, 
        내용: p.content,
        작성자명: p.author_name, 
        날짜: p.created_at ? p.created_at.split('T')[0] : '',
        조회수: p.views || 0, 
        댓글: myComments, 
        댓글수: myComments.length
      }
    })

    // 4. 프로젝트 + 할 일 (Projects & Todos)
    const allTodos = todosRes.data || []
    const projects = (projectsRes.data || []).map(p => ({
      ID: p.id.toString(), 
      제목: p.title, 
      작성자: p.author, 
      기간: p.period || '',
      todos: allTodos.filter(todo => todo.project_id === p.id).map(todo => ({
        ID: todo.id.toString(), 
        항목: todo.content, 
        담당자: todo.assignee, 
        완료: todo.is_done
      }))
    }))

    // 5. 팀원 (Members) - 관리자 식별용 아이디 추가
    const members = (membersRes.data || []).map(m => ({
      ID: m.id.toString(), 
      아이디: m.login_id, // 관리자 권한 확인용
      이름: m.name, 
      직위: m.position, 
      부서: m.department,
      이메일: m.email, 
      상태: m.status, 
      입사일: m.joined_at, 
      오늘의한마디: m.message || '',
      스킬: m.skills || []
    }))

    // 6. 일정 (Schedules)
    const schedules = (schedulesRes.data || []).map(s => ({
      ID: s.id.toString(), 
      유형: s.type, 
      세부유형: s.sub_type, 
      내용: s.content, 
      날짜: s.date, 
      시간: s.time, 
      대상자: s.target || '전체'
    }))

    // 7. 퀵 링크 (Quick Links)
    const quickLinks = (linksRes.data || []).map(l => ({
      ID: l.id.toString(), 
      이름: l.name, 
      URL: l.url
    }))

    // 8. 활동 로그 (Activities)
    const activities = (activitiesRes.data || []).map(a => ({
      ID: a.id.toString(), 
      사용자: a.user_name, 
      행동: a.action,
      시간: a.created_at ? new Date(a.created_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}) : ''
    }))

    // 9. 현재 사용자 및 휴일 (하드코딩 유지)
    const currentUser = { 
      ID: 'admin', 
      이름: '유경덕', 
      이메일: 'yukd@harim.com', 
      직위: '팀장', 
      부서: '원가팀'
    }

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
// 2. [WRITE] 저장/수정 함수들 (DB 연동 + 활동 로그)
// ==============================================================================

// 활동 로그 기록용 내부 함수
async function logActivity(action) {
  await supabase.from('activities').insert([{ user_name: '유경덕', action }])
}

// 게시글 생성
export async function createPost(newPost) {
  const { error } = await supabase.from('posts').insert([{
    title: newPost.제목, 
    tag: newPost.태그, 
    content: newPost.내용, 
    author_name: newPost.작성자명
  }])
  if (error) throw error
  await logActivity(`님이 게시글 [${newPost.제목}]을 작성했습니다.`)
}

// 댓글 생성
export async function createComment(newComment) {
  const { error } = await supabase.from('comments').insert([{
    post_id: Number(newComment.postID), 
    content: newComment.content, 
    author_name: newComment.authorName
  }])
  if (error) throw error
}

// 아카이브(문서) 생성
export async function createArchive(newDoc) {
  const { error } = await supabase.from('archives').insert([{
    category: newDoc.카테고리, 
    title: newDoc.제목, 
    link: newDoc.링크, 
    content: newDoc.내용, 
    author: '유경덕'
  }])
  if (error) throw error
  await logActivity(`님이 지식고에 [${newDoc.제목}]을 추가했습니다.`)
}

// 프로젝트 생성
export async function createProject(newProject) {
  const { error } = await supabase.from('projects').insert([{
    title: newProject.제목, 
    author: '유경덕', 
    period: newProject.기간
  }])
  if (error) throw error
  await logActivity(`님이 새 프로젝트 [${newProject.제목}]을 생성했습니다.`)
}

// 할 일(Todo) 생성
export async function createTodo(newTodo) {
  const { error } = await supabase.from('todos').insert([{
    project_id: Number(newTodo.projectID), 
    content: newTodo.항목, 
    assignee: newTodo.담당자,
    is_done: false
  }])
  if (error) throw error
}

// 할 일(Todo) 상태 토글
export async function toggleTodo(todoId, currentStatus) {
  const { error } = await supabase.from('todos').update({ is_done: !currentStatus }).eq('id', todoId)
  if (error) throw error
}

// 업무(Task) 생성 - 칸반 보드용
export async function createTask(newTask) {
  const { error } = await supabase.from('tasks').insert([{
    title: newTask.제목, 
    status: '대기', 
    priority: newTask.우선순위 || '보통',
    assignee: newTask.담당자명, 
    due_date: newTask.마감일, 
    content: newTask.내용
  }])
  if (error) throw error
  await logActivity(`님이 새 업무 [${newTask.제목}]을 등록했습니다.`)
}

// 캘린더 일정 생성
export async function createSchedule(newSchedule) {
  const { error } = await supabase.from('schedules').insert([{
    type: newSchedule.유형,
    sub_type: newSchedule.세부유형,
    content: newSchedule.내용,
    date: newSchedule.날짜,
    time: newSchedule.시간,
    target: newSchedule.대상자
  }])
  if (error) throw error
  await logActivity(`님이 캘린더에 [${newSchedule.내용}] 일정을 등록했습니다.`)
}

// 업무 상태 변경 (드래그 앤 드롭용)
export async function updateTaskStatus(taskId, newStatus) {
  const idParam = Number(taskId)
  
  if (isNaN(idParam)) {
    console.error("유효하지 않은 ID:", taskId)
    return
  }

  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', idParam)
  if (error) throw error
}

// ==============================================================================
// 3. [MOCK] 에러 시 빈 껍데기 반환
// ==============================================================================
export function getSampleData() {
  return {
    currentUser: { 이름: '유경덕' },
    members: [], tasks: [], projects: [], archives: [], 
    posts: [], schedules: [], activities: [], quickLinks: []
  }
}