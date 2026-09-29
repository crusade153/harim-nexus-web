// AI 친구 완료 점검: 서버·테스트 공용 순수 함수

const cut = (value, max) => {
  const text = String(value ?? '').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// 외부로 보내는 업무 정보는 점검 질문에 필요한 칸만, 길이를 잘라서 남긴다.
export function checkTaskSnapshot(task) {
  return {
    title: cut(task.title, 300),
    content: cut(task.content, 4000),
    priority: task.priority || '',
    due_date: task.due_date || '',
    acceptance_criteria: cut(task.acceptance_criteria, 1000),
    deliverable_url: cut(task.deliverable_url, 500),
    delay_reason: cut(task.delay_reason, 1000),
  }
}

// AI 외부 전송이 꺼져 있거나 실패했을 때 쓰는 기본 점검 질문 (외부 전송 없음)
export function defaultCheckQuestions(task) {
  const questions = []
  if (task.acceptance_criteria?.trim()) questions.push(`완료 기준("${cut(task.acceptance_criteria, 80)}")을 모두 채웠는지 확인해 보셨나요? 어떻게 확인했는지 적어 주세요.`)
  questions.push(task.deliverable_url?.trim()
    ? '산출물 링크에 최종본이 올라가 있는지 한 번 더 열어 보셨나요? 확인한 내용을 적어 주세요.'
    : '결과물(파일·보고서·시스템 반영)은 어디에 남겨 두셨나요? 나중에 찾을 수 있게 위치를 적어 주세요.')
  questions.push('숫자나 결과를 원천 자료(SAP·MES·기준 자료)와 대조해 보셨나요? 무엇과 어떻게 맞춰 봤는지 적어 주세요.')
  questions.push('요청하신 분이나 관련 부서에 결과를 공유하셨나요? 남은 후속 조치가 있다면 함께 적어 주세요.')
  return questions.slice(0, 4)
}

export function validateCheckQuestions(value) {
  const questions = value?.questions
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 4) throw new Error('AI 점검 질문 형식 오류')
  const cleaned = questions.map(q => (typeof q === 'string' ? q.trim() : ''))
  if (cleaned.some(q => !q || q.length > 400)) throw new Error('AI 점검 질문 형식 오류')
  return { questions: cleaned }
}

// 주간보고 초안에 넣을 한 줄 요약 (질문마다 답변을 짧게)
export function checkDigest(check, max = 160) {
  if (!check?.questions?.length || !Array.isArray(check.answers)) return ''
  return check.questions.map((q, i) => `  점검: ${cut(q, 60)} → ${cut(check.answers[i], max)}`).join('\n')
}
