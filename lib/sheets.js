import { supabase } from '@/lib/supabase'

// ==============================================================================
// 0. [UTILITY] 활동 로그 기록
// ==============================================================================
async function logActivity(userName, action) {
  try {
    await supabase.from('activities').insert([{ 
      user_name: userName || '알 수 없음', 
      action 
    }])
  } catch (e) {
    console.error('로그 기록 실패:', e)
  }
}

// ==============================================================================
// 1. [READ] 통합 데이터 가져오기
// ==============================================================================
export async function getRealData() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    const [
      tasksRes, postsRes, archivesRes, projectsRes, 
      commentsRes, membersRes, schedulesRes, 
      linksRes, activitiesRes
    ] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('archives').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*').order('created_at', { ascending: true }),
      supabase.from('members').select('*').order('joined_at', { ascending: true }),
      supabase.from('schedules').select('*').order('date', { ascending: true }),
      supabase.from('quick_links').select('*').order('id', { ascending: true }),
      supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10)
    ])

    const membersList = membersRes.data || []
    let currentUser = null

    if (user) {
      const member = membersList.find(m => m.auth_id === user.id || m.email === user.email)
      currentUser = member ? {
        ID: member.id.toString(),
        이름: member.name,
        직위: member.position,
        부서: member.department,
        이메일: member.email,
        아이디: member.login_id,
        역할: member.role || 'member'
      } : {
        ID: user.id,
        이름: user.user_metadata?.name || '알 수 없음',
        이메일: user.email,
        직위: '미정',
        부서: '미정'
      }
    } else {
      currentUser = { 이름: '게스트', ID: 'guest' }
    }

    const allComments = commentsRes.data || []

    // --- Tasks 데이터 가공 ---
    const tasks = (tasksRes.data || []).map(t => {
      const taskComments = allComments.filter(c => String(c.post_id) === String(t.id)).map(c => ({
        ID: c.id, 
        작성자: c.author_name, 
        내용: c.content, 
        시간: c.created_at ? c.created_at.split('T')[0] : ''
      }))

      return {
        ID: t.id.toString(), 
        제목: t.title, 
        상태: t.status, 
        우선순위: t.priority,
        담당자명: t.assignee, 
        마감일: t.due_date || '', 
        시작일: t.start_date || t.created_at?.split('T')[0] || '',
        내용: t.content || '',
        프로젝트ID: t.project_id ? t.project_id.toString() : null,
        상위업무ID: t.parent_id ? t.parent_id.toString() : null,
        주요업무: Boolean(t.is_key_task),
        완료기준: t.acceptance_criteria || '',
        산출물링크: t.deliverable_url || '',
        지연사유: t.delay_reason || '',
        선행업무ID: t.predecessor_id ? t.predecessor_id.toString() : null,
        WBS순서: Number(t.wbs_order || 0),
        관련문서ID: t.related_doc_id || null,
        완료: t.status === '완료', 
        댓글: taskComments 
      }
    })

    // --- Projects 데이터 가공 ---
    const projects = (projectsRes.data || []).map(p => ({
      ID: p.id.toString(),
      제목: p.title,
      작성자: p.author,
      생성일: p.created_at || '',
      기간: p.period || '',
      문제점: p.problem || '',
      개선방향: p.direction || '',
      개선목표: p.goal || '',
      todos: tasks.filter(t => t.프로젝트ID === p.id.toString()).map(t => ({
        ID: t.ID,
        항목: t.제목,
        담당자: t.담당자명,
        완료: t.완료,
        상태: t.상태,
        마감일: t.마감일,
        우선순위: t.우선순위
      }))
    }))

    // --- Archives 데이터 가공 ---
    const archives = (archivesRes.data || []).map(a => {
      const myComments = allComments.filter(c => String(c.post_id) === String(a.id)).map(c => ({
        ID: c.id, 작성자: c.author_name, 내용: c.content, 시간: c.created_at ? c.created_at.split('T')[0] : ''
      }))
      return {
        ID: a.id.toString(), 카테고리: a.category, 제목: a.title, 링크: a.link || '',
        내용: a.content || '', 작성자: a.author, 날짜: a.created_at ? a.created_at.split('T')[0] : '',
        댓글: myComments, 댓글수: myComments.length
      }
    })

    // --- Posts 데이터 가공 ---
    const posts = (postsRes.data || []).map(p => {
      const myComments = allComments.filter(c => String(c.post_id) === String(p.id)).map(c => ({
        ID: c.id, 작성자: c.author_name, 내용: c.content, 시간: c.created_at ? c.created_at.split('T')[0] : ''
      }))
      return {
        ID: p.id.toString(), 태그: p.tag, 제목: p.title, 내용: p.content,
        작성자명: p.author_name, 날짜: p.created_at ? p.created_at.split('T')[0] : '',
        조회수: p.views || 0, 댓글: myComments, 댓글수: myComments.length
      }
    })

    const members = membersList.map(m => ({
      ID: m.id.toString(), 아이디: m.login_id, 이름: m.name, 직위: m.position, 
      부서: m.department, 이메일: m.email, 상태: m.status, 
      승인됨: m.approved, 역할: m.role || 'member', 계정연결: Boolean(m.auth_id),
      입사일: m.joined_at, 오늘의한마디: m.message || '', 스킬: m.skills || []
    })).sort((a, b) => {
      if (a.이름 === '유경덕' || a.아이디 === 'crusade153') return -1
      if (b.이름 === '유경덕' || b.아이디 === 'crusade153') return 1
      return 0
    })

    const schedules = (schedulesRes.data || []).map(s => ({
      ID: s.id.toString(), 유형: s.type, 세부유형: s.sub_type, 내용: s.content, 
      날짜: s.date, 시간: s.time, 대상자: s.target || '전체'
    }))

    const quickLinks = (linksRes.data || []).map(l => ({ ID: l.id.toString(), 이름: l.name, URL: l.url }))
    
    const activities = (activitiesRes.data || []).map(a => ({
      ID: a.id.toString(), 사용자: a.user_name, 행동: a.action,
      시간: a.created_at ? new Date(a.created_at).toLocaleTimeString('ko-KR', {hour: '2-digit', minute:'2-digit'}) : ''
    }))

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
// 2. [WRITE] 게시판(Board) 관리 함수
// ==============================================================================
export async function createPost(newPost) {
  const { error } = await supabase.from('posts').insert([{
    title: newPost.제목, 
    tag: newPost.태그, 
    content: newPost.내용, 
    author_name: newPost.작성자명
  }])
  if (error) throw error
  await logActivity(newPost.작성자명, `님이 게시글 [${newPost.제목}]을 작성했습니다.`)
}

