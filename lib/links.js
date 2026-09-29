// 다른 곳(빠른 추가 등)에서 업무를 바꿨을 때 열려 있는 목록 화면이 다시 불러오도록 알리는 신호
export const TASKS_CHANGED_EVENT = 'nexus:tasks-changed'

// 알림·검색·목록에서 항목을 누르면 해당 항목이 바로 열리는 주소.
// 각 화면은 이 쿼리 값(task/post/doc/project)을 받으면 그 항목을 선택해 연다.
export function entityUrl(entityType, entityId) {
  const id = encodeURIComponent(String(entityId ?? ''))
  switch (entityType) {
    case 'task': return `/kanban?task=${id}`
    case 'post': return `/board?post=${id}`
    case 'archive': return `/archive?doc=${id}`
    case 'project': return `/timeline?project=${id}`
    case 'weekly_report': return '/weekly'
    case 'ai_review': return `/ai?review=${id}`
    default: return '/work'
  }
}
