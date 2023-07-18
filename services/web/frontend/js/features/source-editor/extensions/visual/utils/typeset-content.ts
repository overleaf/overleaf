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

  let from = node.from

  node.cursor().iterate(
    function enter(childNodeRef) {
      const childNode = childNodeRef.node
      if (from < childNode.from) {
        ancestor().append(
          document.createTextNode(state.sliceDoc(from, childNode.from))
        )

        from = childNode.from
      }
      if (isUnknownCommandWithName(childNode, '\\textit', state)) {
        pushAncestor(document.createElement('i'))
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\textbf', state)) {
        pushAncestor(document.createElement('b'))
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\emph', state)) {
        pushAncestor(document.createElement('em'))
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\texttt', state)) {
        const spanElement = document.createElement('span')
        spanElement.classList.add('ol-cm-command-texttt')
        pushAncestor(spanElement)
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\and', state)) {
        const spanElement = document.createElement('span')
        spanElement.classList.add('ol-cm-command-and')
        pushAncestor(spanElement)
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (
        isUnknownCommandWithName(childNode, '\\corref', state) ||
        isUnknownCommandWithName(childNode, '\\fnref', state) ||
        isUnknownCommandWithName(childNode, '\\thanks', state)
      ) {
        // ignoring these commands
        from = childNode.to
        return false
      } else if (isNewline(childNode, state)) {
        ancestor().appendChild(document.createElement('br'))
        from = childNode.to
      }
    },
    function leave(childNodeRef) {
      const childNode = childNodeRef.node
      if (
        isUnknownCommandWithName(childNode, '\\and', state) ||
        isUnknownCommandWithName(childNode, '\\textit', state) ||
        isUnknownCommandWithName(childNode, '\\textbf', state) ||
        isUnknownCommandWithName(childNode, '\\emph', state) ||
        isUnknownCommandWithName(childNode, '\\texttt', state)
      ) {
        const typeSetElement = popAncestor()
        ancestor().appendChild(typeSetElement)
        const textArgument = childNode.getChild('TextArgument')
        const endBrace = textArgument?.getChild('CloseBrace')
        if (endBrace) {
          from = endBrace.to
        }
      }
    }
  )
  if (from < node.to) {
    ancestor().append(document.createTextNode(state.sliceDoc(from, node.to)))
  }

  return element
}
