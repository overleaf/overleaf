import { Brand } from '../helpers/brand'
import { ReviewPanelEntry } from './entry'
import { ReviewPanelCommentThread } from './comment-thread'

export type SubView = 'cur_file' | 'overview'

export interface ReviewPanelPermissions {
  read: boolean
  write: boolean
  admin: boolean
  comment: boolean
}

export type ThreadId = Brand<string, 'ThreadId'>
export type ReviewPanelDocEntries = Record<ThreadId, ReviewPanelEntry>

export type DocId = Brand<string, 'DocId'>
export type ReviewPanelEntries = Record<DocId, ReviewPanelDocEntries>

export type UserId = Brand<string, 'UserId'>

export interface ReviewPanelUser {
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

export type ReviewPanelCommentThreads = Record<
  ThreadId,
  ReviewPanelCommentThread
>
