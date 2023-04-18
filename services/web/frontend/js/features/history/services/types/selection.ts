import { FileDiff } from './file'
import { UpdateRange } from './update'

export interface Selection {
  updateRange: UpdateRange | null
  comparing: boolean
  files: FileDiff[]
  pathname: string | null
}
