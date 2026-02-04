import {
  ReviewPanelCommentThreadMessage,
  ReviewPanelUser,
} from './review-panel'
import { UserId } from '../user'
import { DateString } from '../helpers/date'

export interface ReviewPanelCommentThreadBase {
  messages: Array<ReviewPanelCommentThreadMessage>
  submitting?: boolean // angular specific (to be made into a local state)
}

interface ReviewPanelUnresolvedCommentThread extends ReviewPanelCommentThreadBase {
  resolved?: never
  resolved_at?: never
  resolved_by_user_id?: never
  resolved_by_user?: never
}

export interface ReviewPanelResolvedCommentThread extends ReviewPanelCommentThreadBase {
  resolved: boolean
  resolved_at: DateString
  resolved_by_user_id: UserId
  resolved_by_user: ReviewPanelUser
}

export type ReviewPanelCommentThread =
  | ReviewPanelUnresolvedCommentThread
  | ReviewPanelResolvedCommentThread
