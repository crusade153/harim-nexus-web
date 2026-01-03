import { supabase } from '@/lib/supabase'

// ==============================================================================
// 1. [READ] 데이터 가져오기
// ==============================================================================
export async function getRealData() {
  try {
    // 6개의 테이블에서 데이터를 동시에 가져옵니다 (comments 추가됨!)
    const [tasksRes, postsRes, archivesRes, projectsRes, todosRes, commentsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('archives').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('todos').select('*').order('id', { ascending: true }),
      supabase.from('comments').select('*').order('created_at', { ascending: true }) // ✅ 댓글 가져오기
    ])

    // 에러 체크
    if (tasksRes.error) console.error('Tasks 에러:', tasksRes.error)

    // ---------------------------------------------------------
    // 데이터 변환 및 연결
    // ---------------------------------------------------------

    // 1. 댓글 데이터 준비
    const allComments = commentsRes.data || []

    // 2. 게시판 (Posts) + 댓글 연결
    const posts = (postsRes.data || []).map(p => {
      // 이 게시글(p.id)에 달린 댓글만 찾아서 배열로 만듦
      const myComments = allComments
        .filter(c => c.post_id === p.id)
        .map(c => ({
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
        댓글: myComments, // ✅ 댓글 목록(배열) 통째로 넣기
        댓글수: myComments.length // ✅ 개수 자동 계산
      }
    })

    // 3. 업무 (Tasks)
    const tasks = (tasksRes.data || []).map(t => ({
      ID: t.id.toString(), 제목: t.title, 상태: t.status, 우선순위: t.priority,
      담당자명: t.assignee, 마감일: t.due_date || '', 내용: t.content || '', 댓글: []
    }))

    // 4. 아카이브 (Archives)
    const archives = (archivesRes.data || []).map(a => ({
      ID: a.id.toString(), 카테고리: a.category, 제목: a.title, 링크: a.link || '',
      내용: a.content || '', 작성자: a.author, 날짜: a.created_at ? a.created_at.split('T')[0] : ''
    }))

    // 5. 프로젝트 & 할 일 (Projects & Todos)
    const allTodos = todosRes.data || []
    const projects = (projectsRes.data || []).map(p => ({
      ID: p.id.toString(), 제목: p.title, 작성자: p.author, 기간: p.period || '',
      todos: allTodos.filter(todo => todo.project_id === p.id).map(todo => ({
        ID: todo.id.toString(), 항목: todo.content, 담당자: todo.assignee, 완료: todo.is_done
      }))
    }))

    const mockData = getSampleData()
    return { ...mockData, tasks, posts, archives, projects }

  } catch (error) {
    console.error('데이터 로딩 실패:', error)
    return getSampleData()
  }
}

// ==============================================================================
// 2. [WRITE] 데이터 저장하기
// ==============================================================================

// ✅ [New] 댓글 작성 함수
export async function createComment(newComment) {
  const { error } = await supabase.from('comments').insert([{
    post_id: Number(newComment.postID), // 어떤 글인지 ID 저장
    content: newComment.content,
    author_name: newComment.authorName
  }])
  if (error) throw error
}

// 기존 저장 함수들...
export async function createPost(newPost) {
  const { error } = await supabase.from('posts').insert([{
    title: newPost.제목, tag: newPost.태그, content: newPost.내용, author_name: newPost.작성자명
  }])
  if (error) throw error
}

export async function createArchive(newDoc) {
  const { error } = await supabase.from('archives').insert([{
    category: newDoc.카테고리, title: newDoc.제목, link: newDoc.링크, content: newDoc.내용, author: '유경덕'
  }])
  if (error) throw error
}

export async function createProject(newProject) {
  const { error } = await supabase.from('projects').insert([{
    title: newProject.제목, author: '유경덕', period: newProject.기간
  }])
  if (error) throw error
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

// [MOCK] 가짜 데이터
export function getSampleData() {
  return {
    currentUser: { ID: 'user_1', 이름: '유경덕', 이메일: 'yukd@harim.com', 직위: '팀장', 부서: '원가팀', avatar: '유' },
    members: [], tasks: [], projects: [], archives: [], posts: [], schedules: []
  }
}
export const SHEET_ID = 'TEST_ID'
export async function getSheetData() { return [] }