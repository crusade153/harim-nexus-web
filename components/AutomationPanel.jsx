'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Activity, Bot, CheckCircle2, Loader2, Send, Trash2, Webhook } from 'lucide-react'
import {
  deleteAutomation, deleteWebhook, runAutomation, saveAutomation, saveWebhook,
  setAutomationEnabled, setWebhookEnabled, testWebhook
} from '@/lib/work-os'
import {
  ACTIONS, buildRule, conditionKey, describeRule, describeRun, emptyRuleForm,
  PRIORITIES, RECIPES, STATUSES, TRIGGERS
} from '@/lib/automation-utils.mjs'
import { maskWebhookUrl, WEBHOOK_SAMPLE_PAYLOAD, webhookTarget } from '@/lib/webhook-utils.mjs'

const formatTime = value => (value ? new Date(value).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-')

function Step({ number, title, children }) {
  return <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/40 dark:text-slate-300"><b className="text-sm text-slate-800 dark:text-white"><span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">{number}</span>{title}</b><p className="mt-2">{children}</p></div>
}

function Label({ children, hint }) {
  return <div className="mb-1.5"><p className="text-xs font-bold text-slate-600 dark:text-slate-300">{children}</p>{hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}</div>
}

export default function AutomationPanel({ data, onReload }) {
  const me = data.identity.member
  const people = useMemo(() => (data.members || []).filter(member => member.status !== 'pending'), [data.members])
  const webhooks = data.webhooks || []
  const activeWebhooks = webhooks.filter(item => item.enabled)
  const [form, setForm] = useState(emptyRuleForm)
  const [saving, setSaving] = useState(false)

  const trigger = TRIGGERS.find(item => item.value === form.triggerType)
  const key = conditionKey(form.triggerType)
  const built = buildRule(form, { meId: me.id })
  const preview = built.rule ? describeRule(built.rule, { webhooks, members: people }) : null

  const applyRecipe = recipe => {
    const next = { ...emptyRuleForm(), ...recipe.form, endpointId: recipe.form.actionType === 'webhook' ? activeWebhooks[0]?.id || '' : '' }
    setForm(next)
    if (recipe.form.actionType === 'webhook' && !activeWebhooks.length) toast('먼저 아래 “웹훅 등록”에서 메시지를 받을 주소를 추가해 주세요.', { icon: 'ℹ️' })
  }
  const setTrigger = value => setForm({ ...form, triggerType: value, conditionValue: '', actionType: value === 'manual' && form.actionType === 'update_task' ? 'notify' : form.actionType })

  const save = async event => {
    event.preventDefault()
    if (built.error) return toast.error(built.error)
    setSaving(true)
    try { await saveAutomation(built.rule); toast.success('자동화 규칙을 저장했습니다. 지금부터 동작합니다.'); setForm(emptyRuleForm()); onReload() } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }
  const act = async (fn, message) => { try { await fn(); if (message) toast.success(message); onReload() } catch (error) { toast.error(error.message) } }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">자동화·웹훅</h2>
        <p className="mt-1 text-sm text-slate-500">“이런 일이 생기면 → 이렇게 처리해라”를 한 번만 정해 두면 Nexus 가 알아서 실행합니다.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Step number={1} title="메신저 연결 (선택)">Google Chat·Slack 으로 메시지를 보내려면 먼저 <b>웹훅</b> 주소를 등록하고 “테스트 전송”으로 확인합니다. Nexus 알림만 쓸 거면 건너뛰어도 됩니다.</Step>
        <Step number={2} title="규칙 만들기">아래 “자주 쓰는 규칙”을 누르면 폼이 채워집니다. <b>언제 → 무엇을</b> 두 가지만 고르면 됩니다.</Step>
        <Step number={3} title="결과 확인">규칙 카드에 마지막 실행 결과(성공·실패와 이유)가 표시됩니다. 웹훅은 전송 기록도 남습니다.</Step>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">자주 쓰는 규칙 (누르면 폼이 채워져요)</h3>
        <div className="flex flex-wrap gap-2">{RECIPES.map(recipe => <button key={recipe.id} type="button" onClick={() => applyRecipe(recipe)} className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300">{recipe.label}</button>)}</div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <form onSubmit={save} className="h-fit space-y-5 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white"><Bot size={18} />새 자동화 규칙</div>
          <input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field w-full" placeholder="규칙 이름 (예: 마감일 아침 알림)" aria-label="규칙 이름" />

          <div>
            <Label>① 언제 실행할까요?</Label>
            <div className="grid gap-2">{TRIGGERS.map(item => <label key={item.value} className={`cursor-pointer rounded-xl border p-3 text-xs transition ${form.triggerType === item.value ? 'border-indigo-500 bg-white shadow-sm dark:bg-slate-900' : 'border-slate-200 hover:border-indigo-200 dark:border-slate-700'}`}><input type="radio" name="trigger" className="sr-only" checked={form.triggerType === item.value} onChange={() => setTrigger(item.value)} /><b className="text-sm text-slate-800 dark:text-white">{item.label}</b><p className="mt-1 text-slate-500">{item.when}</p></label>)}</div>
            {key && (
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                {key === 'status' ? '이 상태로 바뀔 때만' : '이 우선순위 업무만'}
                <select value={form.conditionValue} onChange={e => setForm({ ...form, conditionValue: e.target.value })} className="input-field" aria-label="조건">
                  <option value="">전체</option>{(key === 'status' ? STATUSES : PRIORITIES).map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            )}
          </div>

          <div>
            <Label>② 무엇을 할까요?</Label>
            <select value={form.actionType} onChange={e => setForm({ ...form, actionType: e.target.value })} className="input-field w-full" aria-label="동작">{ACTIONS.map(item => <option key={item.value} value={item.value} disabled={item.value === 'update_task' && form.triggerType === 'manual'}>{item.label}</option>)}</select>
            <p className="mt-1.5 text-[11px] text-slate-400">{ACTIONS.find(item => item.value === form.actionType)?.help}</p>

            {form.actionType === 'notify' && (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">받는 사람
                  <select value={form.recipient} onChange={e => setForm({ ...form, recipient: e.target.value })} className="input-field flex-1" aria-label="받는 사람">
                    <option value="assignee">그 업무의 담당자{form.triggerType === 'manual' ? ' (수동 실행은 실행한 나)' : ''}</option>
                    <option value="me">나 ({me.name})</option>
                    {people.filter(person => person.id !== me.id).map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input-field w-full" placeholder="알림 제목 (비우면 규칙 이름) 예: 오늘 마감: {업무}" aria-label="알림 제목" />
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} className="input-field w-full" rows={2} placeholder="알림 내용. {업무} {상태} {우선순위} 는 실제 값으로 바뀝니다." aria-label="알림 내용" />
              </div>
            )}
            {form.actionType === 'update_task' && (
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">바꿀 상태<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input-field" aria-label="바꿀 상태">{STATUSES.map(value => <option key={value}>{value}</option>)}</select></label>
            )}
            {form.actionType === 'webhook' && (
              <div className="mt-3">
                {activeWebhooks.length === 0
                  ? <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">사용 가능한 웹훅이 없습니다. 아래 <b>웹훅 등록</b>에서 먼저 추가해 주세요.</p>
                  : <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">보낼 곳<select value={form.endpointId} onChange={e => setForm({ ...form, endpointId: e.target.value })} className="input-field flex-1" aria-label="보낼 웹훅"><option value="">웹훅을 고르세요</option>{activeWebhooks.map(item => <option key={item.id} value={item.id}>{item.name} ({webhookTarget(item.endpoint_url).label})</option>)}</select></label>}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-indigo-200 bg-white p-3 text-xs leading-relaxed dark:border-indigo-900 dark:bg-slate-900">
            {preview ? <p><b className="text-indigo-600">{preview.when}</b><span className="text-slate-400"> → </span><b className="text-slate-800 dark:text-white">{preview.what}</b></p> : <p className="text-slate-400">{built.error}</p>}
            {trigger?.example && <p className="mt-1 text-slate-400">예) {trigger.example}</p>}
          </div>
          <button disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="mx-auto animate-spin" size={18} /> : '규칙 저장'}</button>
        </form>

        <RuleList data={data} people={people} webhooks={webhooks} act={act} />
      </div>

      <WebhookSection data={data} webhooks={webhooks} onReload={onReload} act={act} />
    </div>
  )
}

function RuleList({ data, people, webhooks, act }) {
  const rules = data.automations || []
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">등록된 규칙 ({rules.length})</h3>
      <div className="space-y-3">
        {rules.length === 0 && <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-800/40"><CheckCircle2 className="mb-2 text-slate-300" size={24} />아직 규칙이 없습니다. 위의 “자주 쓰는 규칙”으로 시작해 보세요.</div>}
        {rules.map(rule => {
          const sentence = describeRule(rule, { webhooks, members: people })
          const last = describeRun((data.automationRuns || []).find(item => item.rule_id === rule.id))
          return (
            <div key={rule.id} className={`rounded-2xl border p-4 ${rule.enabled ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} /><h4 className="truncate font-bold text-slate-900 dark:text-white">{rule.name}</h4></div>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300"><b className="text-indigo-600">{sentence.when}</b> → {sentence.what}</p>
                  <p className={`mt-1 text-xs ${last.tone === 'error' ? 'text-rose-500' : 'text-slate-400'}`}>최근 실행: {last.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {rule.trigger_type === 'manual' && rule.enabled && <button onClick={() => act(() => runAutomation(rule.id), '자동화를 실행했습니다.')} className="btn-primary text-xs"><Activity size={14} /> 실행</button>}
                  <button onClick={() => act(() => setAutomationEnabled(rule.id, !rule.enabled), rule.enabled ? '규칙을 껐습니다.' : '규칙을 켰습니다.')} className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{rule.enabled ? '끄기' : '켜기'}</button>
                  <button onClick={() => { if (window.confirm(`'${rule.name}' 규칙을 삭제할까요? 실행 기록도 함께 지워집니다.`)) act(() => deleteAutomation(rule.id), '삭제했습니다.') }} aria-label="규칙 삭제" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function WebhookSection({ data, webhooks, onReload, act }) {
  const [webhookForm, setWebhookForm] = useState({ name: '', url: '' })
  const [testing, setTesting] = useState('')
  const [showSample, setShowSample] = useState(false)
  const target = webhookTarget(webhookForm.url)
  const deliveries = data.webhookDeliveries || []
  const lastDelivery = id => deliveries.find(item => item.endpoint_id === id)
  const nameOf = id => webhooks.find(item => item.id === id)?.name || '삭제된 웹훅'

  const add = async event => {
    event.preventDefault()
    try { await saveWebhook(webhookForm); toast.success('웹훅을 등록했습니다. “테스트 전송”으로 연결을 확인해 보세요.'); setWebhookForm({ name: '', url: '' }); onReload() } catch (error) { toast.error(error.message) }
  }
  const test = async endpoint => {
    setTesting(endpoint.id)
    try { await testWebhook(endpoint.id); toast.success(`「${endpoint.name}」로 테스트 메시지를 보냈습니다. 받는 곳에서 확인하세요.`) } catch (error) { toast.error(error.message) } finally { setTesting(''); onReload() }
  }

  return (
    <section className="space-y-4 border-t border-slate-100 pt-8 dark:border-slate-800">
      <div className="flex items-center gap-2"><Webhook size={20} className="text-indigo-600" /><h3 className="text-base font-bold text-slate-900 dark:text-white">웹훅 (외부 메신저 연결)</h3></div>
      <p className="text-sm text-slate-500">웹훅은 “이 주소로 메시지를 보내 주세요”라는 <b>주소(URL)</b> 하나입니다. 메신저에서 주소를 복사해 붙여 넣으면 자동화 규칙이 그곳으로 메시지를 보냅니다.</p>
      <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
        <div className="space-y-4">
          <form onSubmit={add} className="space-y-3 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <div className="font-bold text-slate-800 dark:text-white">웹훅 등록</div>
            <input required maxLength={100} value={webhookForm.name} onChange={e => setWebhookForm({ ...webhookForm, name: e.target.value })} className="input-field w-full" placeholder="이름 (예: 원가팀 Chat)" aria-label="웹훅 이름" />
            <input required type="url" pattern="https://.*" value={webhookForm.url} onChange={e => setWebhookForm({ ...webhookForm, url: e.target.value })} className="input-field w-full" placeholder="https://chat.googleapis.com/v1/spaces/…" aria-label="웹훅 주소" />
            {webhookForm.url && <p className="text-[11px] text-indigo-600">인식된 형식: <b>{target.label}</b>{target.textOnly ? ' — 메시지 문장만 보냅니다.' : ' — JSON 데이터(메시지 문장 포함)를 보냅니다.'}</p>}
            <button className="btn-secondary w-full">웹훅 추가</button>
            <details className="text-[11px] leading-relaxed text-slate-500">
              <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">주소는 어디서 받나요?</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li><b>Google Chat</b>: 스페이스 이름 옆 ▼ → 앱 및 통합 → 웹훅 → 새 웹훅 만들기 → URL 복사</li>
                <li><b>Slack</b>: 앱 관리 → Incoming Webhooks 활성화 → “Add New Webhook” 주소 복사</li>
                <li><b>Zapier·Make·n8n</b>: “Webhook” 트리거를 만들면 나오는 주소</li>
                <li>주소에는 비밀 토큰이 들어 있어 화면에는 도메인만 보이고, <b>https://</b> 주소만 쓸 수 있습니다.</li>
              </ul>
            </details>
          </form>
          <div>
            <button type="button" onClick={() => setShowSample(!showSample)} className="text-xs font-semibold text-indigo-600 hover:underline">{showSample ? '보내는 내용 예시 닫기' : '일반 JSON 수신 시 보내는 내용 예시 보기'}</button>
            {showSample && <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{JSON.stringify(WEBHOOK_SAMPLE_PAYLOAD, null, 2)}</pre>}
          </div>
        </div>

        <div className="space-y-3">
          {webhooks.length === 0 && <div className="flex min-h-28 flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-800/40"><Webhook className="mb-2 text-slate-300" size={24} />등록된 웹훅이 없습니다.</div>}
          {webhooks.map(endpoint => {
            const last = lastDelivery(endpoint.id)
            return (
              <div key={endpoint.id} className={`rounded-2xl border p-4 ${endpoint.enabled ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="truncate font-bold text-slate-900 dark:text-white">{endpoint.name}</h4>
                    <p className="mt-1 text-xs text-slate-500">{webhookTarget(endpoint.endpoint_url).label} · {maskWebhookUrl(endpoint.endpoint_url)}</p>
                    <p className={`mt-1 text-xs ${last?.status === 'failed' ? 'text-rose-500' : 'text-slate-400'}`}>{last ? `최근 전송: ${last.status === 'success' ? '성공' : last.status === 'failed' ? `실패 (${last.error_message || last.response_status})` : '대기'} · ${formatTime(last.created_at)}` : '아직 전송한 적이 없습니다. 테스트 전송으로 확인해 보세요.'}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => test(endpoint)} disabled={testing === endpoint.id || !endpoint.enabled} className="btn-secondary text-xs">{testing === endpoint.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 테스트 전송</button>
                    <button onClick={() => act(() => setWebhookEnabled(endpoint.id, !endpoint.enabled), endpoint.enabled ? '웹훅을 껐습니다.' : '웹훅을 켰습니다.')} className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{endpoint.enabled ? '끄기' : '켜기'}</button>
                    <button onClick={() => { if (window.confirm(`웹훅 '${endpoint.name}'을 삭제할까요? 이 웹훅을 쓰는 규칙은 실행에 실패합니다.`)) act(() => deleteWebhook(endpoint.id), '삭제했습니다.') }} aria-label="웹훅 삭제" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            )
          })}
          {deliveries.length > 0 && (
            <details className="rounded-2xl border border-slate-200 p-4 text-xs dark:border-slate-800">
              <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-200">전송 기록 (최근 {Math.min(deliveries.length, 10)}건)</summary>
              <table className="mt-3 w-full text-left"><tbody>{deliveries.slice(0, 10).map(item => <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-1.5 pr-2 text-slate-400">{formatTime(item.created_at)}</td><td className="pr-2 text-slate-600 dark:text-slate-300">{nameOf(item.endpoint_id)}</td><td className="pr-2 text-slate-400">{item.event_type}</td><td className={item.status === 'failed' ? 'text-rose-500' : 'text-emerald-600'}>{item.status === 'success' ? '성공' : item.status === 'failed' ? item.error_message || '실패' : '대기'}</td></tr>)}</tbody></table>
            </details>
          )}
        </div>
      </div>
    </section>
  )
}
