import 'server-only'
import { WORKSPACE_ID, checked } from '@/lib/nexus-server'
import { buildClosingTasks, CLOSING_PLANTS, isValidDate, isValidPeriod, normalizeHolidays } from '@/lib/closing-utils.mjs'

export async function loadHolidays(admin) {
  const settings = checked(await admin.from('workspace_settings').select('holidays').eq('workspace_id', WORKSPACE_ID).single())
  return normalizeHolidays(settings.holidays)
}

// 템플릿 항목으로 업무를 계산해 실행 1건 + 업무 N건을 DB 한 트랜잭션으로 만든다.
// plants 를 주면 그 구분(공통·K1·K2·K3)의 항목만 만든다. 생략하면 전체(자동 시작).
export async function startClosingRun(admin, { templateId, period, startDate, plants, actorId }) {
  if (!Number.isSafeInteger(templateId)) throw Object.assign(new Error('템플릿을 선택해 주세요.'), { status: 400 })
  if (!isValidPeriod(period)) throw Object.assign(new Error('마감 대상월 형식이 올바르지 않습니다. (예: 2026-09)'), { status: 400 })
  if (!isValidDate(startDate)) throw Object.assign(new Error('마감 시작일을 확인해 주세요.'), { status: 400 })
  const [items, members, holidays] = await Promise.all([
    admin.from('closing_template_items').select('id,title,description,offset_days,default_assignee_member_id,reference_url,sort_order,plant')
      .eq('template_id', templateId).order('sort_order').limit(200),
    admin.from('workspace_members').select('member_id,members(id,name)').eq('workspace_id', WORKSPACE_ID).eq('active', true),
    loadHolidays(admin),
  ])
  const allItems = checked(items)
  if (plants !== undefined && (!Array.isArray(plants) || plants.some(plant => !CLOSING_PLANTS.includes(plant)))) throw Object.assign(new Error('플랜트 선택을 확인해 주세요.'), { status: 400 })
  const templateItems = plants ? allItems.filter(item => plants.includes(item.plant || CLOSING_PLANTS[0])) : allItems
  if (!templateItems.length) throw Object.assign(new Error(allItems.length ? '선택한 플랜트에 항목이 없습니다.' : '템플릿에 항목이 없습니다.'), { status: 400 })
  const tasks = buildClosingTasks(templateItems, {
    period, startDate, holidays,
    members: checked(members).map(m => m.members).filter(Boolean),
  })
  const result = await admin.rpc('nexus_create_closing_run', {
    p_workspace: WORKSPACE_ID, p_template: templateId, p_period: period, p_start: startDate, p_actor: actorId ?? null, p_tasks: tasks,
  })
  if (result.error?.code === 'P0001') throw Object.assign(new Error(result.error.message), { status: 409 })
  return { run: checked(result), taskCount: tasks.length }
}
