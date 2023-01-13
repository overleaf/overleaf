import Blob from './blob'
import BPromise from 'bluebird'

export type BlobStore = {
  getString(hash: string): BPromise<string>
  putString(content: string): BPromise<Blob>
}

export type StringFileRawData = {
  content: string
}

export type RawV2DocVersions = Record<string, { pathname: string; v: number }>