export async function updatePost(postId, updatedData, userName = '사용자') {
  const { error } = await supabase.from('posts').update({
    title: updatedData.제목,
    tag: updatedData.태그,
    content: updatedData.내용
  }).eq('id', postId)
  if (error) throw error
  await logActivity(userName, `님이 게시글 [${updatedData.제목}]을 수정했습니다.`)
}

// ✅ [수정] 삭제 시 userName 받기
export async function deletePost(postId, userName = '사용자') {
  await supabase.from('comments').delete().eq('post_id', postId)
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
  await logActivity(userName, `님이 게시글을 삭제했습니다.`)
}

// ==============================================================================
// 3. [WRITE] 댓글(Comment) 관리 함수
// ==============================================================================
export async function createComment(newComment) {
  const { error } = await supabase.from('comments').insert([{
    post_id: Number(newComment.postID), 
    content: newComment.content, 
    author_name: newComment.authorName
  }])
  if (error) throw error
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId)
  if (error) throw error
}

// ==============================================================================
// 4. [WRITE] 아카이브(Archive) 관리 함수
// ==============================================================================
export async function createArchive(newDoc) {
  const { error } = await supabase.from('archives').insert([{
    category: newDoc.카테고리, 
    title: newDoc.제목, 
    link: newDoc.링크, 
    content: newDoc.내용, 
    author: newDoc.작성자
  }])
  if (error) throw error
  await logActivity(newDoc.작성자, `님이 지식고에 [${newDoc.제목}]을 추가했습니다.`)
}

