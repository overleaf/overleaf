import {
  Environment,
  enterNode,
} from '../../utils/tree-operations/environments'
import { makeProjectionStateField } from '../../utils/projection-state-field'

export const documentEnvironments =
  makeProjectionStateField<Environment>(enterNode)
