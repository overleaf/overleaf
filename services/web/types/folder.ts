import { Doc } from './doc'
import { FileRef } from './file-ref'

export type Folder = {
  _id: string
  name: string
  docs: Doc[]
  folders: Folder[]
  fileRefs: FileRef[]
}
