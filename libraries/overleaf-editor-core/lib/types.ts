import type Blob from './blob'
import type TrackingProps from './file_data/tracking_props'
import type ClearTrackingProps from './file_data/clear_tracking_props'
import type { z } from '@overleaf/validation-tools'
import type * as schemas from './schemas'

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

export type RawRange = z.infer<typeof schemas.rawRange>

export type CommentRawData = {
  id: string
  ranges: RawRange[]
  resolved?: boolean
}

export type TrackedChangeRawData = {
  range: RawRange
  tracking: TrackingPropsRawData
}

export type TrackingPropsRawData = z.infer<typeof schemas.rawTrackingProps>

export type ClearTrackingPropsRawData = z.infer<
  typeof schemas.rawClearTrackingProps
>

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
  v2Authors?: string[]
  origin?: RawOrigin
  projectVersion?: string
  v2DocVersions?: RawV2DocVersions
}

export type RawOperation =
  | RawEditFileOperation
  // TODO(das7pad): add types for all the other operations
  | object

export type RawSnapshot = {
  files: RawFileMap
  projectVersion?: string
  v2DocVersions?: RawV2DocVersions | null
  timestamp?: string
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

export type RawInsertOp = z.infer<typeof schemas.rawInsertOp>

export type RawRemoveOp = z.infer<typeof schemas.rawRemoveOp>
export type RawRetainOp = z.infer<typeof schemas.rawRetainOp>

export type RawScanOp = z.infer<typeof schemas.rawScanOp>

export type RawTextOperation = z.infer<typeof schemas.rawTextOperation>

export type RawAddCommentOperation = z.infer<
  typeof schemas.rawAddCommentOperation
>

export type RawDeleteCommentOperation = z.infer<
  typeof schemas.rawDeleteCommentOperation
>

export type RawSetCommentStateOperation = z.infer<
  typeof schemas.rawSetCommentStateOperation
>

export type RawEditNoOperation = z.infer<typeof schemas.rawEditNoOperation>

export type RawEditFileOperation = RawEditOperation & { pathname: string }

export type RawEditOperation = z.infer<typeof schemas.rawEditOperation>

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
