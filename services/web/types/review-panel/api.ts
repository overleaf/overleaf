import { ReviewPanelCommentThreadMessage, ThreadId } from './review-panel'
import { MergeAndOverride } from '../utils'

export type ReviewPanelCommentThreadMessageApi = MergeAndOverride<
  ReviewPanelCommentThreadMessage,
  { timestamp: number }
>

export type ReviewPanelCommentThreadsApi = Record<
  ThreadId,
  {
    messages: ReviewPanelCommentThreadMessageApi[]
  }
>
