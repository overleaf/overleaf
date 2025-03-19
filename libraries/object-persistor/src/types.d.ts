import type { ListObjectsV2Output, Object } from 'aws-sdk/clients/s3'

export type ListDirectoryResult = {
  contents: Array<Object>
  response: ListObjectsV2Output
}
