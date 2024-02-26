import Blob from './blob'

export type BlobStore = {
  getBlob(hash: string): Promise<Blob>
  getString(hash: string): Promise<string>
  putString(content: string): Promise<Blob>
  putObject(obj: object): Promise<Blob>
  getObject<T = unknown>(hash: string): Promise<T>
}

export type RangesBlob = {
  comments: CommentsListRawData
  trackedChanges: TrackedChangeRawData[]
}

type Range = {
  pos: number
  length: number
}

export type CommentRawData = {
  ranges: Range[]
  resolved?: boolean
}

export type TrackedChangeRawData = {
  range: Range
  tracking: TrackingPropsRawData
}

export type TrackingPropsRawData = {
  type: 'insert' | 'delete' | 'none'
  userId: string
  ts: string
}

export type CommentsListRawData = Array<{ id: string } & CommentRawData>

export type StringFileRawData = {
  content: string
  comments?: CommentsListRawData
  trackedChanges?: TrackedChangeRawData[]
}

export type RawV2DocVersions = Record<string, { pathname: string; v: number }>

export type RawInsertOp =
  | {
      i: string
      commentIds?: string[]
      tracking?: TrackingPropsRawData
    }
  | string

export type RawRemoveOp = number
export type RawRetainOp =
  | {
      r: number
      commentIds?: string[]
      tracking?: TrackingPropsRawData
    }
  | number

export type RawScanOp = RawInsertOp | RawRemoveOp | RawRetainOp

export type RawTextOperation = {
  textOperation: RawScanOp[]
}

export type RawAddCommentOperation = CommentRawData & { commentId: string }

export type RawDeleteCommentOperation = { deleteComment: string }

export type RawSetCommentStateOperation = { commentId: string; resolved: boolean }

export type RawEditOperation =
  | RawTextOperation
  | RawAddCommentOperation
  | RawDeleteCommentOperation
  | RawSetCommentStateOperation
