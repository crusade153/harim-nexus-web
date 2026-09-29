'use client'

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Building2, ChevronRight, ClipboardList, Edit3, Plus, ShieldCheck,
  Target, Trash2, X,
} from 'lucide-react'
import {
  deleteMboObjective, deleteOrgUnit, deleteWorkResponsibility,
  saveMboObjective, saveMemberRoleProfile, saveOrgUnit, saveWorkResponsibility,
} from '@/lib/sheets'
import { isAdmin as isAdminUser } from '@/lib/roles'

const currentYear = new Date().getFullYear()
const emptyUnit = { name: '', unit_type: 'team', parent_id: '', manager_member_id: '', description: '', sort_order: 0 }
const emptyMbo = { member_id: '', org_unit_id: '', year: currentYear, title: '', description: '', metric: '', target_value: '', current_value: '', weight: 0, progress: 0, status: 'planned', due_date: '' }
const emptyDuty = { org_unit_id: '', title: '', description: '', output_definition: '', cycle: '', sort_order: 0 }
const RACI = {
  R: { label: '실행 R', help: '실무 수행 책임', color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' },
  A: { label: '최종 A', help: '최종 의사결정·승인', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
  C: { label: '협의 C', help: '사전 협의·전문 지원', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  I: { label: '공유 I', help: '결과 공유 대상', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
}
const statusLabel = { planned: '계획', in_progress: '진행', at_risk: '위험', completed: '완료', hold: '보류' }

function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-indigo-900'
const labelClass = 'mb-1.5 block text-xs font-bold text-slate-500 dark:text-slate-400'

function OrgTreeNode({ unit, units, memberMap }) {
  const children = units.filter(candidate => String(candidate.parent_id || '') === String(unit.id))
  const manager = memberMap[String(unit.manager_member_id)]
  return (
    <div className="relative">
      <div className="min-w-48 rounded-xl border border-indigo-200 bg-white px-4 py-3 shadow-sm dark:border-indigo-900 dark:bg-slate-800">
        <div className="flex items-center gap-2"><Building2 size={15} className="text-indigo-500" /><strong className="text-sm text-slate-800 dark:text-white">{unit.name}</strong></div>
        <p className="mt-1 text-[11px] text-slate-400">책임자 · {manager?.name || '미지정'}</p>
      </div>
      {children.length > 0 && <div className="ml-6 mt-3 space-y-3 border-l-2 border-slate-200 pl-5 dark:border-slate-700">{children.map(child => <OrgTreeNode key={child.id} unit={child} units={units} memberMap={memberMap} />)}</div>}
    </div>
  )
}

export default function OrganizationPage({ data, currentMember, onRefresh }) {
  const [tab, setTab] = useState('organization')
  const [unitForm, setUnitForm] = useState(null)
  const [roleForm, setRoleForm] = useState(null)
  const [mboForm, setMboForm] = useState(null)
  const [dutyForm, setDutyForm] = useState(null)
  const [dutyAssignments, setDutyAssignments] = useState({ R: [], A: [], C: [], I: [] })
  const [year, setYear] = useState(currentYear)
  const [memberFilter, setMemberFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const isAdmin = isAdminUser(currentMember)

  const memberMap = useMemo(() => Object.fromEntries(data.members.map(member => [String(member.id), member])), [data.members])
  const unitMap = useMemo(() => Object.fromEntries(data.units.map(unit => [String(unit.id), unit])), [data.units])
  const profileMap = useMemo(() => Object.fromEntries(data.profiles.map(profile => [String(profile.member_id), profile])), [data.profiles])
  const activeMembers = data.members.filter(member => member.approved && member.status !== 'pending')
  const objectives = data.objectives.filter(item => Number(item.year) === Number(year) && (memberFilter === 'all' || String(item.member_id) === memberFilter))

  const runSave = async (work, close) => {
    setSaving(true)
    try {
      await work()
      toast.success('저장했습니다.')
      close()
      await onRefresh()
    } catch (error) {
      toast.error(error.message || '저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async (message, work) => {
    if (!window.confirm(message)) return
    try { await work(); toast.success('삭제했습니다.'); await onRefresh() }
    catch (error) { toast.error(error.message || '삭제하지 못했습니다.') }
  }

  const openRole = member => {
    const profile = profileMap[String(member.id)]
    setRoleForm({
      member_id: member.id,
      org_unit_id: profile?.org_unit_id || '',
      job_title: profile?.job_title || member.position || '',
      role_summary: profile?.role_summary || '',
      responsibilitiesText: (profile?.responsibilities || []).join('\n'),
      authority_scope: profile?.authority_scope || '',
    })
  }

  const openDuty = duty => {
    setDutyForm(duty ? { ...duty, org_unit_id: duty.org_unit_id || '' } : { ...emptyDuty })
    const next = { R: [], A: [], C: [], I: [] }
    data.assignments.filter(item => String(item.responsibility_id) === String(duty?.id)).forEach(item => next[item.assignment_type].push(String(item.member_id)))
    setDutyAssignments(next)
  }

  const tabs = [
    { id: 'organization', label: '조직도 · 역할', icon: Building2 },
    { id: 'mbo', label: '개인 MBO', icon: Target },
    { id: 'duties', label: '업무분장 RACI', icon: ClipboardList },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-500"><ShieldCheck size={14} /> Organization Control</div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">조직 · 목표 · 책임 관리</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">누가 어떤 역할을 맡고, 무엇을 목표로 하며, 어떤 업무에 책임지는지 한 화면에서 관리합니다.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['조직', data.units.length], ['MBO', data.objectives.filter(item => Number(item.year) === currentYear).length], ['업무분장', data.responsibilities.length]].map(([label, value]) => (
            <div key={label} className="min-w-24 rounded-xl border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-800"><p className="text-lg font-black text-slate-900 dark:text-white">{value}</p><p className="text-[11px] text-slate-400">{label}</p></div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
        {tabs.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${tab === item.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}><Icon size={16} />{item.label}</button> })}
      </div>

      {tab === 'organization' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">조직도와 역할 정의</h2><p className="text-xs text-slate-500">조직 소속과 직무 역할, 책임, 권한 범위를 분리해 기록합니다.</p></div>{isAdmin && <button onClick={() => setUnitForm({ ...emptyUnit })} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />조직 추가</button>}</div>
          {data.units.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">등록된 조직이 없습니다.</div> : <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/40">
              <p className="mb-4 text-xs font-bold text-slate-500">조직 구조</p>
              <div className="flex min-w-max gap-8">{data.units.filter(unit => !unit.parent_id).map(unit => <OrgTreeNode key={unit.id} unit={unit} units={data.units} memberMap={memberMap} />)}</div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {data.units.map(unit => {
                const unitMembers = activeMembers.filter(member => String(profileMap[String(member.id)]?.org_unit_id) === String(unit.id))
                const manager = memberMap[String(unit.manager_member_id)]
                return (
                  <div key={unit.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Building2 size={18} className="text-indigo-500" /><h3 className="font-bold text-slate-900 dark:text-white">{unit.name}</h3><span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700">{unit.unit_type}</span></div><p className="mt-1 text-xs text-slate-500">{unit.description || '조직 설명이 아직 없습니다.'}</p></div>{isAdmin && <div className="flex"><button onClick={() => setUnitForm({ ...unit, parent_id: unit.parent_id || '', manager_member_id: unit.manager_member_id || '' })} className="p-2 text-slate-400 hover:text-indigo-500"><Edit3 size={15} /></button><button onClick={() => confirmDelete(`${unit.name} 조직을 삭제할까요?`, () => deleteOrgUnit(unit.id))} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button></div>}</div>
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-900"><ShieldCheck size={14} className="text-amber-500" /><span className="text-slate-400">조직 책임자</span><strong className="text-slate-700 dark:text-slate-200">{manager?.name || '미지정'}</strong></div>
                    <div className="mt-4 space-y-2">
                      {unitMembers.map(member => { const profile = profileMap[String(member.id)]; return (
                        <button key={member.id} onClick={() => openRole(member)} className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-700 dark:hover:bg-indigo-950/20">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{member.name?.[0]}</div>
                          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-sm text-slate-800 dark:text-white">{member.name}</strong><span className="text-xs text-slate-400">{profile?.job_title || member.position}</span></div><p className="truncate text-xs text-slate-500">{profile?.role_summary || '역할 요약 미등록'}</p></div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
                        </button>
                      ) })}
                      {unitMembers.length === 0 && <p className="py-4 text-center text-xs text-slate-400">소속 팀원이 없습니다.</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>}
          {activeMembers.filter(member => !profileMap[String(member.id)]?.org_unit_id).length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20"><p className="text-xs font-bold text-amber-700 dark:text-amber-300">소속 미지정 팀원</p><div className="mt-2 flex flex-wrap gap-2">{activeMembers.filter(member => !profileMap[String(member.id)]?.org_unit_id).map(member => <button key={member.id} onClick={() => isAdmin && openRole(member)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-200">{member.name} · {member.position}</button>)}</div></div>}
        </section>
      )}

      {tab === 'mbo' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-bold text-slate-900 dark:text-white">개인 MBO</h2><p className="text-xs text-slate-500">목표·측정지표·가중치·진척도를 함께 관리합니다.</p></div><div className="flex gap-2"><select value={year} onChange={e => setYear(Number(e.target.value))} className={inputClass}><option>{currentYear - 1}</option><option>{currentYear}</option><option>{currentYear + 1}</option></select><select value={memberFilter} onChange={e => setMemberFilter(e.target.value)} className={inputClass}><option value="all">전체 팀원</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select>{isAdmin && <button onClick={() => setMboForm({ ...emptyMbo, year })} className="btn-primary flex shrink-0 items-center gap-2 text-sm"><Plus size={16} />MBO 추가</button>}</div></div>
          <div className="grid gap-4 xl:grid-cols-2">
            {objectives.map(item => { const member = memberMap[String(item.member_id)]; return (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-950/50">{member?.name}</span><span className="text-xs text-slate-400">가중치 {Number(item.weight)}%</span><span className="text-xs font-bold text-slate-500">{statusLabel[item.status]}</span></div><h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3><p className="mt-1 text-xs text-slate-500">{item.description || '상세 설명 없음'}</p></div>{isAdmin && <div className="flex"><button onClick={() => setMboForm({ ...item, org_unit_id: item.org_unit_id || '', due_date: item.due_date || '' })} className="p-2 text-slate-400 hover:text-indigo-500"><Edit3 size={15} /></button><button onClick={() => confirmDelete('이 MBO를 삭제할까요?', () => deleteMboObjective(item.id))} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button></div>}</div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><span className="text-slate-400">측정 지표</span><p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{item.metric || '-'}</p></div><div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-900"><span className="text-slate-400">목표 / 현재</span><p className="mt-1 font-bold text-slate-700 dark:text-slate-200">{item.target_value || '-'} / {item.current_value || '-'}</p></div></div>
                <div className="mt-4"><div className="mb-1.5 flex justify-between text-xs"><span className="text-slate-400">진척도</span><strong className="text-indigo-600">{item.progress}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.progress}%` }} /></div></div>
              </div>
            ) })}
            {objectives.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400">선택한 조건의 MBO가 없습니다.</div>}
          </div>
        </section>
      )}

      {tab === 'duties' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">업무분장표 · RACI</h2><p className="text-xs text-slate-500">업무마다 실행(R), 최종책임(A), 협의(C), 공유(I)를 명확히 지정합니다.</p></div>{isAdmin && <button onClick={() => openDuty(null)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} />업무 추가</button>}</div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-3">업무 / 산출물</th><th className="px-4 py-3">조직</th>{Object.keys(RACI).map(type => <th key={type} className="px-4 py-3">{RACI[type].label}</th>)}{isAdmin && <th className="w-20 px-4 py-3">관리</th>}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{data.responsibilities.map(duty => { const assigned = Object.fromEntries(Object.keys(RACI).map(type => [type, data.assignments.filter(item => String(item.responsibility_id) === String(duty.id) && item.assignment_type === type).map(item => memberMap[String(item.member_id)]?.name).filter(Boolean)])); return <tr key={duty.id} className="align-top"><td className="px-4 py-4"><strong className="text-slate-800 dark:text-white">{duty.title}</strong><p className="mt-1 max-w-xs text-xs text-slate-500">{duty.description}</p><p className="mt-2 text-[11px] text-indigo-500">산출물: {duty.output_definition || '-'} · 주기: {duty.cycle || '-'}</p></td><td className="px-4 py-4 text-xs text-slate-500">{unitMap[String(duty.org_unit_id)]?.name || '공통'}</td>{Object.keys(RACI).map(type => <td key={type} className="px-4 py-4"><div className="flex max-w-40 flex-wrap gap-1">{assigned[type].map(name => <span key={name} className={`rounded px-2 py-1 text-[11px] font-bold ${RACI[type].color}`}>{name}</span>)}{assigned[type].length === 0 && <span className="text-xs text-slate-300">-</span>}</div></td>)}{isAdmin && <td className="px-4 py-4"><div className="flex"><button onClick={() => openDuty(duty)} className="p-2 text-slate-400 hover:text-indigo-500"><Edit3 size={15} /></button><button onClick={() => confirmDelete('이 업무분장을 삭제할까요?', () => deleteWorkResponsibility(duty.id))} className="p-2 text-slate-400 hover:text-rose-500"><Trash2 size={15} /></button></div></td>}</tr> })}</tbody></table>{data.responsibilities.length === 0 && <p className="p-12 text-center text-sm text-slate-400">등록된 업무분장이 없습니다.</p>}</div>
          <div className="grid gap-2 md:grid-cols-4">{Object.entries(RACI).map(([type, info]) => <div key={type} className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800"><span className={`rounded px-2 py-1 font-bold ${info.color}`}>{info.label}</span><p className="mt-2 text-slate-500">{info.help}</p></div>)}</div>
        </section>
      )}

      {unitForm && <Modal title={unitForm.id ? '조직 수정' : '조직 추가'} onClose={() => setUnitForm(null)}><form onSubmit={e => { e.preventDefault(); runSave(() => saveOrgUnit(unitForm), () => setUnitForm(null)) }} className="space-y-4 p-6"><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>조직명</label><input required value={unitForm.name} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>조직 유형</label><select value={unitForm.unit_type} onChange={e => setUnitForm({ ...unitForm, unit_type: e.target.value })} className={inputClass}><option value="company">회사</option><option value="division">부문</option><option value="department">부서</option><option value="team">팀</option></select></div></div><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>상위 조직</label><select value={unitForm.parent_id} onChange={e => setUnitForm({ ...unitForm, parent_id: e.target.value })} className={inputClass}><option value="">없음</option>{data.units.filter(unit => String(unit.id) !== String(unitForm.id)).map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div><div><label className={labelClass}>조직 책임자</label><select value={unitForm.manager_member_id} onChange={e => setUnitForm({ ...unitForm, manager_member_id: e.target.value })} className={inputClass}><option value="">미지정</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div></div><div><label className={labelClass}>조직 미션·설명</label><textarea value={unitForm.description} onChange={e => setUnitForm({ ...unitForm, description: e.target.value })} rows={3} className={inputClass} /></div><button disabled={saving} className="btn-primary w-full">{saving ? '저장 중...' : '저장'}</button></form></Modal>}

      {roleForm && <Modal title={`${memberMap[String(roleForm.member_id)]?.name} 역할·책임 ${isAdmin ? '정의' : '보기'}`} onClose={() => setRoleForm(null)}><form onSubmit={e => { e.preventDefault(); if (isAdmin) runSave(() => saveMemberRoleProfile({ ...roleForm, responsibilities: roleForm.responsibilitiesText.split('\n').map(v => v.trim()).filter(Boolean) }), () => setRoleForm(null)) }} className="space-y-4 p-6"><div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>소속 조직</label><select disabled={!isAdmin} value={roleForm.org_unit_id} onChange={e => setRoleForm({ ...roleForm, org_unit_id: e.target.value })} className={inputClass}><option value="">미지정</option>{data.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div><div><label className={labelClass}>직무·직책</label><input readOnly={!isAdmin} value={roleForm.job_title} onChange={e => setRoleForm({ ...roleForm, job_title: e.target.value })} className={inputClass} /></div></div><div><label className={labelClass}>역할(이 직무가 존재하는 이유)</label><textarea readOnly={!isAdmin} value={roleForm.role_summary} onChange={e => setRoleForm({ ...roleForm, role_summary: e.target.value })} rows={2} className={inputClass} /></div><div><label className={labelClass}>책임 목록(한 줄에 한 개)</label><textarea readOnly={!isAdmin} value={roleForm.responsibilitiesText} onChange={e => setRoleForm({ ...roleForm, responsibilitiesText: e.target.value })} rows={5} className={inputClass} /></div><div><label className={labelClass}>권한 범위·의사결정 기준</label><textarea readOnly={!isAdmin} value={roleForm.authority_scope} onChange={e => setRoleForm({ ...roleForm, authority_scope: e.target.value })} rows={3} className={inputClass} /></div>{isAdmin && <button disabled={saving} className="btn-primary w-full">저장</button>}</form></Modal>}

      {mboForm && <Modal title={mboForm.id ? 'MBO 수정' : 'MBO 추가'} onClose={() => setMboForm(null)} wide><form onSubmit={e => { e.preventDefault(); runSave(() => saveMboObjective(mboForm), () => setMboForm(null)) }} className="grid gap-4 p-6 md:grid-cols-2"><div><label className={labelClass}>대상 팀원</label><select required value={mboForm.member_id} onChange={e => setMboForm({ ...mboForm, member_id: e.target.value })} className={inputClass}><option value="">선택</option>{activeMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div><div><label className={labelClass}>연도 / 가중치</label><div className="grid grid-cols-2 gap-2"><input type="number" value={mboForm.year} onChange={e => setMboForm({ ...mboForm, year: e.target.value })} className={inputClass} /><input type="number" min="0" max="100" value={mboForm.weight} onChange={e => setMboForm({ ...mboForm, weight: e.target.value })} className={inputClass} /></div></div><div className="md:col-span-2"><label className={labelClass}>목표 제목</label><input required value={mboForm.title} onChange={e => setMboForm({ ...mboForm, title: e.target.value })} className={inputClass} /></div><div className="md:col-span-2"><label className={labelClass}>목표 설명</label><textarea value={mboForm.description} onChange={e => setMboForm({ ...mboForm, description: e.target.value })} rows={2} className={inputClass} /></div><div><label className={labelClass}>측정 지표</label><input value={mboForm.metric} onChange={e => setMboForm({ ...mboForm, metric: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>목표값 / 현재값</label><div className="grid grid-cols-2 gap-2"><input value={mboForm.target_value} onChange={e => setMboForm({ ...mboForm, target_value: e.target.value })} className={inputClass} /><input value={mboForm.current_value} onChange={e => setMboForm({ ...mboForm, current_value: e.target.value })} className={inputClass} /></div></div><div><label className={labelClass}>진척도</label><input type="number" min="0" max="100" value={mboForm.progress} onChange={e => setMboForm({ ...mboForm, progress: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>상태 / 완료 예정일</label><div className="grid grid-cols-2 gap-2"><select value={mboForm.status} onChange={e => setMboForm({ ...mboForm, status: e.target.value })} className={inputClass}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input type="date" value={mboForm.due_date || ''} onChange={e => setMboForm({ ...mboForm, due_date: e.target.value })} className={inputClass} /></div></div><button disabled={saving} className="btn-primary md:col-span-2">저장</button></form></Modal>}

      {dutyForm && <Modal title={dutyForm.id ? '업무분장 수정' : '업무분장 추가'} onClose={() => setDutyForm(null)} wide><form onSubmit={e => { e.preventDefault(); runSave(() => saveWorkResponsibility(dutyForm, dutyAssignments), () => setDutyForm(null)) }} className="space-y-4 p-6"><div className="grid gap-3 md:grid-cols-2"><div><label className={labelClass}>업무명</label><input required value={dutyForm.title} onChange={e => setDutyForm({ ...dutyForm, title: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>담당 조직</label><select value={dutyForm.org_unit_id} onChange={e => setDutyForm({ ...dutyForm, org_unit_id: e.target.value })} className={inputClass}><option value="">공통</option>{data.units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></div></div><div><label className={labelClass}>업무 설명</label><textarea value={dutyForm.description} onChange={e => setDutyForm({ ...dutyForm, description: e.target.value })} rows={2} className={inputClass} /></div><div className="grid gap-3 md:grid-cols-2"><div><label className={labelClass}>완료 산출물·기준</label><input value={dutyForm.output_definition} onChange={e => setDutyForm({ ...dutyForm, output_definition: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>업무 주기</label><input placeholder="예: 매월 3영업일" value={dutyForm.cycle} onChange={e => setDutyForm({ ...dutyForm, cycle: e.target.value })} className={inputClass} /></div></div><div className="grid gap-3 md:grid-cols-2">{Object.entries(RACI).map(([type, info]) => <div key={type} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><div className="mb-2 flex items-center justify-between"><span className={`rounded px-2 py-1 text-xs font-bold ${info.color}`}>{info.label}</span><span className="text-[10px] text-slate-400">{info.help}</span></div><div className="max-h-32 space-y-1 overflow-y-auto">{activeMembers.map(member => <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700"><input type="checkbox" checked={dutyAssignments[type].includes(String(member.id))} onChange={() => setDutyAssignments(prev => ({ ...prev, [type]: prev[type].includes(String(member.id)) ? prev[type].filter(id => id !== String(member.id)) : [...prev[type], String(member.id)] }))} />{member.name} · {member.position}</label>)}</div></div>)}</div><button disabled={saving} className="btn-primary w-full">저장</button></form></Modal>}
    </div>
  )
}