export async function updateArchive(docId, updatedDoc, userName = '사용자') {
  const { error } = await supabase.from('archives').update({
    category: updatedDoc.카테고리,
    title: updatedDoc.제목,
    link: updatedDoc.링크,
    content: updatedDoc.내용
  }).eq('id', docId)
  if (error) throw error
  await logActivity(userName, `님이 지식고 문서 [${updatedDoc.제목}]을 수정했습니다.`)
}

// ✅ [수정] 삭제 시 userName 받기
export async function deleteArchive(docId, userName = '사용자') {
  await supabase.from('comments').delete().eq('post_id', docId)
  const { error } = await supabase.from('archives').delete().eq('id', docId)
  if (error) throw error
  await logActivity(userName, `님이 지식고 문서를 삭제했습니다.`)
}

// ==============================================================================
// 5. [WRITE] 프로젝트(Project) 관리 함수
// ==============================================================================
export async function createProject(newProject) {
  const { error } = await supabase.from('projects').insert([{
    title: newProject.제목,
    author: newProject.작성자,
    period: newProject.기간,
    problem: newProject.문제점 || null,
    direction: newProject.개선방향 || null,
    goal: newProject.개선목표 || null
  }])
  if (error) throw error
  await logActivity(newProject.작성자, `님이 새 프로젝트 [${newProject.제목}]을 생성했습니다.`)
}

export async function updateProject(projectId, updatedData, userName = '사용자') {
  const { error } = await supabase.from('projects').update({
    title: updatedData.제목,
    period: updatedData.기간,
    problem: updatedData.문제점 ?? null,
    direction: updatedData.개선방향 ?? null,
    goal: updatedData.개선목표 ?? null
  }).eq('id', projectId)
  if (error) throw error
  await logActivity(userName, `님이 프로젝트 [${updatedData.제목}]을 수정했습니다.`)
}

// ✅ [수정] 삭제 시 userName 받기
export async function deleteProject(projectId, userName = '사용자') {
  const { data: tasksToDelete } = await supabase.from('tasks').select('id').eq('project_id', projectId)
  
  if (tasksToDelete && tasksToDelete.length > 0) {
    const taskIds = tasksToDelete.map(t => t.id)
    await supabase.from('comments').delete().in('post_id', taskIds)
    await supabase.from('tasks').delete().eq('project_id', projectId)
  }

  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) throw error
  
  await logActivity(userName, `님이 프로젝트를 삭제했습니다.`)
}

// ==============================================================================
// 6. [WRITE] 업무(Tasks) 관리 - 통합 로직
// ==============================================================================
export async function createTask(newTask) {
  const row = {
    title: newTask.제목,
    status: '대기',
    priority: newTask.우선순위 || '보통',
    assignee: newTask.담당자명,
    due_date: newTask.마감일,
    start_date: newTask.시작일 || newTask.마감일,
    content: newTask.내용,
    project_id: newTask.프로젝트ID ? Number(newTask.프로젝트ID) : null,
    related_doc_id: newTask.관련문서ID ? Number(newTask.관련문서ID) : null
  }
  if (newTask.상위업무ID) row.parent_id = Number(newTask.상위업무ID)
  if (newTask.주요업무) row.is_key_task = true
  if (newTask.완료기준) row.acceptance_criteria = newTask.완료기준
  if (newTask.산출물링크) row.deliverable_url = newTask.산출물링크
  if (newTask.지연사유) row.delay_reason = newTask.지연사유
  if (newTask.선행업무ID) row.predecessor_id = Number(newTask.선행업무ID)
  if (newTask.WBS순서 !== undefined) row.wbs_order = Number(newTask.WBS순서) || 0
  const { error } = await supabase.from('tasks').insert([row])
  if (error) {
    if (isMissingAdvancedWbsColumn(error)) {
      const { error: retryError } = await supabase.from('tasks').insert([stripAdvancedWbsColumns(row)])
      if (retryError) throw retryError
    } else {
      throw error
    }
  }
  await logActivity(newTask.담당자명, `님이 새 업무 [${newTask.제목}]을 등록했습니다.`)
}

