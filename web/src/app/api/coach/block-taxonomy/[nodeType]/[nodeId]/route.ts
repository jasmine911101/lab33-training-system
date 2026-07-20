import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteBlockTaxonomyNode, updateBlockTaxonomyNodeName } from '@/services/block-taxonomy'

function parseNodeId(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ nodeType: string; nodeId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { nodeType, nodeId } = await params
  const parsedNodeId = parseNodeId(nodeId)
  if (!parsedNodeId) return NextResponse.json({ error: '分類 ID 不正確。' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name : ''
  const result = await updateBlockTaxonomyNodeName(nodeType, parsedNodeId, name)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '更新分類名稱失敗。' }, { status: 400 })
  }

  return NextResponse.json({ node: result.data, message: result.message })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ nodeType: string; nodeId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) return response as NextResponse

  const { nodeType, nodeId } = await params
  const parsedNodeId = parseNodeId(nodeId)
  if (!parsedNodeId) return NextResponse.json({ error: '分類 ID 不正確。' }, { status: 400 })

  const body = await request.json().catch(() => ({})) as { confirmationName?: unknown }
  const confirmationName = typeof body.confirmationName === 'string' ? body.confirmationName : ''
  const result = await deleteBlockTaxonomyNode(context.coachProfile, nodeType, parsedNodeId, confirmationName)
  if (result.error || !result.data?.permanentDeleteAllowed) {
    return NextResponse.json({ error: result.error ?? '刪除分類失敗。', preview: result.data ?? null }, { status: 409 })
  }

  return NextResponse.json({ preview: result.data, message: result.message })
}
