export { getNestingLevel, nestOutline } from './tree-operations/outline'

export type {
  FlatOutline,
  FlatOutlineItem,
  Outline,
} from './tree-operations/outline'

export { previousSiblingIs } from './tree-operations/common'

export {
  cursorIsAtBeginEnvironment,
  cursorIsAtEndEnvironment,
  getEnvironmentArguments,
} from './tree-operations/environments'

export {
  ancestorNodeOfType,
  ancestorOfNodeWithType,
  getBibkeyArgumentNode,
  descendantsOfNodeWithType,
  matchingAncestor,
} from './tree-operations/ancestors'

export {
  NormalTextSpan,
  getNormalTextSpansFromLine,
} from './tree-operations/text'

export {
  ifInType,
  isInEmptyArgumentNodeForAutocomplete,
} from './tree-operations/completions'

export { tokenNames, Tokens } from './tree-operations/tokens'

export {
  commentIsOpenFold,
  commentIsCloseFold,
  findClosingFoldComment,
  getFoldRange,
} from './tree-operations/comments'
