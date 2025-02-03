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

export type RawRange = {
  pos: number
  length: number
}

export type CommentRawData = {
  id: string
  ranges: RawRange[]
  resolved?: boolean
}

export type TrackedChangeRawData = {
  range: RawRange
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

export type RawOrigin = {
  kind: string
}

export type RawChange = {
  operations: RawOperation[]
  timestamp: string
  authors?: (number | null)[]
  v2Authors: string[]
  origin: RawOrigin
  projectVersion: string
  v2DocVersions: RawV2DocVersions
}

export type RawOperation =
  | RawEditFileOperation
  // TODO(das7pad): add types for all the other operations
  | object

export type RawSnapshot = {
  files: RawFileMap
  projectVersion?: string
  v2DocVersions?: RawV2DocVersions | null
}

export type RawHistory = {
  snapshot: RawSnapshot
  changes: RawChange[]
}

export type RawChunk = {
  history: RawHistory
  startVersion: number
}

export type RawFileMap = Record<string, RawFile>

export type RawFile = { metadata?: Object } & RawFileData

export type RawFileData =
  | RawBinaryFileData
  | RawHashFileData
  | RawHollowBinaryFileData
  | RawHollowStringFileData
  | RawLazyStringFileData
  | StringFileRawData

export type RawHashFileData = { hash: string; rangesHash?: string }
export type RawBinaryFileData = { hash: string; byteLength: number }
export type RawLazyStringFileData = {
  hash: string
  stringLength: number
  rangesHash?: string
  operations?: RawEditOperation[]
}
export type RawHollowBinaryFileData = { byteLength: number }
export type RawHollowStringFileData = { stringLength: number }

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
  contentHash?: string
}

export type RawAddCommentOperation = {
  commentId: string
  ranges: RawRange[]
  resolved?: boolean
}

export type RawDeleteCommentOperation = { deleteComment: string }

export type RawSetCommentStateOperation = {
  commentId: string
  resolved: boolean
}

export type RawEditNoOperation = {
  noOp: true
}

export type RawEditFileOperation = RawEditOperation & { pathname: string }

export type RawEditOperation =
  | RawTextOperation
  | RawAddCommentOperation
  | RawDeleteCommentOperation
  | RawSetCommentStateOperation
  | RawEditNoOperation

export type LinkedFileData = {
  importedAt: string
  provider: string
  [other: string]: any
}

export type RawLabel = {
  text: string
  authorId: number | null
  timestamp: string
  version: number
}
