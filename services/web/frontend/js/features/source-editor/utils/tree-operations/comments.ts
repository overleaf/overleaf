import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'

const HUNDRED_MS = 100

/**
 * Does this Comment node look like '% {' ?
 * */
export const commentIsOpenFold = (
  node: SyntaxNode,
  state: EditorState
): boolean => {
  const content = state.doc.sliceString(node.from, node.to)
  return !!content.match(/%\s*\{\s*/)
}

/**
 * Does this Comment node look like '% }' ?
 * */
export const commentIsCloseFold = (
  node: SyntaxNode,
  state: EditorState
): boolean => {
  const content = state.doc.sliceString(node.from, node.to)
  return !!content.match(/%\s*\}\s*/)
}

const SEARCH_FORWARD_LIMIT = 6000

/**
 * Given an opening fold Comment, find its corresponding closing Comment,
 * accounting for nesting.
 * */
export const findClosingFoldComment = (
  node: SyntaxNode,
  state: EditorState
): SyntaxNode | undefined => {
  const start = node.to + 1
  const upto = Math.min(start + SEARCH_FORWARD_LIMIT, state.doc.length)
  const tree = ensureSyntaxTree(state, upto, HUNDRED_MS)
  if (!tree) {
    return
  }
  let closingFoldNode: SyntaxNode | undefined
  let nestingLevel = 0
  tree.iterate({
    from: start,
    to: upto,
    enter: n => {
      if (closingFoldNode) {
        return false
      }
      if (n.node.type.is('Comment')) {
        if (commentIsOpenFold(n.node, state)) {
          nestingLevel++
        } else if (commentIsCloseFold(n.node, state)) {
          if (nestingLevel > 0) {
            nestingLevel--
          } else {
            closingFoldNode = n.node
            return false
          }
        }
      }
    },
  })
  return closingFoldNode
}

/**
 * Given two Comment nodes, get the positions we want to actually fold between,
 * accounting for the opening and closing brace.
 *
 * The resulting fold looks like `% {----}` in the editor.
 *
 */
export const getFoldRange = (
  startNode: SyntaxNode,
  endNode: SyntaxNode,
  state: EditorState
): { from: number; to: number } | null => {
  const startContent = state.doc.sliceString(startNode.from, startNode.to)
  const endContent = state.doc.sliceString(endNode.from, endNode.to)

  const openBracePos = startContent.indexOf('{')
  const closeBracePos = endContent.indexOf('}')
  if (openBracePos < 0 || closeBracePos < 0) {
    return null
  }

  return {
    from: startNode.from + openBracePos + 1,
    to: endNode.from + closeBracePos,
  }
}
