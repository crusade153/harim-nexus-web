'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarClock, CheckCircle2, Loader2, Pause, Pencil, Play, Plus, Repeat, Trash2, Users, X } from 'lucide-react'
import { createTaskFromTemplate, deleteTaskTemplate, saveTaskTemplate, setTaskTemplateActive } from '@/lib/work-os'
import { buildRecurrenceRule, describeRecurrence, nextRecurrenceRuns, ruleToForm, WEEKDAY_CHOICES } from '@/lib/recurrence.mjs'
import { addBusinessDays } from '@/lib/closing-utils.mjs'
import { seoulDate } from '@/lib/weekly-utils.mjs'

const MODES = [
  { id: 'none', label: '필요할 때만', hint: '카드의 + 버튼으로 직접 만듭니다.' },
  { id: 'daily', label: '매 영업일', hint: '평일 아침마다 자동으로 만듭니다.' },
  { id: 'weekly', label: '매주', hint: '고른 요일 아침에 자동으로 만듭니다.' },
  { id: 'monthly', label: '매월', hint: '고른 날짜 아침에 자동으로 만듭니다.' }
]
const OFFSETS = [0, 1, 2, 3, 4, 5, 7, 10, 15, 20]
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const emptyForm = () => ({ id: null, name: '', content: '', defaultPriority: '보통', mode: 'none', weekdays: [1], monthday: 1, dueOffsetDays: 0, assigneeIds: null })

function formatDay(date) {
  const [, month, day] = date.split('-').map(Number)
  return `${month}/${day}(${DAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()]})`
}

function Chip({ active, onClick, children, title }) {
  return <button type="button" title={title} onClick={onClick} aria-pressed={active} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:text-slate-300'}`}>{children}</button>
}

function Field({ label, hint, children }) {
  return <div><p className="mb-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">{label}</p>{children}{hint && <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{hint}</p>}</div>
}

