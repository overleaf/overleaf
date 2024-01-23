import Blob from './blob'

export type BlobStore = {
  getString(hash: string): Promise<string>
  putString(content: string): Promise<Blob>
}

export type CommentRawData = {
  id: string
  ranges: {
    pos: number
    length: number
  }[]
  resolved?: boolean
}

export type StringFileRawData = {
  content: string
  comments?: CommentRawData[]
}

export type RawV2DocVersions = Record<string, { pathname: string; v: number }>
