import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { CenteringCtrlSeq } from '../../lezer-latex/latex.terms.mjs'

export function centeringNodeForEnvironment(
  node: SyntaxNodeRef
): SyntaxNode | null {
  let centeringNode: SyntaxNode | null = null
  const cursor = node.node.cursor()
  cursor.next()
  cursor.iterate(nodeRef => {
    if (centeringNode) {
      return false
    }
    if (nodeRef.from > node.to) {
      return false
    }
    if (nodeRef.type.is(CenteringCtrlSeq)) {
      centeringNode = nodeRef.node
      return false
    }
    // don't descend into nested environments
    if (nodeRef.type.is('$Environment')) {
      return false
    }
  })
  return centeringNode
}
