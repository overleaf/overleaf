import { enterNode, FlatOutlineItem } from '../../utils/tree-operations/outline'
import { makeProjectionStateField } from '../../utils/projection-state-field'

export const documentOutline =
  makeProjectionStateField<FlatOutlineItem>(enterNode)
