import { Command, enterNode } from '../../utils/tree-operations/commands'
import { makeProjectionStateField } from '../../utils/projection-state-field'

export const documentCommands = makeProjectionStateField<Command>(enterNode)
