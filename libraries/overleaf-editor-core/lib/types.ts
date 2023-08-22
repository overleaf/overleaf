import Blob from './blob'

export type BlobStore = {
  getString(hash: string): Promise<string>
  putString(content: string): Promise<Blob>
}

export type StringFileRawData = {
  content: string
}

export type RawV2DocVersions = Record<string, { pathname: string; v: number }>
