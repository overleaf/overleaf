import { FlatOutlineItem } from '../../utils/tree-query'
import { enterNode } from '../../utils/tree-operations/outline'
import { makeProjectionStateField } from '../../utils/projection-state-field'

export const documentOutline =
  makeProjectionStateField<FlatOutlineItem>(enterNode)
