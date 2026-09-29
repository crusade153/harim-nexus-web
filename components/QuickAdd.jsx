'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, X, Loader2, User, CalendarDays, Flag } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createTask } from '@/lib/sheets'
import { entityUrl, TASKS_CHANGED_EVENT } from '@/lib/links'
import { parseQuickTask } from '@/lib/work-os-utils.mjs'

const localToday = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD (브라우저 시간대)

function isTypingTarget(element) {
  if (!element) return false
  const tag = element.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable
}

// 헤더의 "+ 업무" 버튼과 N 단축키로 여는 한 줄 업무 추가
export default function QuickAdd() {
  const router = useRouter()
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [me, setMe] = useState(null)
  const [members, setMembers] = useState([])

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(document.activeElement)) return
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    if (members.length > 0) return
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('members').select('id,name,auth_id,status').order('name')
      const active = (data || []).filter(member => member.status !== 'pending')
      setMembers(active)
      setMe(active.find(member => member.auth_id === user?.id) || null)
    }
    load()
  }, [open, members.length])

  const parsed = useMemo(() => parseQuickTask(text, localToday()), [text])
  const assignee = useMemo(() => {
    if (!parsed.assigneeName) return me
    return members.find(member => member.name === parsed.assigneeName) || null
  }, [parsed.assigneeName, members, me])
  const unknownAssignee = Boolean(parsed.assigneeName) && !assignee && members.length > 0

  const close = () => { setOpen(false); setText('') }

  const submit = async event => {
    event.preventDefault()
    if (!parsed.title) return toast.error('업무 제목을 입력하세요.')
    if (unknownAssignee) return toast.error(`'${parsed.assigneeName}' 팀원을 찾을 수 없습니다.`)
    setSaving(true)
    try {
      const created = await createTask({
        제목: parsed.title,
        내용: '',
        우선순위: parsed.priority,
        담당자명: assignee?.name || me?.name || '',
        담당자ID: assignee?.id || me?.id || null,
        시작일: localToday(),
        마감일: parsed.dueDate,
      })
      toast.success(t => (
        <span className="flex items-center gap-3">
          업무를 추가했습니다.
          {created?.id && <button className="font-bold text-indigo-600" onClick={() => { toast.dismiss(t.id); router.push(entityUrl('task', created.id)) }}>열기</button>}
        </span>
      ))
      close()
      window.dispatchEvent(new Event(TASKS_CHANGED_EVENT))
    } catch (error) {
      toast.error(error.message || '업무 추가에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="업무 빠르게 추가 (N)"
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
      >
        <Plus size={16} /><span className="hidden sm:inline">업무</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[15vh]" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
          <form onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape') close() }} className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">업무 빠르게 추가</h2>
              <button type="button" onClick={close} aria-label="닫기" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            <input
              ref={inputRef}
              value={text}
              onChange={event => setText(event.target.value)}
              placeholder="예: 월마감 원가표 검토 @홍길동 ~금 !높음"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <User size={12} />{unknownAssignee ? <span className="text-rose-500">'{parsed.assigneeName}' 없음</span> : (assignee?.name || '나')}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <CalendarDays size={12} />{parsed.dueDate || '마감일 없음'}
              </span>
              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Flag size={12} />{parsed.priority}
              </span>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-400">
              <b>@이름</b> 담당자 · <b>~금</b>, <b>~내일</b>, <b>~10/5</b> 마감일 · <b>!높음</b>, <b>!긴급</b> 우선순위 · 나머지는 제목
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={close} className="btn-secondary text-sm">취소</button>
              <button disabled={saving || !parsed.title} className="btn-primary flex items-center gap-2 text-sm">
                {saving && <Loader2 size={15} className="animate-spin" />}추가 (Enter)
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
