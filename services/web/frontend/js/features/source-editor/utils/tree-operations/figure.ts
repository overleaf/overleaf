import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { CenteringCtrlSeq } from '../../lezer-latex/latex.terms.mjs'

export function centeringNodeForEnvironment(
  environmentNodeRef: SyntaxNodeRef
): SyntaxNode | null {
  let centeringNode: SyntaxNode | null = null
  const cursor = environmentNodeRef.node.cursor()
  cursor.iterate(nodeRef => {
    if (centeringNode) {
      return false
    }
    if (nodeRef.type.is(CenteringCtrlSeq)) {
      centeringNode = nodeRef.node
      return false
    }
    // don't descend into nested environments
    if (
      nodeRef.node !== environmentNodeRef.node &&
      nodeRef.type.is('$Environment')
    ) {
      return false
    }
  })
  return centeringNode
}
