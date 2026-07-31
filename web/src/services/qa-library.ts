import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { QaEntry, QaInput } from '@/lib/types/qa-library'
import { normalizeExternalUrl } from '@/lib/external-url'

function cleanInput(input: QaInput) {
  const question = String(input.question ?? '').trim()
  const answerVideoUrl = normalizeExternalUrl(input.answer_video_url)
  if (!question) throw new Error('請輸入問題。')
  if (!answerVideoUrl) throw new Error('請輸入有效的影片連結。')
  return { question, answer_video_url: answerVideoUrl }
}

function getAdmin() {
  const admin = createAdminClient()
  if (!admin) throw new Error('尚未設定 SUPABASE_SERVICE_ROLE_KEY，無法管理 QA 庫。')
  return admin
}

export async function getQaEntries(): Promise<QaEntry[]> {
  const supabase = createAdminClient() ?? await createClient()
  const { data, error } = await supabase.from('qa_library').select('id, question, answer_video_url, created_at, updated_at').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as QaEntry[]
}

export async function createQaEntry(input: QaInput, coachId: number) {
  const admin = getAdmin()
  const payload = cleanInput(input)
  const { data, error } = await admin.from('qa_library').insert({ ...payload, created_by_coach_id: coachId }).select('id, question, answer_video_url, created_at, updated_at').single()
  if (error || !data) throw new Error(error?.message ?? '新增 QA 失敗。')
  return data as QaEntry
}

export async function updateQaEntry(id: number, input: QaInput) {
  const admin = getAdmin()
  const payload = cleanInput(input)
  const { data, error } = await admin.from('qa_library').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id).select('id, question, answer_video_url, created_at, updated_at').single()
  if (error || !data) throw new Error(error?.message ?? '更新 QA 失敗。')
  return data as QaEntry
}

export async function deleteQaEntry(id: number) {
  const admin = getAdmin()
  const { error } = await admin.from('qa_library').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
