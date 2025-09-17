import type { ListObjectsV2Output, _Object } from '@aws-sdk/client-s3'

export type ListDirectoryResult = {
  contents: Array<_Object>
  response: ListObjectsV2Output
}
