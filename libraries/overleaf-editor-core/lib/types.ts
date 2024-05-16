import Blob from './blob'
import TrackingProps from './file_data/tracking_props'
import ClearTrackingProps from './file_data/clear_tracking_props'

export type BlobStore = {
  getBlob(hash: string): Promise<Blob | null>
  getString(hash: string): Promise<string>
  putString(content: string): Promise<Blob>
  putObject(obj: object): Promise<Blob>
  getObject<T = unknown>(hash: string): Promise<T>
}

export type ReadonlyBlobStore = Pick<BlobStore, 'getString' | 'getObject'>

export type RangesBlob = {
  comments: CommentRawData[]
  trackedChanges: TrackedChangeRawData[]
}

type Range = {
  pos: number
  length: number
}

export type CommentRawData = {
  id: string
  ranges: Range[]
  resolved?: boolean
}

export type TrackedChangeRawData = {
  range: Range
  tracking: TrackingPropsRawData
}

export type TrackingPropsRawData = {
  type: 'insert' | 'delete'
  userId: string
  ts: string
}

export type ClearTrackingPropsRawData = {
  type: 'none'
}

export type TrackingDirective = TrackingProps | ClearTrackingProps

export type StringFileRawData = {
  content: string
  comments?: CommentRawData[]
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
      tracking?: TrackingPropsRawData | ClearTrackingPropsRawData
    }
  | number

export type RawScanOp = RawInsertOp | RawRemoveOp | RawRetainOp

export type RawTextOperation = {
  textOperation: RawScanOp[]
}

export type RawAddCommentOperation = {
  commentId: string
  ranges: Range[]
  resolved?: boolean
}

export type RawDeleteCommentOperation = { deleteComment: string }

export type RawSetCommentStateOperation = {
  commentId: string
  resolved: boolean
}

export type RawEditOperation =
  | RawTextOperation
  | RawAddCommentOperation
  | RawDeleteCommentOperation
  | RawSetCommentStateOperation
