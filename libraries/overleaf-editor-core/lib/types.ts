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

/**
 * Everything but looking a blob up by its hash: reading content and storing
 * content, which is all it takes to build operations over content.
 *
 * Looking a blob up is only ever needed for a file stored as a bare hash
 * (HashFileData), and one of those does not reach a consumer outside history-v1:
 * every snapshot and change it serves has blob metadata attached first
 * (chunk_store's lazyLoadHistoryFiles), so a file arrives already knowing its
 * own lengths. A store built for a consumer therefore does not need `getBlob`,
 * and one that reimplements the classification rule to answer it would be a
 * second opinion on whether a file is editable.
 */
export type ReadWriteBlobStore = Omit<BlobStore, 'getBlob'>

export type RangesBlob = {
  comments: CommentRawData[]
  trackedChanges: TrackedChangeRawData[]
}

export type RawRange = z.infer<typeof schemas.rawRange>

export type CommentRawData = z.infer<typeof schemas.rawComment>

export type TrackedChangeRawData = z.infer<typeof schemas.rawTrackedChange>

export type TrackingPropsRawData = z.infer<typeof schemas.rawTrackingProps>

export type ClearTrackingPropsRawData = z.infer<
  typeof schemas.rawClearTrackingProps
>

export type TrackingDirective = TrackingProps | ClearTrackingProps

export type StringFileRawData = z.infer<typeof schemas.rawStringFileData>

export type RawBaseOrigin = z.infer<typeof schemas.rawBaseOrigin>

export type RawRestoreOrigin = z.infer<typeof schemas.rawRestoreOrigin>

export type RawRestoreFileOrigin = z.infer<typeof schemas.rawRestoreFileOrigin>

export type RawRestoreProjectOrigin = z.infer<
  typeof schemas.rawRestoreProjectOrigin
>

export type RawOrigin = z.infer<typeof schemas.rawOrigin>

export type RawChange = z.infer<typeof schemas.rawChange>

export type RawOperation = z.infer<typeof schemas.rawOperation>

export type RawSnapshot = z.infer<typeof schemas.rawSnapshot>

export type RawHistory = {
  snapshot: RawSnapshot
  changes: RawChange[]
}

export type RawChunk = {
  history: RawHistory
  startVersion: number
}

export type RawFileMap = z.infer<typeof schemas.rawFileMap>

export type RawFile = z.infer<typeof schemas.rawFile>

export type RawFileData = z.infer<typeof schemas.rawFileData>

export type RawHashFileData = z.infer<typeof schemas.rawHashFileData>
export type RawBinaryFileData = z.infer<typeof schemas.rawBinaryFileData>
export type RawLazyStringFileData = z.infer<
  typeof schemas.rawLazyStringFileData
>
export type RawHollowBinaryFileData = z.infer<
  typeof schemas.rawHollowBinaryFileData
>
export type RawHollowStringFileData = z.infer<
  typeof schemas.rawHollowStringFileData
>

export type RawV2DocVersions = z.infer<typeof schemas.rawV2DocVersions>

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

export type RawEditFileOperation = z.infer<typeof schemas.rawEditFileOperation>

export type RawEditOperation = z.infer<typeof schemas.rawEditOperation>

export type LinkedFileData = z.infer<typeof schemas.rawLinkedFileData>

export type FileMetadata = z.infer<typeof schemas.rawFileMetadata>

export type RawLabel = {
  text: string
  authorId: number | null
  timestamp: string
  version: number
}
