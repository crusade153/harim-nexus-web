import { supabase } from '@/lib/supabase'
import { entityUrl } from '@/lib/links'

export const DEFAULT_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

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
const MEMBER_COLUMNS = 'id,auth_id,login_id,name,position,department,email,status,approved,role,joined_at,message,skills'
const DEFAULT_SECTIONS = ['tasks', 'posts', 'archives', 'projects', 'members', 'schedules', 'quickLinks', 'activities']

function assertQuery(label, response) {
  if (response?.error) {
    const error = new Error(`${label} 조회 실패: ${response.error.message}`)
    error.cause = response.error
    throw error
  }
  return response?.data || []
}

async function getActorContext() {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return { authId: null, memberId: null }
  const { data: member, error } = await supabase
    .from('members')
    .select('id,name')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (error) throw error
  return { authId: user.id, memberId: member?.id || null, memberName: member?.name || null }
}

async function resolveMemberId(memberId, memberName) {
  if (memberId) return Number(memberId)
  if (!memberName) return null
  const { data, error } = await supabase
    .from('members')
    .select('id')
    .eq('name', memberName)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.id || null
}

async function softDelete(table, ids) {
  const { authId } = await getActorContext()
  const idList = (Array.isArray(ids) ? ids : [ids]).map(Number)
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: authId })
    .in('id', idList)
  if (error) throw error
}

async function dispatchAutomationEvent(triggerType, eventPayload) {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) return
    const response = await fetch('/api/automations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ triggerType, eventPayload })
    })
    if (!response.ok && response.status !== 207) {
      const body = await response.json().catch(() => ({}))
      console.warn('자동화 이벤트 처리 실패:', body.error || response.status)
    }
  } catch (error) {
    console.warn('자동화 이벤트 전달 실패:', error?.message || error)
  }
}

function toCurrentUser(member, authUser) {
  if (member) {
    return {
      ID: member.id.toString(),
      이름: member.name,
      직위: member.position,
      부서: member.department,
      이메일: member.email,
      아이디: member.login_id,
      역할: member.role || 'member'
    }
  }
  if (authUser) {
    return {
      ID: authUser.id,
      이름: authUser.user_metadata?.name || '승인 대기 사용자',
      이메일: authUser.email,
      직위: '미정',
      부서: '미정',
      역할: 'pending'
    }
  }
  return { 이름: '게스트', ID: 'guest', 역할: 'guest' }
}

