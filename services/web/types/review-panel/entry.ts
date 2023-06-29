import { ThreadId } from './review-panel'

interface ReviewPanelEntryScreenPos {
  y: number
  height: number
  editorPaddingTop: number
}

interface ReviewPanelBaseEntry {
  visible: boolean
}

export interface ReviewPanelCommentEntry extends ReviewPanelBaseEntry {
  type: 'comment'
  content: string
  entry_ids: string[]
  focused: boolean
  offset: number
  screenPos: ReviewPanelEntryScreenPos
  thread_id: ThreadId
  replyContent?: string // angular specific
}

interface ReviewPanelInsertEntry extends ReviewPanelBaseEntry {
  type: 'insert'
}

interface ReviewPanelDeleteEntry extends ReviewPanelBaseEntry {
  type: 'delete'
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
