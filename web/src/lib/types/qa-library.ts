export type QaEntry = {
  id: number
  question: string
  answer_video_url: string
  created_at: string
  updated_at: string
}

export type QaInput = Pick<QaEntry, 'question' | 'answer_video_url'>
