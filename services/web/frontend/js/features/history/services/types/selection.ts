import { FileDiff, FileUnchanged } from './file'
import { UpdateRange } from './update'
import { Nullable } from '../../../../../../types/utils'

export interface Selection {
  updateRange: UpdateRange | null
  comparing: boolean
  files: FileDiff[]
  selectedFile?: FileDiff
  previouslySelectedPathname: Nullable<FileUnchanged['pathname']>
}
