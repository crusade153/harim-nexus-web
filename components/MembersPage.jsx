'use client'
import { useState } from 'react'
import { Mail, Calendar, ShieldCheck, Crown, Settings2, Trash2, Check, X, UserCheck, KeyRound, Shuffle, Copy, UserPlus, Link2Off, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminCreateMember, adminUpdateMember, adminApproveMember, adminDeleteMember, adminResetMemberPassword } from '@/lib/sheets'
import { isAdmin as isAdminUser, isSystemAdmin } from '@/lib/roles'
import { isValidPin, PIN_RULE_MESSAGE } from '@/lib/auth-id'

// 임시 PIN (숫자 6자리)
const generateTempPassword = () => Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')

// 업무부하 계산 로직
const calculateWorkload = (member, tasks, projects) => {
  let score = 0
  const activeTasks = tasks?.filter(t => t.담당자명 === member.이름 && t.상태 === '진행중') || []
  score += activeTasks.length * 15
  let activeTodos = 0
  projects?.forEach(p => {
    activeTodos += p.todos.filter(todo => todo.담당자 === member.이름 && !todo.완료).length
  })
  score += activeTodos * 5
  return Math.min(score, 100)
}

const STATUS_OPTIONS = [
  { value: 'active', label: '승인됨 (active)' },
  { value: '온라인', label: '온라인' },
  { value: '자리비움', label: '자리비움' },
  { value: '오프라인', label: '오프라인' },
  { value: 'pending', label: '승인 대기 (pending)' },
]

