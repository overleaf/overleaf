import type { FileRef } from './file-ref'
import type { Doc } from './doc'

export type FileTree = {
  _id: string
  name: string
  folders: FileTree[]
  fileRefs: FileRef[]
  docs: Doc[]
}
