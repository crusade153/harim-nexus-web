import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Next의 server-only 표식만 제거하여 실제 HTTP 드라이버를 Node에서 격리 검증한다.
const source = (await readFile(new URL('../lib/ai/deepseek.js', import.meta.url), 'utf8'))
  .replace("import 'server-only'", '')
  .replace("'./review-utils.mjs'", JSON.stringify(new URL('../lib/ai/review-utils.mjs', import.meta.url).href))
const { runDeepSeek } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const valid = { questions: [], summary: { done: '완료', evidence: '문서', next: '공유', risks: '없음' }, risk_level: 'low' }
const input = [{ role: 'user', content: '테스트 JSON' }]

async function withProvider(fn) {
  const fetch = globalThis.fetch
  const key = process.env.DEEPSEEK_API_KEY, model = process.env.DEEPSEEK_MODEL
  process.env.DEEPSEEK_API_KEY = 'fake-unit-test'; process.env.DEEPSEEK_MODEL = 'fake-model'
  try { await fn() } finally {
    globalThis.fetch = fetch
    if (key === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = key
    if (model === undefined) delete process.env.DEEPSEEK_MODEL; else process.env.DEEPSEEK_MODEL = model
  }
}
test('JSON 오류 1회만 재시도, 두 요청 모두 예산 예약·실사용 기록', async () => withProvider(async () => {
  let calls = 0, reserved = 0, settled = 0
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).response_format.type, 'json_object')
    assert.equal(JSON.parse(options.body).reasoning_effort, 'none')
    assert.ok(options.signal instanceof AbortSignal)
    calls++
    return Response.json({ choices: [{ message: { content: calls === 1 ? 'invalid' : JSON.stringify(valid) } }], usage: { prompt_tokens: 20, completion_tokens: 10 } })
  }
  const result = await runDeepSeek(input, 2, { reserve: async () => ++reserved, settle: async () => settled++ })
  assert.equal(result.model, 'fake-model')
  assert.deepEqual([calls, reserved, settled], [2, 2, 2])
}))
test('JSON이 계속 잘못되면 2회 이후 종료', async () => withProvider(async () => {
  let calls = 0
  globalThis.fetch = async () => { calls++; return Response.json({ choices: [{ message: { content: '{}' } }] }) }
  await assert.rejects(runDeepSeek(input, 0, { reserve: async () => 1, settle: async () => {} }), /형식 오류/)
  assert.equal(calls, 2)
}))
test('예산 예약 실패 시 외부 전송하지 않음', async () => withProvider(async () => {
  globalThis.fetch = async () => assert.fail('예산 부족 시 fetch 금지')
  await assert.rejects(runDeepSeek(input, 0, { reserve: async () => { throw new Error('월 예산 부족') }, settle: async () => {} }), /월 예산 부족/)
}))
test('제공자 HTTP 오류는 자동 재시도하지 않고 예약 유지', async () => withProvider(async () => {
  let calls = 0, settles = 0
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429 }) }
  await assert.rejects(runDeepSeek(input, 0, { reserve: async () => 1, settle: async () => settles++ }), /429/)
  assert.equal(calls, 1)
  assert.equal(settles, 0)
}))
