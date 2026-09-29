'use client'
// 업무를 '완료'로 바꾸는 모든 화면은 이 함수를 거친다.
// 레이아웃의 CompletionCheckHost 가 비서몬 점검 창을 띄우고, 답변을 제출하면 서버가 완료 처리한다.
export const COMPLETION_REQUEST_EVENT = 'nexus:completion-request'
export const COMPLETION_HOST_FLAG = '__nexusCompletionHost'

export function requestTaskCompletion(taskId) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window[COMPLETION_HOST_FLAG]) {
      reject(new Error('완료 점검 창을 열 수 없습니다. 새로고침한 뒤 다시 시도해 주세요.'))
      return
    }
    window.dispatchEvent(new CustomEvent(COMPLETION_REQUEST_EVENT, { detail: { taskId: Number(taskId), resolve } }))
  })
}

export async function completeWithCheck(taskId) {
  if (!(await requestTaskCompletion(taskId))) {
    throw Object.assign(new Error('완료를 취소했어요. 업무 상태는 그대로입니다.'), { cancelled: true })
  }
}
