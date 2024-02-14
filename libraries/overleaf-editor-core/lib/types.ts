import Blob from './blob'

export type BlobStore = {
  getString(hash: string): Promise<string>
  putString(content: string): Promise<Blob>
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
  type: 'insert' | 'delete' | 'none'
  userId: string
  ts: string
}

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
      tracking?: TrackingPropsRawData
    }
  | number

export type RawScanOp = RawInsertOp | RawRemoveOp | RawRetainOp

export type RawTextOperation = {
  textOperation: RawScanOp[]
}

export type RawEditOperation = RawTextOperation