function stripAdvancedWbsColumns(row) {
  const next = { ...row }
  delete next.is_key_task
  delete next.acceptance_criteria
  delete next.deliverable_url
  delete next.delay_reason
  delete next.predecessor_id
  delete next.wbs_order
  return next
}

function isMissingAdvancedWbsColumn(error) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`
  return /is_key_task|acceptance_criteria|deliverable_url|delay_reason|predecessor_id|wbs_order/i.test(message)
}

export const createProjectTask = createTask

export async function updateTask(taskId, updates, userName = '사용자') {
  const dbUpdates = {}
  if(updates.제목) dbUpdates.title = updates.제목
  if(updates.내용) dbUpdates.content = updates.내용
  if(updates.우선순위) dbUpdates.priority = updates.우선순위
  if(updates.담당자명) dbUpdates.assignee = updates.담당자명
  if(updates.마감일) dbUpdates.due_date = updates.마감일
  if(updates.시작일) dbUpdates.start_date = updates.시작일
  if(updates.관련문서ID) dbUpdates.related_doc_id = Number(updates.관련문서ID)
  if(updates.프로젝트ID) dbUpdates.project_id = Number(updates.프로젝트ID)
  // 상위업무ID 는 '해제(null)'도 가능해야 하므로 키 존재 여부로 판단
  if('상위업무ID' in updates) dbUpdates.parent_id = updates.상위업무ID ? Number(updates.상위업무ID) : null
  if('주요업무' in updates) dbUpdates.is_key_task = Boolean(updates.주요업무)
  if('완료기준' in updates) dbUpdates.acceptance_criteria = updates.완료기준 || null
  if('산출물링크' in updates) dbUpdates.deliverable_url = updates.산출물링크 || null
  if('지연사유' in updates) dbUpdates.delay_reason = updates.지연사유 || null
  if('선행업무ID' in updates) dbUpdates.predecessor_id = updates.선행업무ID ? Number(updates.선행업무ID) : null
  if('WBS순서' in updates) dbUpdates.wbs_order = Number(updates.WBS순서) || 0

  const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', taskId)
  if (error) {
    if (isMissingAdvancedWbsColumn(error)) {
      const fallback = stripAdvancedWbsColumns(dbUpdates)
      const { error: retryError } = await supabase.from('tasks').update(fallback).eq('id', taskId)
      if (retryError) throw retryError
    } else {
      throw error
    }
  }
  
  await logActivity(userName, `님이 업무 [${updates.제목 || '제목 없음'}]를 수정했습니다.`)
}

export async function createWbsOutlineTasks(projectId, outlineItems, userName = '사용자') {
  const createdByIndex = new Map()

  for (const item of outlineItems) {
    const parentId = item.parentIndex !== null && item.parentIndex !== undefined
      ? createdByIndex.get(item.parentIndex)
      : null

    const row = {
      title: item.title,
      status: '대기',
      priority: item.priority || '보통',
      assignee: item.assignee || null,
      start_date: item.startDate || item.dueDate || new Date().toISOString().split('T')[0],
      due_date: item.dueDate || item.startDate || new Date().toISOString().split('T')[0],
      content: item.content || '',
      project_id: Number(projectId),
      parent_id: parentId || null,
      is_key_task: Boolean(item.isKey),
      acceptance_criteria: item.acceptanceCriteria || null,
      deliverable_url: item.deliverableUrl || null,
      delay_reason: item.delayReason || null,
      wbs_order: Number(item.order || item.index || 0)
    }

    let { data, error } = await supabase.from('tasks').insert([row]).select('id').single()
    if (error && isMissingAdvancedWbsColumn(error)) {
      const retry = await supabase.from('tasks').insert([stripAdvancedWbsColumns(row)]).select('id').single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error
    createdByIndex.set(item.index, data.id)
  }

  await logActivity(userName, `님이 WBS 업무 ${outlineItems.length}건을 빠른 입력으로 등록했습니다.`)
}

export async function bulkUpdateTasks(taskIds, updates, userName = '사용자') {
  const ids = taskIds.map(Number).filter(Boolean)
  if (ids.length === 0) return

  const dbUpdates = {}
  if (updates.담당자명) dbUpdates.assignee = updates.담당자명
  if (updates.시작일) dbUpdates.start_date = updates.시작일
  if (updates.마감일) dbUpdates.due_date = updates.마감일
  if (updates.우선순위) dbUpdates.priority = updates.우선순위
  if ('주요업무' in updates) dbUpdates.is_key_task = Boolean(updates.주요업무)
  if (updates.상태) dbUpdates.status = updates.상태

  if (Object.keys(dbUpdates).length === 0) return

  const { error } = await supabase.from('tasks').update(dbUpdates).in('id', ids)
  if (error) {
    if (isMissingAdvancedWbsColumn(error)) {
      const fallback = stripAdvancedWbsColumns(dbUpdates)
      const { error: retryError } = await supabase.from('tasks').update(fallback).in('id', ids)
      if (retryError) throw retryError
    } else {
      throw error
    }
  }
  await logActivity(userName, `님이 WBS 업무 ${ids.length}건을 일괄 수정했습니다.`)
}

export async function updateTaskTimeline(taskId, startDate, endDate) {
  const { error } = await supabase.from('tasks').update({
    start_date: startDate,
    due_date: endDate
  }).eq('id', taskId)
  if (error) throw error
}

export async function updateTaskStatus(taskId, newStatus) {
  const idParam = Number(taskId)
  if (isNaN(idParam)) return
  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', idParam)
  if (error) throw error
}

export async function toggleTaskStatus(taskId, currentIsDone) {
  const newStatus = currentIsDone ? '대기' : '완료'
  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
  if (error) throw error
}

// ✅ [수정] 삭제 시 userName 받기
export async function deleteTask(taskId, userName = '사용자') {
  let ids = [Number(taskId)]
  let frontier = [Number(taskId)]

  while (frontier.length > 0) {
    const { data: children } = await supabase.from('tasks').select('id').in('parent_id', frontier)
    const childIds = (children || []).map(c => c.id).filter(id => !ids.includes(id))
    if (childIds.length === 0) break
    ids = ids.concat(childIds)
    frontier = childIds
  }

  await supabase.from('comments').delete().in('post_id', ids)
  const { error } = await supabase.from('tasks').delete().in('id', ids)
  if (error) throw error
  await logActivity(userName, `님이 업무를 삭제했습니다.`)
}

export async function getProjectTasks(projectId) {
  if (!projectId) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true })
  
  if (error) return []
  return data
}

// ==============================================================================
// 7. [WRITE] 일정(Schedule) 및 프로필 관리 함수
// ==============================================================================
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
  await logActivity('팀원', `님이 캘린더에 [${newSchedule.내용}] 일정을 등록했습니다.`)
}

export async function updateMyProfile(userId, newStatus, newMessage) {
  const { error } = await supabase.from('members').update({
    status: newStatus, message: newMessage
  }).eq('auth_id', userId)
  if (error) throw error
}

// ==============================================================================
// 7-1. [ADMIN] 팀원 관리 함수 (관리자 전용)
// ==============================================================================
async function invokeAdminMembers(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-members', {
    body: { action, ...payload },
  })
  if (error) {
    const context = error.context
    const result = context && typeof context.json === 'function'
      ? await context.json().catch(() => null)
      : null
    throw new Error(result?.error || error.message || '회원 관리 요청에 실패했습니다.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// ==============================================================================
// 7-1. 캘린더 전용 조회 및 근태 일정
// 전체 워크스페이스 데이터를 읽지 않고 캘린더에 필요한 테이블만 조회합니다.
// ==============================================================================
export async function getCalendarData() {
  const { data: { user } } = await supabase.auth.getUser()
  const [tasksRes, membersRes, schedulesRes, attendanceRes] = await Promise.all([
    supabase.from('tasks').select('id,title,status,assignee,due_date').not('due_date', 'is', null).order('due_date'),
    supabase.from('members').select('id,auth_id,name,position,department,role').order('joined_at'),
    supabase.from('schedules').select('id,type,sub_type,content,date,time,target').order('date'),
    supabase.from('attendance_events').select('id,member_id,event_type,start_date,end_date,start_time,end_time,unit_days,note,status').order('start_date'),
  ])

  const requiredErrors = [tasksRes.error, membersRes.error, schedulesRes.error].filter(Boolean)
  if (requiredErrors.length) throw requiredErrors[0]

  const members = (membersRes.data || []).map(member => ({
    ID: String(member.id),
    authId: member.auth_id,
    이름: member.name,
    직위: member.position,
    부서: member.department,
    역할: member.role || 'member',
  }))
  const myMember = members.find(member => member.authId === user?.id)

  return {
    currentUser: myMember || { ID: user?.id || '', 이름: user?.email || '사용자', 역할: 'member' },
    members,
    tasks: (tasksRes.data || []).map(task => ({
      ID: String(task.id), 제목: task.title, 상태: task.status,
      담당자명: task.assignee, 마감일: task.due_date,
    })),
    schedules: (schedulesRes.data || []).map(schedule => ({
      ID: String(schedule.id), 유형: schedule.type, 세부유형: schedule.sub_type,
      내용: schedule.content, 날짜: schedule.date, 시간: schedule.time,
      대상자: schedule.target || '전체',
    })),
    attendance: (attendanceRes.data || []).map(event => ({
      id: String(event.id), memberId: String(event.member_id), eventType: event.event_type,
      startDate: event.start_date, endDate: event.end_date, startTime: event.start_time,
      endTime: event.end_time, unitDays: Number(event.unit_days), note: event.note || '',
      status: event.status,
    })),
    attendanceAvailable: !attendanceRes.error,
  }
}

export async function createAttendanceEvent(event) {
  const { error } = await supabase.from('attendance_events').insert([{
    member_id: Number(event.memberId),
    event_type: event.eventType,
    start_date: event.startDate,
    end_date: event.endDate || event.startDate,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    unit_days: Number(event.unitDays || 1),
    note: event.note || '',
    status: 'confirmed',
  }])
  if (error) throw error
}

export async function deleteAttendanceEvent(eventId) {
  const { error } = await supabase.from('attendance_events').delete().eq('id', Number(eventId))
  if (error) throw error
}

// ==============================================================================
// 7-2. 조직 · 역할/책임 · MBO · 업무분장
// ==============================================================================
export async function getOrganizationData() {
  const [membersRes, unitsRes, profilesRes, mboRes, responsibilitiesRes, assignmentsRes] = await Promise.all([
    supabase.from('members').select('id,auth_id,name,position,department,email,role,approved,status').order('joined_at'),
    supabase.from('org_units').select('*').order('sort_order').order('name'),
    supabase.from('member_role_profiles').select('*'),
    supabase.from('mbo_objectives').select('*').order('year', { ascending: false }).order('weight', { ascending: false }),
    supabase.from('work_responsibilities').select('*').order('sort_order').order('title'),
    supabase.from('responsibility_assignments').select('*'),
  ])
  const error = [membersRes, unitsRes, profilesRes, mboRes, responsibilitiesRes, assignmentsRes].find(result => result.error)?.error
  if (error) throw error
  return {
    members: membersRes.data || [], units: unitsRes.data || [], profiles: profilesRes.data || [],
    objectives: mboRes.data || [], responsibilities: responsibilitiesRes.data || [],
    assignments: assignmentsRes.data || [],
  }
}

export async function saveOrgUnit(unit) {
  const payload = {
    name: unit.name.trim(), unit_type: unit.unit_type || 'team',
    parent_id: unit.parent_id ? Number(unit.parent_id) : null,
    manager_member_id: unit.manager_member_id ? Number(unit.manager_member_id) : null,
    description: unit.description || '', sort_order: Number(unit.sort_order || 0),
    updated_at: new Date().toISOString(),
  }
  const query = unit.id
    ? supabase.from('org_units').update(payload).eq('id', Number(unit.id))
    : supabase.from('org_units').insert([payload])
  const { error } = await query
  if (error) throw error
}

export async function deleteOrgUnit(id) {
  const { error } = await supabase.from('org_units').delete().eq('id', Number(id))
  if (error) throw error
}

export async function saveMemberRoleProfile(profile) {
  const { error } = await supabase.from('member_role_profiles').upsert({
    member_id: Number(profile.member_id),
    org_unit_id: profile.org_unit_id ? Number(profile.org_unit_id) : null,
    job_title: profile.job_title || '', role_summary: profile.role_summary || '',
    responsibilities: profile.responsibilities || [], authority_scope: profile.authority_scope || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'member_id' })
  if (error) throw error
}

export async function saveMboObjective(objective) {
  const payload = {
    member_id: Number(objective.member_id),
    org_unit_id: objective.org_unit_id ? Number(objective.org_unit_id) : null,
    year: Number(objective.year), title: objective.title.trim(),
    description: objective.description || '', metric: objective.metric || '',
    target_value: objective.target_value || '', current_value: objective.current_value || '',
    weight: Number(objective.weight || 0), progress: Number(objective.progress || 0),
    status: objective.status || 'planned', due_date: objective.due_date || null,
    updated_at: new Date().toISOString(),
  }
  const query = objective.id
    ? supabase.from('mbo_objectives').update(payload).eq('id', Number(objective.id))
    : supabase.from('mbo_objectives').insert([payload])
  const { error } = await query
  if (error) throw error
}

export async function deleteMboObjective(id) {
  const { error } = await supabase.from('mbo_objectives').delete().eq('id', Number(id))
  if (error) throw error
}

export async function saveWorkResponsibility(responsibility, assignments) {
  const payload = {
    org_unit_id: responsibility.org_unit_id ? Number(responsibility.org_unit_id) : null,
    title: responsibility.title.trim(), description: responsibility.description || '',
    output_definition: responsibility.output_definition || '', cycle: responsibility.cycle || '',
    sort_order: Number(responsibility.sort_order || 0), updated_at: new Date().toISOString(),
  }
  let responsibilityId = responsibility.id ? Number(responsibility.id) : null
  if (responsibilityId) {
    const { error } = await supabase.from('work_responsibilities').update(payload).eq('id', responsibilityId)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('work_responsibilities').insert([payload]).select('id').single()
    if (error) throw error
    responsibilityId = data.id
  }
  const { error: deleteError } = await supabase.from('responsibility_assignments').delete().eq('responsibility_id', responsibilityId)
  if (deleteError) throw deleteError
  const rows = Object.entries(assignments || {}).flatMap(([type, memberIds]) =>
    (memberIds || []).map(memberId => ({ responsibility_id: responsibilityId, member_id: Number(memberId), assignment_type: type }))
  )
  if (rows.length) {
    const { error } = await supabase.from('responsibility_assignments').insert(rows)
    if (error) throw error
  }
}

export async function deleteWorkResponsibility(id) {
  const { error } = await supabase.from('work_responsibilities').delete().eq('id', Number(id))
  if (error) throw error
}

const mapAdminMember = (member) => ({
  ID: String(member.id),
  아이디: member.login_id,
  이름: member.name,
  직위: member.position,
  부서: member.department,
  이메일: member.email,
  상태: member.status,
  승인됨: member.approved,
  역할: member.role || 'member',
  입사일: member.joined_at,
  오늘의한마디: member.message || '',
  스킬: member.skills || [],
  계정연결: Boolean(member.authLinked),
  이메일확인: Boolean(member.emailConfirmed),
  최근로그인: member.lastSignInAt,
})

export async function adminGetMembers() {
  const data = await invokeAdminMembers('list')
  return (data.members || []).map(mapAdminMember)
}

export async function adminCreateMember(fields) {
  return invokeAdminMembers('create', {
    loginId: fields.아이디,
    password: fields.비밀번호,
    name: fields.이름,
    position: fields.직위,
    department: fields.부서,
    email: fields.이메일,
    joinedAt: fields.입사일,
    status: fields.상태,
    role: fields.역할,
    message: fields.오늘의한마디,
  })
}

export async function adminUpdateMember(memberId, fields) {
  return invokeAdminMembers('update', {
    memberId,
    loginId: fields.아이디,
    name: fields.이름,
    position: fields.직위,
    department: fields.부서,
    email: fields.이메일,
    joinedAt: fields.입사일,
    status: fields.상태,
    role: fields.역할,
    message: fields.오늘의한마디,
  })
}

// 가입 승인: pending -> active (로그인 가능해짐)
export async function adminApproveMember(memberId) {
  return invokeAdminMembers('approve', { memberId })
}

// 비밀번호 재설정: 팀장이 팀원의 로그인 비밀번호를 새로 정해준다.
// 비밀번호는 해시로만 저장되어 조회가 불가능하므로 '확인'이 아니라 '재설정'만 지원한다.
// service_role 키는 브라우저에 노출하지 않고 관리자용 Edge Function을 경유한다.
export async function adminResetMemberPassword(memberId, newPassword) {
  return invokeAdminMembers('reset-password', { memberId, password: newPassword })
}

// 본인 비밀번호 변경 (팀원 누구나)
export async function changeMyPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

// 팀원 삭제: members 행 삭제 → 해당 계정은 로그인 불가 (Auth 계정 자체는 남음)
export async function adminDeleteMember(memberId) {
  return invokeAdminMembers('delete', { memberId })
}

// ==============================================================================
// 7-2. [ADMIN] 퀵링크(대시보드 공유 링크) 관리 - 관리자 전용
// ==============================================================================
export async function createQuickLink(name, url, userName = '관리자') {
  const { error } = await supabase.from('quick_links').insert([{ name, url }])
  if (error) throw error
  await logActivity(userName, `님이 퀵링크 [${name}]를 추가했습니다.`)
}

export async function updateQuickLink(id, name, url, userName = '관리자') {
  const { error } = await supabase.from('quick_links').update({ name, url }).eq('id', id)
  if (error) throw error
  await logActivity(userName, `님이 퀵링크 [${name}]를 수정했습니다.`)
}

export async function deleteQuickLink(id, userName = '관리자') {
  const { error } = await supabase.from('quick_links').delete().eq('id', id)
  if (error) throw error
  await logActivity(userName, `님이 퀵링크를 삭제했습니다.`)
}

// ==============================================================================
// 8. [UTILITY] 샘플 데이터 및 호환성
// ==============================================================================
export function getSampleData() {
  return { 
    currentUser: { 이름: '게스트' }, members: [], tasks: [], projects: [], 
    archives: [], posts: [], schedules: [], activities: [], quickLinks: [] 
  }
}

export async function createTodo(newTodo) {
  return createTask({
    제목: newTodo.항목, 담당자명: newTodo.담당자, 프로젝트ID: newTodo.projectID
  })
}
export async function toggleTodo(todoId, status) {
  return toggleTaskStatus(todoId, status)
}
export async function deleteTodo(todoId) {
  return deleteTask(todoId)
}
