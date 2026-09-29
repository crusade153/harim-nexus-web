import 'server-only'
import { validateReview } from './review-utils.mjs'

// reserve/settle는 매 HTTP 시도마다 호출한다. JSON 재시도도 일/월 한도에 포함.
// 두 번째 인자는 AI 검토 라운드(숫자) 또는 응답 검증 함수.
export async function runDeepSeek(messages, roundOrValidate, { reserve, settle, maxTokens = 2048, timeoutMs = 30000 }) {
  const model = process.env.DEEPSEEK_MODEL
  if (!process.env.DEEPSEEK_API_KEY || !model) throw new Error('비서몬 모델·API 키 설정이 필요합니다.')
  const validate = typeof roundOrValidate === 'function' ? roundOrValidate : value => validateReview(value, roundOrValidate)
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  for (let attempt = 0; attempt < 2; attempt++) {
    const callId = await reserve(messages)
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs), cache: 'no-store',
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, reasoning_effort: 'none', response_format: { type: 'json_object' }, max_tokens: maxTokens, stream: false }),
    })
    if (!response.ok) throw new Error(`비서몬 연결 오류 (${response.status})`)
    const data = await response.json()
    await settle(callId, data.usage)
    try { return { ...validate(JSON.parse(data.choices?.[0]?.message?.content)), model } }
    catch (error) { if (attempt === 1) throw error }
  }
}