export default function MembersPage({ members, tasks, projects, currentUser, onRefresh }) {
  // 관리자 ID 정의
  const isAdmin = isAdminUser(currentUser)

  const [editingMember, setEditingMember] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [form, setForm] = useState({ 아이디: '', 이름: '', 직위: '', 부서: '', 이메일: '', 입사일: '', 상태: 'active', 역할: 'member', 오늘의한마디: '', 비밀번호: '' })
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [lastIssuedPw, setLastIssuedPw] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showIssuedPassword, setShowIssuedPassword] = useState(false)

  const openEdit = (m) => {
    setEditingMember(m)
    setIsCreating(false)
    setForm({
      아이디: m.아이디 || '', 이름: m.이름 || '', 직위: m.직위 || '', 부서: m.부서 || '',
      이메일: m.이메일 || '', 입사일: m.입사일 || '', 상태: m.상태 || 'active',
      역할: m.역할 || 'member', 오늘의한마디: m.오늘의한마디 || '', 비밀번호: ''
    })
    setNewPassword('')
    setLastIssuedPw('')
    setShowPassword(false)
    setShowIssuedPassword(false)
  }

  const openCreate = () => {
    setEditingMember(null)
    setIsCreating(true)
    setForm({
      아이디: '', 이름: '', 직위: '', 부서: '', 이메일: '',
      입사일: new Date().toISOString().slice(0, 10), 상태: 'active', 역할: 'member',
      오늘의한마디: '', 비밀번호: generateTempPassword(),
    })
    setNewPassword('')
    setLastIssuedPw('')
    setShowPassword(false)
    setShowIssuedPassword(false)
  }

  const handleResetPassword = async () => {
    if (!isValidPin(newPassword)) return toast.error(PIN_RULE_MESSAGE)
    if (!confirm(`${editingMember.이름}님의 비밀번호를 새로 설정합니다.\n기존 비밀번호는 즉시 사용할 수 없게 됩니다.`)) return

    setPwSaving(true)
    try {
      await adminResetMemberPassword(editingMember.ID, newPassword)
      setLastIssuedPw(newPassword)
      setNewPassword('')
      setShowPassword(false)
      setShowIssuedPassword(false)
      toast.success(`${editingMember.이름}님의 비밀번호가 재설정되었습니다.`)
      onRefresh && onRefresh()
    } catch (e) {
      toast.error(e.message || '비밀번호 재설정 실패')
    } finally {
      setPwSaving(false)
    }
  }

  const handleSave = async () => {
    if (!form.아이디 || !form.이름) return toast.error('아이디와 이름을 입력하세요.')
    try {
      if (isCreating) {
        if (!isValidPin(form.비밀번호)) return toast.error(PIN_RULE_MESSAGE)
        await adminCreateMember(form)
        toast.success(`${form.이름}님의 로그인 계정과 회원 정보가 생성되었습니다.`)
      } else {
        await adminUpdateMember(editingMember.ID, form)
        toast.success('팀원 정보가 수정되었습니다.')
      }
      setEditingMember(null)
      setIsCreating(false)
      onRefresh && onRefresh()
    } catch (e) { toast.error(e.message || '회원 저장에 실패했습니다.') }
  }

  const handleApprove = async (m) => {
    try {
      await adminApproveMember(m.ID)
      toast.success(`${m.이름}님의 가입을 승인했습니다.`)
      onRefresh && onRefresh()
    } catch (e) { toast.error('승인 실패') }
  }

  const handleDelete = async (m) => {
    if (isSystemAdmin(m)) return toast.error('관리자 계정은 삭제할 수 없습니다.')
    if (!confirm(`${m.이름}님을 팀에서 삭제하시겠습니까?\n삭제 후 해당 계정은 로그인할 수 없습니다.`)) return
    try {
      await adminDeleteMember(m.ID)
      toast.success('팀에서 삭제되었습니다.')
      setEditingMember(null)
      onRefresh && onRefresh()
    } catch (e) { toast.error('삭제 실패') }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            팀원 관리 <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{members?.length || 0}명</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            원가팀 멤버 현황 및 업무 부하를 모니터링합니다. (가입순 정렬)
            {isAdmin && <span className="ml-2 text-indigo-500 font-bold">· 관리자 모드: 회원 추가 또는 카드의 관리 버튼에서 계정과 정보를 수정하세요.</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <UserPlus size={16} /> 회원 추가
            </button>
          )}
          <button onClick={onRefresh} className="btn-secondary">데이터 동기화</button>
        </div>
      </div>

      {/* 멤버 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {members?.map((member, index) => {
          const workload = calculateWorkload(member, tasks, projects)
          // 시스템 관리자 확인
          const isSysAdmin = isSystemAdmin(member)
          const isPending = member.상태 === 'pending'

          return (
            <div
              key={index}
              className={`bg-white dark:bg-slate-800 border rounded-xl p-6 hover:shadow-lg dark:hover:shadow-none hover:-translate-y-1 transition-all duration-300 relative group
                ${isSysAdmin ? 'border-indigo-300 dark:border-indigo-500 ring-1 ring-indigo-100 dark:ring-indigo-900' : isPending ? 'border-amber-300 dark:border-amber-500/50 ring-1 ring-amber-100 dark:ring-amber-900/40' : 'border-slate-200 dark:border-slate-700'}
              `}
            >
              {/* 관리자 전용: 팀원 관리 버튼 */}
              {isAdmin && (
                <button
                  onClick={() => openEdit(member)}
                  title="팀원 정보 관리"
                  className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/50 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 dark:text-slate-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/10 transition-colors"
                >
                  <Settings2 size={14} /> 관리
                </button>
              )}

              {/* 프로필 섹션 */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-2xl font-bold mb-3 border-4 border-white dark:border-slate-800 shadow-sm">
                    {member.이름[0]}
                  </div>
                  {/* 관리자 왕관 아이콘 */}
                  {isSysAdmin && (
                    <div className="absolute -top-2 -right-2 bg-yellow-400 text-white p-1 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" title="최고 관리자">
                      <Crown size={14} fill="currentColor" />
                    </div>
                  )}
                  <div className={`absolute bottom-3 right-0 w-5 h-5 rounded-full border-4 border-white dark:border-slate-800 ${
                    member.상태 === '온라인' || member.상태 === 'active' ? 'bg-green-500' :
                    member.상태 === '자리비움' ? 'bg-yellow-500' : 'bg-slate-400'
                  }`} />
                </div>

                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  {member.이름}
                  {isSysAdmin && <ShieldCheck size={16} className="text-indigo-500" />}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{member.직위} · {member.부서}</p>

                {/* 상태 뱃지 */}
                <div className={`mt-3 px-3 py-1 rounded-full text-xs font-bold border ${
                  isSysAdmin
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800'
                    : isPending
                    ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                }`}>
                  {isSysAdmin ? 'System Admin' : isPending ? '승인 대기' : member.상태}
                </div>
                {isAdmin && member.계정연결 === false && (
                  <div className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 p-2.5 dark:border-red-500/30 dark:bg-red-500/10">
                    <div className="flex items-center justify-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                      <Link2Off size={13} /> 로그인 계정 연결 필요
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(member)}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600"
                    >
                      <KeyRound size={13} /> 계정 복구
                    </button>
                  </div>
                )}

                {/* 관리자 전용: 승인 대기 멤버 처리 버튼 */}
                {isAdmin && isPending && (
                  <div className="flex gap-2 mt-3 w-full">
                    <button
                      onClick={() => handleApprove(member)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold transition-colors"
                    >
                      <Check size={14} /> 가입 승인
                    </button>
                    <button
                      onClick={() => handleDelete(member)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-xs font-bold transition-colors"
                    >
                      <X size={14} /> 거절
                    </button>
                  </div>
                )}
              </div>

              {/* 상세 정보 */}
              <div className="space-y-3 py-4 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Mail size={16} className="text-slate-400"/>
                  <span className="truncate">{member.이메일}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                  <Calendar size={16} className="text-slate-400"/>
                  <span>입사일: {member.입사일 || '-'}</span>
                </div>
                {/* 가입 인사말 표시 */}
                {member.오늘의한마디 && (
                  <div className="text-xs text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg mt-2 italic">
                    "{member.오늘의한마디}"
                  </div>
                )}
              </div>

              {/* 업무 부하 게이지 */}
              <div className="mt-2">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Current Workload</span>
                  <span className={`text-xs font-bold ${
                    workload > 80 ? 'text-red-500' : workload > 50 ? 'text-orange-500' : 'text-green-500'
                  }`}>{workload}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      workload > 80 ? 'bg-red-500' : workload > 50 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${workload}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 관리자 전용: 팀원 정보 관리 모달 */}
      {isAdmin && (editingMember || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                {isCreating ? <UserPlus size={20} className="text-indigo-500" /> : <UserCheck size={20} className="text-indigo-500" />}
                {isCreating ? '새 회원 추가' : '팀원 정보 관리'}
              </h3>
              <button onClick={() => { setEditingMember(null); setIsCreating(false) }}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 p-0.5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">로그인 아이디</label>
                <input autoComplete="off" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm font-mono" value={form.아이디} onChange={e => setForm({ ...form, 아이디: e.target.value.toLowerCase() })} placeholder="영문 소문자·숫자 3~32자" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">이름</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.이름} onChange={e => setForm({ ...form, 이름: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">직위</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.직위} onChange={e => setForm({ ...form, 직위: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">담당 업무</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.부서} onChange={e => setForm({ ...form, 부서: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">이메일</label>
                <input type="email" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.이메일} onChange={e => setForm({ ...form, 이메일: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">입사일</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.입사일} onChange={e => setForm({ ...form, 입사일: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">상태</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.상태} onChange={e => setForm({ ...form, 상태: e.target.value })}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    {!STATUS_OPTIONS.some(o => o.value === form.상태) && <option value={form.상태}>{form.상태}</option>}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">권한</label>
                <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" value={form.역할} onChange={e => setForm({ ...form, 역할: e.target.value })}>
                  <option value="member">일반 회원</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">소개 / 메모</label>
                <textarea className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm resize-none" rows={2} value={form.오늘의한마디} onChange={e => setForm({ ...form, 오늘의한마디: e.target.value })} />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ※ 상태를 '승인 대기'로 바꾸면 해당 팀원은 로그인이 차단됩니다.
              </p>

              {/* 비밀번호 재설정 */}
              {isCreating ? (
                <div className="pt-4 mt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase"><KeyRound size={13} className="text-amber-500" /> 초기 PIN (숫자 6자리)</label>
                  <div className="flex gap-2">
                    <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white text-sm font-mono" value={form.비밀번호} onChange={e => setForm({ ...form, 비밀번호: e.target.value })} />
                    <button type="button" onClick={() => setShowPassword(value => !value)} title={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'} className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                    <button type="button" onClick={() => setForm({ ...form, 비밀번호: generateTempPassword() })} className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600"><Shuffle size={16} /></button>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(form.비밀번호); toast.success('초기 비밀번호를 복사했습니다.') }} title="비밀번호 복사" className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600"><Copy size={16} /></button>
                  </div>
                  <p className="text-[11px] text-slate-400">저장 전 복사해 안전한 채널로 전달하세요. 저장 후에는 다시 조회할 수 없습니다.</p>
                </div>
              ) : <div className="pt-4 mt-2 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  <KeyRound size={13} className="text-amber-500" /> 비밀번호 재설정
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 dark:text-white text-sm font-mono"
                    placeholder="새 PIN (숫자 6자리)" inputMode="numeric" maxLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(value => !value)}
                    title={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                    className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300 dark:hover:text-amber-400 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPassword(generateTempPassword())}
                    title="임시 비밀번호 자동 생성"
                    className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-amber-600 hover:border-amber-300 dark:hover:text-amber-400 transition-colors"
                  >
                    <Shuffle size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={pwSaving || !isValidPin(newPassword)}
                    className="px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {pwSaving ? '적용 중...' : '적용'}
                  </button>
                </div>

                {lastIssuedPw && (
                  <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase">발급된 새 비밀번호</p>
                      <p className="font-mono text-sm text-amber-900 dark:text-amber-200 truncate">{showIssuedPassword ? lastIssuedPw : '••••••••'}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={() => setShowIssuedPassword(value => !value)} className="text-amber-700 dark:text-amber-400" title={showIssuedPassword ? '숨기기' : '보기'}>{showIssuedPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(lastIssuedPw)
                          toast.success('복사했습니다. 창을 닫으면 다시 볼 수 없습니다.')
                        }}
                        className="flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        <Copy size={13} /> 복사
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ※ 비밀번호는 암호화되어 저장되므로 <b>기존 비밀번호는 조회할 수 없습니다.</b> 팀원이 잊었다면 여기서 새로 정해 알려주세요.
                  본인은 로그인 후 <b>내 상태 설정</b>에서 직접 변경할 수 있습니다.
                </p>
              </div>}
            </div>

            <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              {!isCreating && !isSystemAdmin(editingMember) ? (
                <button onClick={() => handleDelete(editingMember)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-1">
                  <Trash2 size={15} /> 팀에서 삭제
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => { setEditingMember(null); setIsCreating(false) }} className="btn-secondary">취소</button>
                <button onClick={handleSave} className="btn-primary">{isCreating ? '계정 생성' : '저장'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
