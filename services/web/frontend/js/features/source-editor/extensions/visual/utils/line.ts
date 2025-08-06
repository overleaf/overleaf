import { Line } from '@codemirror/state'
import { SyntaxNodeRef } from '@lezer/common'

export const lineContainsOnlyNode = (line: Line, nodeRef: SyntaxNodeRef) =>
  line.text.trim().length === nodeRef.to - nodeRef.from
