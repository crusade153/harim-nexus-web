import { NextResponse } from 'next/server'
import { requireNexusMember, WORKSPACE_ID, checked } from '@/lib/nexus-server'
import { deliverWebhook } from '@/lib/automation-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// 관리자가 등록한 웹훅 주소로 테스트 메시지를 1건 보낸다. 전송 결과는 webhook_deliveries 에 남는다.
export async function POST(request) {
  try {
    const { admin, isAdmin } = await requireNexusMember(request)
    if (!isAdmin) return NextResponse.json({ error: '관리자만 테스트할 수 있습니다.' }, { status: 403 })
    const body = await request.json().catch(() => ({}))
    const endpoint = checked(await admin.from('webhook_endpoints')
      .select('id,name,endpoint_url').eq('id', String(body.endpointId || '')).eq('workspace_id', WORKSPACE_ID).maybeSingle())
    if (!endpoint) return NextResponse.json({ error: '웹훅을 찾을 수 없습니다.' }, { status: 404 })
    try {
      const result = await deliverWebhook(admin, endpoint, {
        event: 'webhook.test', data: { message: 'Nexus 웹훅 연결 테스트', endpointName: endpoint.name }
      })
      return NextResponse.json({ ok: true, responseStatus: result.responseStatus })
    } catch (error) {
      // 받는 쪽 오류(주소 오타·차단)는 사용자에게 그대로 알려 고칠 수 있게 한다.
      return NextResponse.json({ ok: false, error: error.message || '전송에 실패했습니다.' }, { status: 502 })
    }
  } catch (error) {
    return NextResponse.json({ error: error.status ? error.message : '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: error.status || 500 })
  }
}
