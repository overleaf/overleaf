import { EditorState } from '@codemirror/state'
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { isUnknownCommandWithName } from '../../../utils/tree-query'

function isNewline(node: SyntaxNodeRef, state: EditorState) {
  if (!node.type.is('CtrlSym')) {
    return false
  }
  const command = state.sliceDoc(node.from, node.to)
  return command === '\\\\'
}

/**
 * Does a small amount of typesetting of LaTeX content into a DOM element.
 * Does **not** typeset math, you **must manually** invoke MathJax after this
 * function if you wish to typeset math content.
 * @param node The syntax node containing the text to be typeset
 * @param element The DOM element to typeset into
 * @param state The editor state where `node` is from
 */
export function typesetNodeIntoElement(
  node: SyntaxNode,
  element: HTMLElement,
  state: EditorState
) {
  // If we're a TextArgument node, we should skip the braces
  const argument = node.getChild('LongArg')
  if (argument) {
    node = argument
  }
  const ancestorStack = [element]

  const ancestor = () => ancestorStack[ancestorStack.length - 1]
  const popAncestor = () => ancestorStack.pop()!
  const pushAncestor = (x: HTMLElement) => ancestorStack.push(x)

  // NOTE: Quite hack-ish way to omit closing braces from the output
  const ignoredRanges: { from: number; to: number }[] = []
  let from = node.from

  node.cursor().iterate(
    function enter(childNodeRef) {
      const childNode = childNodeRef.node
      if (from < childNode.from) {
        ancestor().append(
          document.createTextNode(state.sliceDoc(from, childNode.from))
        )
        from = ignoredRanges.some(
          range => range.from <= childNode.from && range.to >= childNode.from
        )
          ? childNode.to
          : childNode.from
      }
      if (isUnknownCommandWithName(childNode, '\\textit', state)) {
        pushAncestor(document.createElement('i'))
        const argument = childNode.getChild('TextArgument')
        from = argument?.getChild('LongArg')?.from ?? childNode.to
        const endBrace = argument?.getChild('CloseBrace')
        if (endBrace) {
          ignoredRanges.push(endBrace)
        }
      } else if (isNewline(childNode, state)) {
        ancestor().appendChild(document.createElement('br'))
        from = childNode.to
      }
    },
    function leave(childNodeRef) {
      const childNode = childNodeRef.node
      if (isUnknownCommandWithName(childNode, '\\textit', state)) {
        const typeSetElement = popAncestor()
        ancestor().appendChild(typeSetElement)
      }
    }
  )
  if (from < node.to) {
    ancestor().append(document.createTextNode(state.sliceDoc(from, node.to)))
  }

  return element
}
