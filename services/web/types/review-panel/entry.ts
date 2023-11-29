import { ThreadId } from './review-panel'
import { UserId } from '../user'

export interface ReviewPanelEntryScreenPos {
  y: number
  height: number
  editorPaddingTop: number
}

interface ReviewPanelBaseEntry {
  focused: boolean
  offset: number
  screenPos: ReviewPanelEntryScreenPos
  visible: boolean
  inViewport: boolean
}

interface ReviewPanelInsertOrDeleteEntry {
  content: string
  entry_ids: ThreadId[]
  metadata: {
    ts: Date
    user_id: UserId
  }
}

export interface ReviewPanelInsertEntry
  extends ReviewPanelBaseEntry,
    ReviewPanelInsertOrDeleteEntry {
  type: 'insert'
}

export interface ReviewPanelDeleteEntry
  extends ReviewPanelBaseEntry,
    ReviewPanelInsertOrDeleteEntry {
  type: 'delete'
}

export type ReviewPanelChangeEntry =
  | ReviewPanelInsertEntry
  | ReviewPanelDeleteEntry

export interface ReviewPanelCommentEntry extends ReviewPanelBaseEntry {
  type: 'comment'
  content: string
  entry_ids: ThreadId[]
  thread_id: ThreadId
  replyContent?: string // angular specific
}

export interface ReviewPanelAggregateChangeEntry extends ReviewPanelBaseEntry {
  type: 'aggregate-change'
  content: string
  entry_ids: ThreadId[]
  metadata: {
    replaced_content: string
    ts: Date
    user_id: UserId
  }
}

export interface ReviewPanelAddCommentEntry extends ReviewPanelBaseEntry {
  type: 'add-comment'
  length: number
}

export interface ReviewPanelBulkActionsEntry extends ReviewPanelBaseEntry {
  type: 'bulk-actions'
  length: number
}

export type ReviewPanelEntry =
  | ReviewPanelCommentEntry
  | ReviewPanelInsertEntry
  | ReviewPanelDeleteEntry
  | ReviewPanelAggregateChangeEntry
  | ReviewPanelAddCommentEntry
  | ReviewPanelBulkActionsEntry
