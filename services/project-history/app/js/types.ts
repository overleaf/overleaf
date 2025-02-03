import { HistoryRanges } from '../../../document-updater/app/js/types'
import { LinkedFileData, RawOrigin } from 'overleaf-editor-core/lib/types'

export type Update =
  | TextUpdate
  | AddDocUpdate
  | AddFileUpdate
  | RenameUpdate
  | DeleteCommentUpdate
  | SetCommentStateUpdate
  | SetFileMetadataOperation
  | ResyncProjectStructureUpdate
  | ResyncDocContentUpdate

export type ProjectStructureUpdate =
  | AddDocUpdate
  | AddFileUpdate
  | RenameUpdate
  | SetFileMetadataOperation

export type UpdateMeta = {
  user_id: string
  ts: number
  source?: string
  type?: string
  origin?: RawOrigin
  tc?: string
  resync?: boolean
}

export type TextUpdate = {
  doc: string
  op: Op[]
  v: number
  meta: UpdateMeta & {
    pathname: string
    doc_length: number
    doc_hash?: string
    history_doc_length?: number
  }
}

export type SetCommentStateUpdate = {
  pathname: string
  commentId: string
  resolved: boolean
  meta: UpdateMeta
}

export type SetFileMetadataOperation = {
  pathname: string
  meta: UpdateMeta
  metadata: LinkedFileData | object
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
  docLines: string
  ranges?: HistoryRanges
}

export type AddFileUpdate = ProjectUpdateBase & {
  pathname: string
  file: string
  url: string
  hash: string
  createdBlob?: boolean
  metadata?: LinkedFileData
}

export type RenameUpdate = ProjectUpdateBase & {
  pathname: string
  new_pathname: string
}

export type ResyncProjectStructureUpdate = {
  resyncProjectStructure: {
    docs: Doc[]
    files: File[]
  }
  projectHistoryId: string
  meta: {
    ts: string
  }
  // optional fields for resyncProjectStructureOnly=true
  resyncProjectStructureOnly?: boolean
  _raw: string
}

export type ResyncDocContentUpdate = {
  resyncDocContent: {
    content: string
    version: number
    ranges?: Ranges
    resolvedCommentIds?: string[]
  }
  projectHistoryId: string
  path: string
  doc: string
  meta: {
    ts: string
  }
}

export type Op = RetainOp | InsertOp | DeleteOp | CommentOp

export type RetainOp = {
  r: string
  p: number
  hpos?: number
  tracking?: TrackingDirective
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
  resolved?: boolean
}

export type UpdateWithBlob<T extends Update = Update> = {
  update: T
  blobHashes: T extends AddDocUpdate | AddFileUpdate
    ? {
        file: string
        ranges?: string
      }
    : never
}

export type TrackingProps = {
  type: 'insert' | 'delete'
  userId: string
  ts: string
}

export type TrackingDirective = TrackingProps | { type: 'none' }

export type TrackingType = 'insert' | 'delete' | 'none'

export type RawScanOp =
  | number
  | string
  | { r: number; tracking?: TrackingDirective }
  | { i: string; tracking?: TrackingProps; commentIds?: string[] }
  | { d: number }

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
    resolved: boolean
  }
}

export type RangesSnapshot = {
  changes: TrackedChangeSnapshot[]
  comments: CommentSnapshot[]
}

export type Doc = {
  doc: string
  path: string
}

export type File = {
  file: string
  url?: string
  path: string
  _hash?: string
  createdBlob?: boolean
  metadata?: LinkedFileData
}

export type Entity = Doc | File

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
  op: InsertOp | DeleteOp
  metadata: {
    user_id: string
    ts: string
  }
}

export type TrackedChangeTransition = {
  pos: number
  tracking: TrackingDirective
  stage: 'persisted' | 'expected'
}
