export type Update =
  | TextUpdate
  | AddDocUpdate
  | AddFileUpdate
  | RenameUpdate
  | DeleteCommentUpdate
  | SetCommentStateUpdate

export type UpdateMeta = {
  user_id: string
  ts: number
  source?: string
  type?: string
  origin?: RawOrigin
  tc?: string
}

export type TextUpdate = {
  doc: string
  op: Op[]
  v: number
  meta: UpdateMeta & {
    pathname: string
    doc_length: number
    history_doc_length?: number
  }
}

export type SetCommentStateUpdate = {
  pathname: string
  commentId: string
  resolved: boolean
  meta: UpdateMeta
}

export type DeleteCommentUpdate = {
  pathname: string
  deleteComment: string
  meta: UpdateMeta
}

type ProjectUpdateBase = {
  version: string
  projectHistoryId: string
  meta: UpdateMeta
  doc: string
}

export type AddDocUpdate = ProjectUpdateBase & {
  pathname: string
  docLines: string[]
}

export type AddFileUpdate = ProjectUpdateBase & {
  pathname: string
  file: string
  url: string
}

export type RenameUpdate = ProjectUpdateBase & {
  pathname: string
  new_pathname: string
}

export type Op = RetainOp | InsertOp | DeleteOp | CommentOp

export type RetainOp = {
  r: string
  p: number
  hpos?: number
  tracking?: TrackingProps
}

export type InsertOp = {
  i: string
  p: number
  u?: boolean
  hpos?: number
  trackedDeleteRejection?: boolean
  commentIds?: string[]
}

export type DeleteOp = {
  d: string
  p: number
  u?: boolean
  hpos?: number
  trackedChanges?: TrackedChangesInsideDelete[]
}

export type TrackedChangesInsideDelete = {
  type: 'insert' | 'delete'
  offset: number
  length: number
}

export type CommentOp = {
  c: string
  p: number
  t: string
  hpos?: number
  hlen?: number
}

export type UpdateWithBlob = {
  update: Update
  blobHash: string
}

export type RawOrigin = {
  kind: string
}

export type TrackingProps = {
  type: 'insert' | 'delete' | 'none'
  userId: string
  ts: string
}

export type RawScanOp =
  | number
  | string
  | { r: number; tracking?: TrackingProps }
  | { i: string; tracking?: TrackingProps; commentIds?: string[] }
  | { d: number; tracking?: TrackingProps }

export type TrackedChangeSnapshot = {
  op: {
    p: number
  } & ({ d: string } | { i: string })
  metadata: {
    ts: string
    user_id: string
  }
}

export type CommentSnapshot = {
  op: {
    p: number
    t: string
    c: string
  }
}

export type RangesSnapshot = {
  changes: TrackedChangeSnapshot[]
  comments: CommentSnapshot[]
}
