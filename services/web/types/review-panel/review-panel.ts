import { Brand } from '../helpers/brand'
import { ReviewPanelEntry } from './entry'

export type SubView = 'cur_file' | 'overview'

export interface ReviewPanelPermissions {
  read: boolean
  write: boolean
  admin: boolean
  comment: boolean
}

export type ThreadId = Brand<string, 'ThreadId'>
type ReviewPanelDocEntries = Record<ThreadId, ReviewPanelEntry>

export type DocId = Brand<string, 'DocId'>
export type ReviewPanelEntries = Record<DocId, ReviewPanelDocEntries>

type UserId = Brand<string, 'UserId'>

interface ReviewPanelUser {
  avatar_text: string
  email: string
  hue: number
  id: UserId
  isSelf: boolean
  name: string
}

export type CommentId = Brand<string, 'CommentId'>
export interface ReviewPanelCommentThreadMessage {
  content: string
  id: CommentId
  timestamp: number
  user: ReviewPanelUser
  user_id: UserId
}

export interface ReviewPanelCommentThread {
  messages: Array<ReviewPanelCommentThreadMessage>
  // resolved: boolean
  // resolved_at: number
  // resolved_by_user_id: string
  // resolved_by_user: ReviewPanelUser
  submitting?: boolean // angular specific (to be made into a local state)
}

export type ReviewPanelCommentThreads = Record<
  ThreadId,
  ReviewPanelCommentThread
>