export default function TemplatesPanel({ templates, members, holidays, me, onReload }) {
  const people = useMemo(() => members.filter(member => member.status !== 'pending'), [members])
  const nameOf = id => people.find(person => person.id === id)?.name || '(탈퇴/미승인)'
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState(null)
  const today = seoulDate()

  const assigneeIds = form.assigneeIds ?? [me.id]
  const rule = buildRecurrenceRule(form)
  const nextRuns = useMemo(() => nextRecurrenceRuns(rule, today, holidays, 3), [rule, today, holidays])
  const toggleAssignee = id => {
    const next = assigneeIds.includes(id) ? assigneeIds.filter(value => value !== id) : [...assigneeIds, id]
    setForm({ ...form, assigneeIds: next })
  }
  const toggleDay = day => {
    const next = form.weekdays.includes(day) ? form.weekdays.filter(value => value !== day) : [...form.weekdays, day]
    setForm({ ...form, weekdays: next })
  }

  const edit = template => {
    const recurrence = ruleToForm(template.recurrence_rule)
    setForm({
      id: template.id, name: template.name, content: template.content || template.description || '', defaultPriority: template.default_priority || '보통',
      ...recurrence, dueOffsetDays: template.due_offset_days || 0,
      assigneeIds: template.assignee_member_ids?.length ? template.assignee_member_ids : [template.created_by_member_id || me.id]
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async event => {
    event.preventDefault()
    if (form.mode === 'weekly' && !form.weekdays.length) return toast.error('반복할 요일을 하나 이상 골라 주세요.')
    if (!assigneeIds.length) return toast.error('담당자를 한 명 이상 골라 주세요.')
    setSaving(true)
    try {
      await saveTaskTemplate({ ...form, recurrenceRule: rule, assigneeIds, active: true })
      toast.success(form.id ? '템플릿을 수정했습니다.' : '템플릿을 저장했습니다.')
      setForm(emptyForm())
      onReload()
    } catch (error) { toast.error(error.message) } finally { setSaving(false) }
  }

  const toggleActive = async template => {
    try { await setTaskTemplateActive(template.id, !template.active); toast.success(template.active ? '자동 생성을 중지했습니다.' : '다시 사용합니다.'); onReload() } catch (error) { toast.error(error.message) }
  }
  const remove = async template => {
    if (!window.confirm(`'${template.name}' 템플릿을 삭제할까요? 이미 만들어진 업무는 그대로 남습니다.`)) return
    try { await deleteTaskTemplate(template.id); toast.success('삭제했습니다.'); if (form.id === template.id) setForm(emptyForm()); onReload() } catch (error) { toast.error(error.message) }
  }

  const active = templates.filter(template => template.active)
  const paused = templates.filter(template => !template.active)

  return (
    <div>
      <div className="mb-5"><h2 className="text-lg font-bold text-slate-900 dark:text-white">업무 템플릿</h2><p className="mt-1 text-sm text-slate-500">자주 하는 업무를 한 번만 적어 두세요. 필요할 때 버튼으로 만들거나, 정해 둔 날 아침에 알아서 만들어 드립니다.</p></div>
      <div className="mb-6 grid gap-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40"><b className="text-slate-800 dark:text-white">① 저장</b><p className="mt-1">이름·설명·담당자를 적고, “언제 만들까요?”를 고릅니다.</p></div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40"><b className="text-slate-800 dark:text-white">② 만들기</b><p className="mt-1">‘필요할 때만’은 카드의 <Plus size={12} className="inline" /> 로, 반복은 영업일 아침 8:40(한국시간)에 자동 생성됩니다.</p></div>
        <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40"><b className="text-slate-800 dark:text-white">③ 담당자에게 도착</b><p className="mt-1">담당자가 여러 명이면 한 사람에 1건씩 만들어지고 배정 알림이 갑니다. 주말·공휴일은 다음 영업일에 만듭니다.</p></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form onSubmit={save} className="h-fit space-y-4 rounded-2xl bg-slate-50 p-5 dark:bg-slate-800/40">
          <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800 dark:text-white">{form.id ? '템플릿 수정' : '새 템플릿'}</h3>{form.id && <button type="button" onClick={() => setForm(emptyForm())} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"><X size={14} />수정 취소</button>}</div>
          <input required maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field w-full" placeholder="템플릿 이름 (예: 주간회의 자료 준비)" aria-label="템플릿 이름" />
          <textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="input-field w-full" rows={3} placeholder="업무 설명 (선택)" aria-label="업무 설명" />
          <Field label="중요도"><div className="flex flex-wrap gap-2">{['낮음', '보통', '높음', '긴급'].map(level => <Chip key={level} active={form.defaultPriority === level} onClick={() => setForm({ ...form, defaultPriority: level })}>{level}</Chip>)}</div></Field>

          <Field label="언제 만들까요?" hint={MODES.find(mode => mode.id === form.mode).hint}>
            <div className="flex flex-wrap gap-2">{MODES.map(mode => <Chip key={mode.id} active={form.mode === mode.id} onClick={() => setForm({ ...form, mode: mode.id })}>{mode.label}</Chip>)}</div>
            {form.mode === 'weekly' && <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="반복 요일">{WEEKDAY_CHOICES.map(day => <Chip key={day.value} active={form.weekdays.includes(day.value)} onClick={() => toggleDay(day.value)}>{day.label}</Chip>)}</div>}
            {form.mode === 'monthly' && <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">매월<select value={form.monthday} onChange={e => setForm({ ...form, monthday: e.target.value === 'last' ? 'last' : Number(e.target.value) })} className="input-field w-28" aria-label="매월 몇 일">{Array.from({ length: 30 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}일</option>)}<option value="last">말일</option></select></div>}
          </Field>

          {form.mode !== 'none' && (
            <Field label="마감일" hint="자동으로 만들어지는 날을 기준으로, 주말·공휴일을 뺀 영업일로 셉니다.">
              <select value={form.dueOffsetDays} onChange={e => setForm({ ...form, dueOffsetDays: Number(e.target.value) })} className="input-field w-full" aria-label="마감일 기준">{OFFSETS.map(days => <option key={days} value={days}>{days === 0 ? '만든 날 당일' : `만든 날부터 ${days}영업일 뒤`}</option>)}</select>
            </Field>
          )}

          <Field label={`담당자 (${assigneeIds.length}명)`} hint="기본은 작성자(나)입니다. 여러 명을 고르면 한 사람마다 업무가 1건씩 만들어집니다.">
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">{people.map(person => <Chip key={person.id} active={assigneeIds.includes(person.id)} onClick={() => toggleAssignee(person.id)}>{person.name}{person.id === me.id ? ' (나)' : ''}</Chip>)}</div>
          </Field>

          <div className="rounded-xl border border-dashed border-indigo-200 bg-white p-3 text-xs leading-relaxed text-slate-600 dark:border-indigo-900 dark:bg-slate-900 dark:text-slate-300">
            <p className="flex items-center gap-1.5 font-bold text-indigo-600"><CalendarClock size={14} />미리보기</p>
            {form.mode === 'none'
              ? <p className="mt-1">자동으로 만들지 않습니다. 저장 후 카드의 + 버튼으로 필요할 때 만드세요.</p>
              : <p className="mt-1"><b>{describeRecurrence(rule) || '요일을 골라 주세요'}</b> 아침 8:40에 자동 생성 · 담당 {assigneeIds.map(nameOf).join(', ') || '없음'}{nextRuns.length > 0 && <><br />다음 생성: {nextRuns.map(date => `${formatDay(date)}${form.dueOffsetDays ? ` → 마감 ${formatDay(addBusinessDays(date, form.dueOffsetDays, holidays))}` : ''}`).join(' · ')}</>}</p>}
          </div>

          <button disabled={saving} className="btn-primary w-full">{saving ? <Loader2 className="mx-auto animate-spin" size={18} /> : form.id ? '수정 저장' : '템플릿 저장'}</button>
        </form>

        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">사용 중 ({active.length})</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {active.length === 0 && <div className="flex min-h-28 w-full flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-400 dark:bg-slate-800/40 md:col-span-2"><CheckCircle2 className="mb-2 text-slate-300" size={24} />아직 템플릿이 없습니다. 왼쪽에서 첫 템플릿을 만들어 보세요.</div>}
              {active.map(template => <TemplateCard key={template.id} template={template} people={people} me={me} holidays={holidays} open={openId === template.id} onOpen={() => setOpenId(openId === template.id ? null : template.id)} onEdit={() => edit(template)} onToggle={() => toggleActive(template)} onDelete={() => remove(template)} onCreated={() => { setOpenId(null); onReload() }} nameOf={nameOf} />)}
            </div>
          </section>
          {paused.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold text-slate-500">중지됨 ({paused.length}) — 자동 생성하지 않습니다</h3>
              <div className="grid gap-3 md:grid-cols-2">{paused.map(template => <TemplateCard key={template.id} template={template} people={people} me={me} holidays={holidays} paused onEdit={() => edit(template)} onToggle={() => toggleActive(template)} onDelete={() => remove(template)} nameOf={nameOf} />)}</div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ template, people, me, holidays, open, paused, onOpen, onEdit, onToggle, onDelete, onCreated, nameOf }) {
  const ids = template.assignee_member_ids?.length ? template.assignee_member_ids : [template.created_by_member_id || me.id]
  const [dueDate, setDueDate] = useState(() => addBusinessDays(seoulDate(), template.due_offset_days || 0, holidays))
  const [chosen, setChosen] = useState(ids)
  const [busy, setBusy] = useState(false)
  const describe = describeRecurrence(template.recurrence_rule)

  const create = async () => {
    if (!chosen.length) return toast.error('담당자를 골라 주세요.')
    setBusy(true)
    try {
      const count = await createTaskFromTemplate(template, dueDate, chosen.map(id => ({ id, name: nameOf(id) })))
      toast.success(`업무 ${count}건을 만들었습니다.`)
      onCreated?.()
    } catch (error) { toast.error(error.message) } finally { setBusy(false) }
  }

  return (
    <div className={`rounded-2xl border p-4 ${paused ? 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-bold text-slate-800 dark:text-white">{template.name}</h4>
          <p className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${describe ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{describe ? <><Repeat size={11} />{describe}{template.due_offset_days ? ` · 마감 ${template.due_offset_days}영업일 뒤` : ' · 당일 마감'}</> : '필요할 때만 만들기'}</p>
        </div>
        {!paused && <button onClick={onOpen} title="이 템플릿으로 지금 업무 만들기" aria-expanded={open} className="shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950"><Plus size={17} /></button>}
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-slate-500">{template.content || template.description || '설명 없음'}</p>
      <p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><Users size={12} />{template.assignee_member_ids?.length ? template.assignee_member_ids.map(nameOf).join(', ') : `${template.created_by_member_id ? nameOf(template.created_by_member_id) : '작성자'} (작성자)`}</p>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl bg-indigo-50/60 p-3 dark:bg-indigo-950/20">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">마감일<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" /></label>
          <div className="flex flex-wrap gap-1.5">{people.map(person => <Chip key={person.id} active={chosen.includes(person.id)} onClick={() => setChosen(chosen.includes(person.id) ? chosen.filter(id => id !== person.id) : [...chosen, person.id])}>{person.name}</Chip>)}</div>
          <button onClick={create} disabled={busy} className="btn-primary w-full text-sm">{busy ? <Loader2 className="mx-auto animate-spin" size={16} /> : `업무 ${chosen.length}건 만들기`}</button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        <button onClick={onEdit} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={13} />수정</button>
        <button onClick={onToggle} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{paused ? <><Play size={13} />다시 사용</> : <><Pause size={13} />중지</>}</button>
        <button onClick={onDelete} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 size={13} />삭제</button>
      </div>
    </div>
  )
}
