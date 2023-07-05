import { ThreadId, UserId } from './review-panel'

interface ReviewPanelEntryScreenPos {
  y: number
  height: number
  editorPaddingTop: number
}

interface ReviewPanelBaseEntry {
  visible: boolean
  offset: number
}

export interface ReviewPanelCommentEntry extends ReviewPanelBaseEntry {
  type: 'comment'
  content: string
  entry_ids: ThreadId[]
  focused: boolean
  screenPos: ReviewPanelEntryScreenPos
  thread_id: ThreadId
  replyContent?: string // angular specific
}

export interface ReviewPanelInsertEntry extends ReviewPanelBaseEntry {
  type: 'insert'
  content: string
  entry_ids: ThreadId[]
  metadata: {
    ts: Date
    user_id: UserId
  }
  screenPos: ReviewPanelEntryScreenPos
  focused?: boolean
}

export interface ReviewPanelDeleteEntry extends ReviewPanelBaseEntry {
  type: 'delete'
  content: string
  entry_ids: ThreadId[]
  metadata: {
    ts: Date
    user_id: UserId
  }
  screenPos: ReviewPanelEntryScreenPos
  focused?: boolean
}

interface ReviewPanelAggregateChangeEntry extends ReviewPanelBaseEntry {
  type: 'aggregate-change'
}

interface ReviewPanelAddCommentEntry extends ReviewPanelBaseEntry {
  type: 'add-comment'
}

interface ReviewPanelBulkActionsEntry extends ReviewPanelBaseEntry {
  type: 'bulk-actions'
}

export type ReviewPanelEntry =
  | ReviewPanelCommentEntry
  | ReviewPanelInsertEntry
  | ReviewPanelDeleteEntry
  | ReviewPanelAggregateChangeEntry
  | ReviewPanelAddCommentEntry
  | ReviewPanelBulkActionsEntry
