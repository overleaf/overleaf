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
}

export type RawV2DocVersions = Record<string, { pathname: string; v: number }>
