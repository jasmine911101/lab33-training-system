import { NextResponse } from 'next/server'

import { requireCoachApiContext } from '@/lib/auth/api'
import { deleteBlockTemplateForCoach, updateBlockTemplateForCoach } from '@/services/block-management'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { blockId } = await params
  const parsedBlockId = Number(blockId)
  if (!Number.isFinite(parsedBlockId)) {
    return NextResponse.json({ error: '板塊 ID 不正確。' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '板塊資料格式不正確。' }, { status: 400 })
  }

  const bodyRecord = body as Record<string, unknown>
  const sectionRows = Array.isArray(bodyRecord.sections) ? (bodyRecord.sections as Array<Record<string, unknown>>) : []
  const trainingCategoryId = bodyRecord.trainingCategoryId == null ? null : Number(bodyRecord.trainingCategoryId)

  const result = await updateBlockTemplateForCoach(context.coachProfile, parsedBlockId, {
    blockCode: String(bodyRecord.blockCode ?? ''),
    blockName: String(bodyRecord.blockName ?? ''),
    goal: String(bodyRecord.goal ?? ''),
    trainingElement: String(bodyRecord.trainingElement ?? ''),
    description: String(bodyRecord.description ?? ''),
    trainingCategoryId: Number.isFinite(trainingCategoryId) ? trainingCategoryId : null,
    sections: sectionRows.map((section) => ({
      section_name: String(section.section_name ?? ''),
      exercises: Array.isArray(section.exercises)
        ? (section.exercises as Array<Record<string, unknown>>).map((exercise) => ({
            exercise_name: String(exercise.exercise_name ?? ''),
            sets: String(exercise.sets ?? ''),
            reps_or_time: String(exercise.reps_or_time ?? ''),
            equipment: String(exercise.equipment ?? ''),
            intensity: String(exercise.intensity ?? ''),
            weight: String(exercise.weight ?? ''),
            rest: String(exercise.rest ?? ''),
            video_url: String(exercise.video_url ?? ''),
            notes: String(exercise.notes ?? ''),
          }))
        : [],
    })),
  })

  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '更新板塊失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    block: result.data,
    message: result.message,
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockId: string }> },
) {
  const { context, response } = await requireCoachApiContext()
  if (response || !context?.coachProfile) {
    return response as NextResponse
  }

  const { blockId } = await params
  const parsedBlockId = Number(blockId)
  if (!Number.isFinite(parsedBlockId)) {
    return NextResponse.json({ error: '板塊 ID 不正確。' }, { status: 400 })
  }

  const result = await deleteBlockTemplateForCoach(parsedBlockId)
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error ?? '刪除板塊失敗。' }, { status: 400 })
  }

  return NextResponse.json({
    blockId: result.data.blockId,
    message: result.message,
  })
}
