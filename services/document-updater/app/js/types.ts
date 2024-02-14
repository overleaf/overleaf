export type Update = {
  op: Op[]
  v: number
  meta?: {
    tc?: boolean
    user_id?: string
  }
  projectHistoryId?: string
}

export type Op = InsertOp | DeleteOp | CommentOp

export type InsertOp = {
  i: string
  p: number
  u?: boolean
}

export type DeleteOp = {
  d: string
  p: number
  u?: boolean
}

export type CommentOp = {
  c: string
  p: number
  t: string
  u?: boolean
}

export type Ranges = {
  comments?: Comment[]
  changes?: TrackedChange[]
}

export type Comment = {
  id: string
  op: CommentOp
  metadata: {
    user_id: string
    ts: string
  }
}

export type TrackedChange = {
  id: string
  op: Op
  metadata: {
    user_id: string
    ts: string
  }
}

export type HistoryOp = HistoryInsertOp | HistoryDeleteOp | HistoryCommentOp

export type HistoryInsertOp = InsertOp & {
  commentIds?: string[]
  hpos?: number
  trackedDeleteRejection?: boolean
}

export type HistoryDeleteOp = DeleteOp & {
  hpos?: number
  hsplits?: HistoryDeleteSplit[]
}

export type HistoryDeleteSplit = {
  offset: number
  length: number
}

export type HistoryCommentOp = CommentOp & {
  hpos?: number
  hlen?: number
}

export type HistoryUpdate = {
  op: HistoryOp[]
  v: number
  meta?: {
    pathname?: string
    doc_length?: number
    history_doc_length?: number
    tc?: boolean
    user_id?: string
  }
  projectHistoryId?: string
}
