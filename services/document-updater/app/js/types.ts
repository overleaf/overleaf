import {
  TrackingPropsRawData,
  ClearTrackingPropsRawData,
  RawEditOperation,
} from 'overleaf-editor-core/lib/types'
import type { z } from '@overleaf/validation-tools'
import type rangesSchemas from '@overleaf/ranges-tracker/schemas'

export type OTType = 'sharejs-text-ot' | 'history-ot'

/**
 * An update coming from the editor
 */
export type Update = {
  dup?: boolean
  dupIfSource?: string[]
  doc: string
  op: Op[]
  v: number
  meta?: {
    tc?: boolean
    user_id?: string
    ts?: number
  }
  projectHistoryId?: string
}

export type HistoryOTEditOperationUpdate = Omit<Update, 'op'> & {
  op: RawEditOperation[]
  meta: Update['meta'] & { source: string }
}

export type Op = InsertOp | DeleteOp | CommentOp | RetainOp

export type InsertOp = z.infer<typeof rangesSchemas.insertOp>

export type RetainOp = {
  r: string
  p: number
}

export type DeleteOp = z.infer<typeof rangesSchemas.deleteOp>

export type CommentOp = z.infer<typeof rangesSchemas.commentOp>

/**
 * Ranges record on a document
 */
export type Ranges = z.infer<typeof rangesSchemas.ranges>

export type Comment = z.infer<typeof rangesSchemas.comment>

export type TrackedChange = z.infer<typeof rangesSchemas.trackedChange>

/**
 * Updates sent to project-history
 */
export type HistoryUpdate = {
  op: HistoryOp[]
  doc: string
  v?: number
  meta?: {
    ts?: number
    pathname?: string
    doc_length?: number
    history_doc_length?: number
    doc_hash?: string
    tc?: boolean
    user_id?: string
  }
  projectHistoryId?: string
}

export type HistoryOp =
  | HistoryInsertOp
  | HistoryDeleteOp
  | HistoryCommentOp
  | HistoryRetainOp

export type HistoryInsertOp = InsertOp & {
  commentIds?: string[]
  hpos?: number
  trackedDeleteRejection?: boolean
}

export type HistoryRetainOp = RetainOp & {
  hpos?: number
  tracking?: TrackingPropsRawData | ClearTrackingPropsRawData
}

export type HistoryDeleteOp = DeleteOp & {
  hpos?: number
  trackedChanges?: HistoryDeleteTrackedChange[]
}

export type HistoryDeleteTrackedChange = {
  type: 'insert' | 'delete'
  offset: number
  length: number
}

export type HistoryCommentOp = CommentOp & {
  hpos?: number
  hlen?: number
}

export type HistoryRanges = {
  comments?: HistoryComment[]
  changes?: HistoryTrackedChange[]
}

export type HistoryComment = Comment & { op: HistoryCommentOp }

export type HistoryTrackedChange = TrackedChange & {
  op: HistoryInsertOp | HistoryDeleteOp
}
