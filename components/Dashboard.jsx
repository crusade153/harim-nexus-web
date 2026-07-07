'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2, Clock, AlertCircle, Calendar, ArrowUpRight,
  Zap, Link as LinkIcon, Activity, Users, User, Plus, Pencil, Trash2, X, Save, ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { createQuickLink, updateQuickLink, deleteQuickLink } from '@/lib/sheets'

const SYS_ADMIN_ID = 'crusade153'

export default function Dashboard({ data, onRefresh }) {
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())

  // 내 아이디/이름 확인
  const myLoginId = data?.currentUser?.아이디
  const myName = data?.currentUser?.이름
  const isAdmin = myLoginId === SYS_ADMIN_ID

  // 팀장은 팀 전체가 기본, 개인은 본인 업무가 기본
  const [viewMode, setViewMode] = useState(isAdmin ? 'team' : 'mine') // 'team' | 'mine'

  // 퀵링크 관리 모달 상태 (관리자 전용)
  const [linkModal, setLinkModal] = useState(null) // null | {mode:'add'} | {mode:'edit', link}
  const [linkForm, setLinkForm] = useState({ 이름: '', URL: '' })
  const [quickLinkForm, setQuickLinkForm] = useState({ 이름: '', URL: '' })
  const [editingQuickLinkId, setEditingQuickLinkId] = useState(null)
  const [editingQuickLinkForm, setEditingQuickLinkForm] = useState({ 이름: '', URL: '' })

  useEffect(() => {
    // 채널명은 Sidebar와 동일해야 함
    const channel = supabase.channel('room_presence')

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState()
        const userIds = new Set()
        for (const id in newState) {
          userIds.add(id)
        }
        setOnlineUserIds(userIds)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const summary = useMemo(() => {
    const rawTasks = data?.tasks || []
    const rawMembers = data?.members || []

    // 개인 보기: 내 담당 업무만
    const scopeTasks = viewMode === 'mine'
      ? rawTasks.filter(t => t.담당자명 === myName)
      : rawTasks

    const members = rawMembers.map(m => {
      const isMe = m.아이디 === myLoginId
      const isOnline = onlineUserIds.has(m.아이디)
      return {
        ...m,
        상태: (isMe || isOnline) ? '온라인' : '오프라인'
      }
    })

    const totalTasks = scopeTasks.length
    const completedTasks = scopeTasks.filter(t => t.상태 === '완료').length
    const progressRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

    const onlineMembers = members.filter(m => m.상태 === '온라인').length

    return {
      progressRate,
      totalTasks,
      onlineMembers,
      totalMembers: members.length,
      urgentTasks: scopeTasks.filter(t => t.우선순위 === '높음' && t.상태 !== '완료'),
      ongoingTasks: scopeTasks.filter(t => t.상태 === '진행중'),
      recentActivities: data?.activities || [],
      quickLinks: data?.quickLinks || [],
      members: members
    }
  }, [data, onlineUserIds, myLoginId, myName, viewMode])

  // ---- 퀵링크 관리 핸들러 (관리자 전용) ----
  const openLinkModal = (link = null) => {
    if (link) { setLinkModal({ mode: 'edit', link }); setLinkForm({ 이름: link.이름, URL: link.URL }) }
    else { setLinkModal({ mode: 'add' }); setLinkForm({ 이름: '', URL: '' }) }
  }

  const handleSaveLink = async () => {
    if (!linkForm.이름 || !linkForm.URL) return toast.error('이름과 URL을 모두 입력하세요.')
    const url = /^https?:\/\//i.test(linkForm.URL) ? linkForm.URL : `https://${linkForm.URL}`
    try {
      if (linkModal.mode === 'edit') {
        await updateQuickLink(linkModal.link.ID, linkForm.이름, url, myName)
        toast.success('링크가 수정되었습니다.')
      } else {
        await createQuickLink(linkForm.이름, url, myName)
        toast.success('링크가 추가되었습니다.')
      }
      setLinkModal(null)
      onRefresh && onRefresh()
    } catch (e) { toast.error('저장 실패 (DB 오류)') }
  }

  const normalizeQuickUrl = (url) => {
    const trimmed = String(url || '').trim()
    if (!trimmed) return ''
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  const handleInlineCreateLink = async () => {
    if (!quickLinkForm.이름.trim() || !quickLinkForm.URL.trim()) return toast.error('링크 이름과 URL을 입력하세요.')
    try {
      await createQuickLink(quickLinkForm.이름.trim(), normalizeQuickUrl(quickLinkForm.URL), myName)
      toast.success('퀵 링크가 추가되었습니다.')
      setQuickLinkForm({ 이름: '', URL: '' })
      onRefresh && onRefresh()
    } catch (e) {
      toast.error('링크 추가 실패')
    }
  }

  const openInlineEditLink = (link) => {
    setEditingQuickLinkId(link.ID)
    setEditingQuickLinkForm({ 이름: link.이름, URL: link.URL })
  }

  const handleInlineUpdateLink = async () => {
    if (!editingQuickLinkForm.이름.trim() || !editingQuickLinkForm.URL.trim()) return toast.error('링크 이름과 URL을 입력하세요.')
    try {
      await updateQuickLink(editingQuickLinkId, editingQuickLinkForm.이름.trim(), normalizeQuickUrl(editingQuickLinkForm.URL), myName)
      toast.success('퀵 링크가 수정되었습니다.')
      setEditingQuickLinkId(null)
      setEditingQuickLinkForm({ 이름: '', URL: '' })
      onRefresh && onRefresh()
    } catch (e) {
      toast.error('링크 수정 실패')
    }
  }

  const handleDeleteLink = async (link) => {
    if (!confirm(`'${link.이름}' 링크를 삭제하시겠습니까?`)) return
    try {
      await deleteQuickLink(link.ID, myName)
      toast.success('링크가 삭제되었습니다.')
      onRefresh && onRefresh()
    } catch (e) { toast.error('삭제 실패') }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {viewMode === 'mine'
              ? <>안녕하세요, {myName || '팀원'}님! 👋</>
              : <>안녕하세요, 원가팀! 👋</>}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {viewMode === 'mine'
              ? '내게 배정된 업무와 팀 소식을 확인하세요.'
              : '팀 전체의 업무 현황과 주요 이슈를 확인하세요.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 팀 전체 / 내 업무 토글 */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs font-bold">
            <button onClick={() => setViewMode('team')} className={`px-3 py-2 flex items-center gap-1.5 ${viewMode === 'team' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><Users size={14} /> 팀 전체</button>
            <button onClick={() => setViewMode('mine')} className={`px-3 py-2 flex items-center gap-1.5 ${viewMode === 'mine' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}><User size={14} /> 내 업무만</button>
          </div>
          <button onClick={onRefresh} className="btn-secondary">
            <ArrowUpRight size={16} /> 동기화
          </button>
        </div>
      </div>

      {/* 상단 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><CheckCircle2 size={20} /></div>
            <span className="badge bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">Live</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{viewMode === 'mine' ? '내 업무 진행률' : '전체 업무 진행률'}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.progressRate}%</p>
          </div>
        </div>

        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400"><Clock size={20} /></div>
            <span className="badge bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">Active</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">진행 중 업무</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.ongoingTasks.length}</p>
          </div>
        </div>

        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><AlertCircle size={20} /></div>
            <span className="badge bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800">Action</span>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">긴급 이슈</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{summary.urgentTasks.length}</p>
          </div>
        </div>

        <div className="card-base p-5 flex flex-col justify-between h-32">
          <div className="flex justify-between items-start">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
              {viewMode === 'mine' ? <CheckCircle2 size={20} /> : <Calendar size={20} />}
            </div>
          </div>
          <div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{viewMode === 'mine' ? '내 업무 수' : '팀원 상태'}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {viewMode === 'mine' ? `${summary.totalTasks}건` : `${summary.onlineMembers}/${summary.totalMembers}명 온라인`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Team Pulse (멤버 상태) — 팀 전체 보기에서만 */}
          {viewMode === 'team' && (
            <div className="card-base p-6">
              <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap size={18} className="text-yellow-500 fill-yellow-500" /> Team Pulse
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.members.map((member, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                        {member.이름[0]}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
                        member.상태 === '온라인' ? 'bg-green-500' : 'bg-slate-300'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{member.이름}</p>
                        <span className={`text-[10px] ${member.상태 === '온라인' ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
                          {member.상태}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">"{member.오늘의한마디 || '화이팅!'}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 우선순위 업무 (최근 6개 제한) */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white">{viewMode === 'mine' ? '내 우선순위 업무' : '우선순위 업무'}</h3>
              <span className="text-xs text-slate-400 font-medium">최근 6건 표시</span>
            </div>
            <div className="space-y-1">
              {summary.urgentTasks.concat(summary.ongoingTasks).slice(0, 6).map((task, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                   <div className="flex items-center gap-3">
                     <span className={`w-1.5 h-1.5 rounded-full ${task.우선순위 === '높음' ? 'bg-red-500' : 'bg-green-500'}`} />
                     <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{task.제목}</span>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-xs text-slate-400">{task.담당자명}</span>
                     <span className={`badge ${task.상태 === '진행중' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                       {task.상태}
                     </span>
                   </div>
                </div>
              ))}
              {summary.urgentTasks.length + summary.ongoingTasks.length === 0 && (
                <div className="text-center py-4 text-slate-400 text-sm">
                  {viewMode === 'mine' ? '내게 배정된 진행 중 업무가 없습니다.' : '진행 중인 우선순위 업무가 없습니다.'}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* 퀵 링크 */}
          <div className="card-base p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LinkIcon size={18} className="text-indigo-500" /> 퀵 링크
              </h3>
              {isAdmin && (
                <button onClick={() => openLinkModal()} title="상세 입력 모달" className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                  <Plus size={14} /> 모달
                </button>
              )}
            </div>

            {isAdmin && (
              <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                <div className="grid grid-cols-1 gap-2">
                  <input
                    className="w-full rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-500/20 dark:bg-slate-900 dark:text-white"
                    placeholder="링크 이름"
                    value={quickLinkForm.이름}
                    onChange={e => setQuickLinkForm({ ...quickLinkForm, 이름: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') handleInlineCreateLink() }}
                  />
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-500/20 dark:bg-slate-900 dark:text-white"
                      placeholder="URL 또는 도메인"
                      value={quickLinkForm.URL}
                      onChange={e => setQuickLinkForm({ ...quickLinkForm, URL: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') handleInlineCreateLink() }}
                    />
                    <button onClick={handleInlineCreateLink} className="btn-primary shrink-0 px-3 py-2 text-xs">
                      <Save size={14} /> 추가
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {summary.quickLinks.map((link, i) => (
                <div key={i} className="relative group">
                  {editingQuickLinkId === link.ID ? (
                    <div className="rounded-xl border border-indigo-100 bg-white p-2 dark:border-indigo-500/20 dark:bg-slate-800">
                      <input
                        className="mb-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        value={editingQuickLinkForm.이름}
                        onChange={e => setEditingQuickLinkForm({ ...editingQuickLinkForm, 이름: e.target.value })}
                      />
                      <input
                        className="mb-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        value={editingQuickLinkForm.URL}
                        onChange={e => setEditingQuickLinkForm({ ...editingQuickLinkForm, URL: e.target.value })}
                      />
                      <div className="flex gap-1">
                        <button onClick={handleInlineUpdateLink} className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-bold text-white hover:bg-indigo-700">저장</button>
                        <button onClick={() => setEditingQuickLinkId(null)} className="flex-1 rounded-md bg-slate-100 px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200">취소</button>
                      </div>
                    </div>
                  ) : (
                    <a
                      href={link.URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[92px] flex-col items-center justify-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group/link"
                    >
                      <span className="text-slate-400 group-hover/link:text-indigo-500 dark:group-hover/link:text-indigo-400 mb-2">
                        <ExternalLink size={20} />
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover/link:text-indigo-700 dark:group-hover/link:text-indigo-300 text-center truncate w-full">{link.이름}</span>
                    </a>
                  )}
                  {/* 관리자 전용: 링크 수정/삭제 */}
                  {isAdmin && editingQuickLinkId !== link.ID && (
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openInlineEditLink(link)} title="바로 수정" className="p-1 rounded bg-white/90 dark:bg-slate-700 text-slate-500 hover:text-indigo-600 shadow-sm"><Pencil size={11} /></button>
                      <button onClick={() => handleDeleteLink(link)} title="삭제" className="p-1 rounded bg-white/90 dark:bg-slate-700 text-slate-500 hover:text-red-500 shadow-sm"><Trash2 size={11} /></button>
                    </div>
                  )}
                </div>
              ))}
              {summary.quickLinks.length === 0 && (
                <div className="col-span-2 text-center py-4 text-slate-400 text-xs">
                  {isAdmin ? "'추가' 버튼으로 공유 링크를 등록하세요." : '등록된 링크가 없습니다.'}
                </div>
              )}
            </div>
          </div>

          {/* 활동 로그 (최근 6개 제한) */}
          <div className="card-base p-6 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={18} className="text-slate-400" /> 활동 로그
            </h3>
            <div className="relative pl-2 space-y-6">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-100 dark:bg-slate-700" />
              {summary.recentActivities.slice(0, 6).map((log, i) => (
                <div key={i} className="relative flex gap-3 text-sm">
                  <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-600 border-2 border-white dark:border-slate-800 z-10 shrink-0 mt-1" />
                  <div>
                    <p className="text-slate-800 dark:text-slate-200 leading-snug">
                      <span className="font-bold">{log.사용자}</span>{log.행동}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{log.시간}</p>
                  </div>
                </div>
              ))}
              {summary.recentActivities.length === 0 && (
                <div className="text-slate-400 text-xs pl-4">최근 활동 내역이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 관리자 전용: 퀵링크 추가/수정 모달 */}
      {isAdmin && linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold dark:text-white flex items-center gap-2">
                <LinkIcon size={18} className="text-indigo-500" /> {linkModal.mode === 'edit' ? '링크 수정' : '공유 링크 추가'}
              </h3>
              <button onClick={() => setLinkModal(null)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">이름</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" placeholder="예: 공유 드라이브" value={linkForm.이름} onChange={e => setLinkForm({ ...linkForm, 이름: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase">URL</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white text-sm" placeholder="https://..." value={linkForm.URL} onChange={e => setLinkForm({ ...linkForm, URL: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button onClick={() => setLinkModal(null)} className="flex-1 btn-secondary">취소</button>
              <button onClick={handleSaveLink} className="flex-1 btn-primary"><Save size={16} /> 저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
