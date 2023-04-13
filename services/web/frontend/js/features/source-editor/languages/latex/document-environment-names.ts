import {
  EnvironmentName,
  enterNode,
} from '../../utils/tree-operations/environments'
import { makeProjectionStateField } from '../../utils/projection-state-field'

export const documentEnvironmentNames =
  makeProjectionStateField<EnvironmentName>(enterNode)