// 각 화면이 필요한 데이터만 명시해서 페이지뷰당 DB 호출과 전송량을 제한한다.
export async function getRealData({ sections = DEFAULT_SECTIONS } = {}) {
  try {
    const requested = new Set(sections)
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    const user = authData?.user || null

    const queries = {}
    if (requested.has('tasks')) {
      queries.tasks = supabase.from('tasks')
        .select('id,created_at,title,status,priority,assignee,assignee_member_id,due_date,start_date,content,project_id,parent_id,is_key_task,acceptance_criteria,deliverable_url,delay_reason,predecessor_id,wbs_order,related_doc_id')
        .is('deleted_at', null).order('due_date', { ascending: true }).limit(500)
    }
    if (requested.has('posts')) {
      queries.posts = supabase.from('posts')
        .select('id,created_at,title,tag,content,author_name,author_member_id,views')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(100)
    }
    if (requested.has('archives')) {
      queries.archives = supabase.from('archives')
        .select('id,created_at,category,title,link,content,author,author_member_id')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(200)
    }
    if (requested.has('projects')) {
      queries.projects = supabase.from('projects')
        .select('id,created_at,title,author,author_member_id,period,problem,direction,goal')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(200)
    }
    if (requested.has('members')) {
      queries.members = supabase.from('members').select(MEMBER_COLUMNS).order('joined_at', { ascending: true }).limit(500)
    } else if (user) {
      queries.currentMember = supabase.from('members').select(MEMBER_COLUMNS).eq('auth_id', user.id).maybeSingle()
    }
    if (requested.has('schedules')) {
      queries.schedules = supabase.from('schedules')
        .select('id,type,sub_type,content,date,time,target')
        .is('deleted_at', null).order('date', { ascending: true }).limit(500)
    }
    if (requested.has('quickLinks')) {
      queries.quickLinks = supabase.from('quick_links')
        .select('id,name,url').is('deleted_at', null).order('id', { ascending: true }).limit(50)
    }
    if (requested.has('activities')) {
      queries.activities = supabase.from('activities')
        .select('id,user_name,action,created_at').order('created_at', { ascending: false }).limit(10)
    }

    if (requested.has('tasks') || requested.has('posts') || requested.has('archives')) {
      const types = []
      if (requested.has('tasks')) types.push('task')
      if (requested.has('posts')) types.push('post')
      if (requested.has('archives')) types.push('archive')
      queries.comments = supabase.from('comments')
        .select('id,entity_type,entity_id,content,author_name,author_member_id,created_at')
        .in('entity_type', types).is('deleted_at', null).order('created_at', { ascending: true }).limit(1000)
    }

    const entries = await Promise.all(Object.entries(queries).map(async ([key, query]) => [key, await query]))
    const raw = Object.fromEntries(entries.map(([key, response]) => [key, assertQuery(key, response)]))
    const membersList = raw.members || []
    const currentMember = raw.currentMember || membersList.find(m => m.auth_id === user?.id || m.email === user?.email) || null
    const currentUser = toCurrentUser(currentMember, user)

    const commentsByEntity = new Map()
    for (const comment of raw.comments || []) {
      const key = `${comment.entity_type}:${comment.entity_id}`
      if (!commentsByEntity.has(key)) commentsByEntity.set(key, [])
      commentsByEntity.get(key).push({
        ID: comment.id,
        작성자: comment.author_name,
        내용: comment.content,
        시간: comment.created_at ? comment.created_at.split('T')[0] : ''
      })
    }

    const tasks = (raw.tasks || []).map(t => ({
      ID: t.id.toString(),
      제목: t.title,
      상태: t.status,
      우선순위: t.priority,
      담당자명: t.assignee,
      담당자ID: t.assignee_member_id ? t.assignee_member_id.toString() : null,
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
      댓글: commentsByEntity.get(`task:${t.id}`) || []
    }))

    const projects = (raw.projects || []).map(p => ({
      ID: p.id.toString(),
      제목: p.title,
      작성자: p.author,
      생성일: p.created_at || '',
      기간: p.period || '',
      문제점: p.problem || '',
      개선방향: p.direction || '',
      개선목표: p.goal || '',
      todos: tasks.filter(t => t.프로젝트ID === p.id.toString()).map(t => ({
        ID: t.ID, 항목: t.제목, 담당자: t.담당자명, 완료: t.완료,
        상태: t.상태, 마감일: t.마감일, 우선순위: t.우선순위
      }))
    }))

    const archives = (raw.archives || []).map(a => {
      const comments = commentsByEntity.get(`archive:${a.id}`) || []
      return {
        ID: a.id.toString(), 카테고리: a.category, 제목: a.title, 링크: a.link || '',
        내용: a.content || '', 작성자: a.author, 날짜: a.created_at ? a.created_at.split('T')[0] : '',
        댓글: comments, 댓글수: comments.length
      }
    })

    const posts = (raw.posts || []).map(p => {
      const comments = commentsByEntity.get(`post:${p.id}`) || []
      return {
        ID: p.id.toString(), 태그: p.tag, 제목: p.title, 내용: p.content,
        작성자명: p.author_name, 날짜: p.created_at ? p.created_at.split('T')[0] : '',
        조회수: p.views || 0, 댓글: comments, 댓글수: comments.length
      }
    })

    const members = membersList.map(m => ({
      ID: m.id.toString(), 아이디: m.login_id, 이름: m.name, 직위: m.position,
      부서: m.department, 이메일: m.email, 상태: m.status,
      승인됨: m.approved, 역할: m.role || 'member', 계정연결: Boolean(m.auth_id),
      입사일: m.joined_at, 오늘의한마디: m.message || '', 스킬: m.skills || []
    })).sort((a, b) => {
      // 관리자를 맨 앞에, 나머지는 가입 순서 유지
      return Number(b.역할 === 'admin') - Number(a.역할 === 'admin')
    })

    const schedules = (raw.schedules || []).map(s => ({
      ID: s.id.toString(), 유형: s.type, 세부유형: s.sub_type, 내용: s.content,
      날짜: s.date, 시간: s.time, 대상자: s.target || '전체'
    }))
    const quickLinks = (raw.quickLinks || []).map(l => ({ ID: l.id.toString(), 이름: l.name, URL: l.url }))
    const activities = (raw.activities || []).map(a => ({
      ID: a.id.toString(), 사용자: a.user_name, 행동: a.action,
      시간: a.created_at ? new Date(a.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
    }))

    return {
      currentUser, members, tasks, projects, archives, posts, schedules,
      holidays: [{ date: '2026-01-01', name: '신정' }, { date: '2026-02-16', name: '설날 연휴' }],
      quickLinks, activities
    }
  } catch (error) {
    console.error('데이터 로딩 실패:', error)
    return { ...getSampleData(), loadError: error?.message || '데이터를 불러오지 못했습니다.' }
  }
}

// ==============================================================================
// 2. [WRITE] 게시판(Board) 관리 함수
// ==============================================================================
export async function createPost(newPost) {
  const actor = await getActorContext()
  const { data, error } = await supabase.from('posts').insert([{
    title: newPost.제목, 
    tag: newPost.태그, 
    content: newPost.내용, 
    author_name: newPost.작성자명,
    author_member_id: actor.memberId
  }]).select('id').single()
  if (error) throw error
  await logActivity(newPost.작성자명, `님이 게시글 [${newPost.제목}]을 작성했습니다.`)
  return data
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
  await softDelete('posts', postId)
  await logActivity(userName, `님이 게시글을 휴지통으로 이동했습니다.`)
}

// ==============================================================================
// 3. [WRITE] 댓글(Comment) 관리 함수
// ==============================================================================
export async function createComment(newComment) {
  const actor = await getActorContext()
  const entityType = newComment.entityType
  if (!['task', 'post', 'archive', 'project'].includes(entityType)) {
    throw new Error('댓글 대상 유형이 필요합니다.')
  }
  const { error } = await supabase.from('comments').insert([{
    post_id: Number(newComment.postID),
    entity_type: entityType,
    entity_id: Number(newComment.postID),
    content: newComment.content, 
    author_name: newComment.authorName,
    author_member_id: actor.memberId
  }])
  if (error) throw error

  const mentionedNames = [...new Set((newComment.content.match(/@[\p{L}\p{N}._-]+/gu) || []).map(value => value.slice(1)))]
  if (mentionedNames.length > 0) {
    const { data: mentionedMembers, error: memberError } = await supabase
      .from('members').select('id,name,login_id').or(mentionedNames.map(name => `name.eq.${name},login_id.eq.${name}`).join(','))
    if (memberError) throw memberError
    const rows = (mentionedMembers || [])
      .filter(member => member.id !== actor.memberId)
      .map(member => ({
        workspace_id: DEFAULT_WORKSPACE_ID,
        recipient_member_id: member.id,
        actor_member_id: actor.memberId,
        kind: 'mention',
        title: `${newComment.authorName}님이 회원님을 언급했습니다.`,
        body: newComment.content.slice(0, 240),
        entity_type: entityType,
        entity_id: String(newComment.postID),
        action_url: entityUrl(entityType, newComment.postID)
      }))
    if (rows.length > 0) {
      const { error: notificationError } = await supabase.from('notifications').insert(rows)
      if (notificationError) console.warn('멘션 알림 생성 실패:', notificationError.message)
    }
  }
}

export async function deleteComment(commentId) {
  await softDelete('comments', commentId)
}

// ==============================================================================
// 4. [WRITE] 아카이브(Archive) 관리 함수
// ==============================================================================
export async function createArchive(newDoc) {
  const actor = await getActorContext()
  const { error } = await supabase.from('archives').insert([{
    category: newDoc.카테고리, 
    title: newDoc.제목, 
    link: newDoc.링크, 
    content: newDoc.내용, 
    author: newDoc.작성자,
    author_member_id: actor.memberId
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
  await softDelete('archives', docId)
  await logActivity(userName, `님이 지식고 문서를 휴지통으로 이동했습니다.`)
}

// ==============================================================================
// 5. [WRITE] 프로젝트(Project) 관리 함수
// ==============================================================================
export async function createProject(newProject) {
  const actor = await getActorContext()
  const { error } = await supabase.from('projects').insert([{
    title: newProject.제목,
    author: newProject.작성자,
    period: newProject.기간,
    problem: newProject.문제점 || null,
    direction: newProject.개선방향 || null,
    goal: newProject.개선목표 || null,
    author_member_id: actor.memberId
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
  const { data: projectTasks, error } = await supabase
    .from('tasks').select('id').eq('project_id', projectId).is('deleted_at', null)
  if (error) throw error
  if (projectTasks?.length) await softDelete('tasks', projectTasks.map(task => task.id))
  await softDelete('projects', projectId)
  await logActivity(userName, `님이 프로젝트와 하위 업무를 휴지통으로 이동했습니다.`)
}

// ==============================================================================
// 6. [WRITE] 업무(Tasks) 관리 - 통합 로직
// ==============================================================================
export async function createTask(newTask) {
  const actor = await getActorContext()
  const assigneeMemberId = await resolveMemberId(newTask.담당자ID, newTask.담당자명)
  const row = {
    title: newTask.제목,
    status: '대기',
    priority: newTask.우선순위 || '보통',
    assignee: newTask.담당자명,
    due_date: newTask.마감일,
    start_date: newTask.시작일 || newTask.마감일,
    content: newTask.내용,
    project_id: newTask.프로젝트ID ? Number(newTask.프로젝트ID) : null,
    related_doc_id: newTask.관련문서ID ? Number(newTask.관련문서ID) : null,
    assignee_member_id: assigneeMemberId,
    created_by_member_id: actor.memberId
  }
  if (newTask.상위업무ID) row.parent_id = Number(newTask.상위업무ID)
  if (newTask.주요업무) row.is_key_task = true
  if (newTask.완료기준) row.acceptance_criteria = newTask.완료기준
  if (newTask.산출물링크) row.deliverable_url = newTask.산출물링크
  if (newTask.지연사유) row.delay_reason = newTask.지연사유
  if (newTask.선행업무ID) row.predecessor_id = Number(newTask.선행업무ID)
  if (newTask.WBS순서 !== undefined) row.wbs_order = Number(newTask.WBS순서) || 0
  let createdTask = null
  const { data, error } = await supabase.from('tasks').insert([row]).select('id').single()
  createdTask = data
  if (error) {
    if (isMissingAdvancedWbsColumn(error)) {
      const { data: retryData, error: retryError } = await supabase
        .from('tasks').insert([stripAdvancedWbsColumns(row)]).select('id').single()
      if (retryError) throw retryError
      createdTask = retryData
    } else {
      throw error
    }
  }
  // 배정·댓글·완료 알림은 02_p1_phase_a.sql의 DB 트리거에서 생성한다.
  await logActivity(newTask.담당자명, `님이 새 업무 [${newTask.제목}]을 등록했습니다.`)
  await dispatchAutomationEvent('task_created', {
    taskId: createdTask.id,
    title: newTask.제목,
    status: '대기',
    priority: newTask.우선순위 || '보통',
    assigneeMemberId
  })
  return createdTask
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
  if(updates.상태) dbUpdates.status = updates.상태
  if(updates.담당자명) {
    dbUpdates.assignee = updates.담당자명
    dbUpdates.assignee_member_id = await resolveMemberId(updates.담당자ID, updates.담당자명)
  }
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
  if (updates.상태) {
    await dispatchAutomationEvent('task_status_changed', {
      taskId: Number(taskId), status: updates.상태, title: updates.제목 || ''
    })
  }
}

export async function createWbsOutlineTasks(projectId, outlineItems, userName = '사용자') {
  const createdByIndex = new Map()
  const actor = await getActorContext()
  const assigneeNames = [...new Set(outlineItems.map(item => item.assignee).filter(Boolean))]
  const { data: assigneeMembers, error: memberError } = assigneeNames.length
    ? await supabase.from('members').select('id,name').in('name', assigneeNames)
    : { data: [], error: null }
  if (memberError) throw memberError
  const memberIdByName = new Map((assigneeMembers || []).map(member => [member.name, member.id]))

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
      assignee_member_id: memberIdByName.get(item.assignee) || null,
      created_by_member_id: actor.memberId,
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
  if (updates.담당자명) {
    dbUpdates.assignee = updates.담당자명
    dbUpdates.assignee_member_id = await resolveMemberId(updates.담당자ID, updates.담당자명)
  }
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
  if (updates.상태) {
    await dispatchAutomationEvent('task_status_changed', { taskIds: ids, status: updates.상태, batch: true })
  }
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
  await dispatchAutomationEvent('task_status_changed', { taskId: Number(idParam), status: newStatus })
}

export async function toggleTaskStatus(taskId, currentIsDone) {
  const newStatus = currentIsDone ? '대기' : '완료'
  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
  if (error) throw error
  await dispatchAutomationEvent('task_status_changed', { taskId: Number(taskId), status: newStatus })
}

// ✅ [수정] 삭제 시 userName 받기
export async function deleteTask(taskId, userName = '사용자') {
  let ids = [Number(taskId)]
  let frontier = [Number(taskId)]

  while (frontier.length > 0) {
    const { data: children, error } = await supabase
      .from('tasks').select('id').in('parent_id', frontier).is('deleted_at', null)
    if (error) throw error
    const childIds = (children || []).map(c => c.id).filter(id => !ids.includes(id))
    if (childIds.length === 0) break
    ids = ids.concat(childIds)
    frontier = childIds
  }

  await softDelete('tasks', ids)
  await logActivity(userName, `님이 업무를 휴지통으로 이동했습니다.`)
}

export async function getProjectTasks(projectId) {
  if (!projectId) return []
  const { data, error } = await supabase
    .from('tasks')
    .select('id,created_at,title,status,priority,assignee,assignee_member_id,due_date,start_date,content,project_id,parent_id,is_key_task,acceptance_criteria,deliverable_url,delay_reason,predecessor_id,wbs_order,related_doc_id')
    .eq('project_id', projectId)
    .is('deleted_at', null)
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
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !session) throw new Error('로그인이 필요합니다.')
  const response = await fetch('/api/admin/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.error) throw new Error(data?.error || '회원 관리 요청에 실패했습니다.')
  return data
}

// ==============================================================================
// 7-1. 캘린더 전용 조회 및 근태 일정
// 전체 워크스페이스 데이터를 읽지 않고 캘린더에 필요한 테이블만 조회합니다.
// ==============================================================================
export async function getCalendarData() {
  const { data: { user } } = await supabase.auth.getUser()
  const [tasksRes, membersRes, schedulesRes, attendanceRes] = await Promise.all([
    supabase.from('tasks').select('id,title,status,assignee,due_date').is('deleted_at', null).not('due_date', 'is', null).order('due_date'),
    supabase.from('members').select('id,auth_id,name,position,department,role').order('joined_at'),
    supabase.from('schedules').select('id,type,sub_type,content,date,time,target').is('deleted_at', null).order('date'),
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
    supabase.from('org_units').select('id,name,unit_type,parent_id,manager_member_id,description,sort_order,active,created_at,updated_at').order('sort_order').order('name'),
    supabase.from('member_role_profiles').select('id,member_id,org_unit_id,job_title,role_summary,responsibilities,authority_scope,updated_at'),
    supabase.from('mbo_objectives').select('id,member_id,org_unit_id,year,title,description,metric,target_value,current_value,weight,progress,status,due_date,created_at,updated_at').order('year', { ascending: false }).order('weight', { ascending: false }),
    supabase.from('work_responsibilities').select('id,org_unit_id,title,description,output_definition,cycle,active,sort_order,created_at,updated_at').order('sort_order').order('title'),
    supabase.from('responsibility_assignments').select('id,responsibility_id,member_id,assignment_type,created_at'),
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
// service_role 키는 브라우저에 노출하지 않고 서버 라우트(/api/admin/members)를 경유한다.
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
  await softDelete('quick_links', id)
  await logActivity(userName, `님이 퀵링크를 휴지통으로 이동했습니다.`)
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
