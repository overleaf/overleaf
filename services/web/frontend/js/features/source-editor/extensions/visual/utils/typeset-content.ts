import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'

const isUnknownCommandWithName = (
  node: SyntaxNode,
  command: string,
  getText: (from: number, to: number) => string
): boolean => {
  if (!node.type.is('UnknownCommand')) {
    return false
  }
  const commandNameNode = node.getChild('CtrlSeq')
  if (!commandNameNode) {
    return false
  }
  const commandName = getText(commandNameNode.from, commandNameNode.to)
  return commandName === command
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
  state: EditorState | ((from: number, to: number) => string)
) {
  let getText: (from: number, to: number) => string
  if (typeof state === 'function') {
    getText = state
  } else {
    getText = state!.sliceDoc.bind(state!)
  }
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
          document.createTextNode(getText(from, childNode.from))
        )

        from = childNode.from
      }
      if (isUnknownCommandWithName(childNode, '\\textit', getText)) {
        pushAncestor(document.createElement('i'))
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\textbf', getText)) {
        pushAncestor(document.createElement('b'))
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\emph', getText)) {
        pushAncestor(document.createElement('em'))
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\texttt', getText)) {
        const spanElement = document.createElement('span')
        spanElement.classList.add('ol-cm-command-texttt')
        pushAncestor(spanElement)
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (isUnknownCommandWithName(childNode, '\\and', getText)) {
        const spanElement = document.createElement('span')
        spanElement.classList.add('ol-cm-command-and')
        pushAncestor(spanElement)
        const textArgument = childNode.getChild('TextArgument')
        from = textArgument?.getChild('LongArg')?.from ?? childNode.to
      } else if (
        isUnknownCommandWithName(childNode, '\\corref', getText) ||
        isUnknownCommandWithName(childNode, '\\fnref', getText) ||
        isUnknownCommandWithName(childNode, '\\thanks', getText)
      ) {
        // ignoring these commands
        from = childNode.to
        return false
      } else if (childNode.type.is('LineBreak')) {
        ancestor().appendChild(document.createElement('br'))
        from = childNode.to
      }
    },
    function leave(childNodeRef) {
      const childNode = childNodeRef.node
      if (
        isUnknownCommandWithName(childNode, '\\and', getText) ||
        isUnknownCommandWithName(childNode, '\\textit', getText) ||
        isUnknownCommandWithName(childNode, '\\textbf', getText) ||
        isUnknownCommandWithName(childNode, '\\emph', getText) ||
        isUnknownCommandWithName(childNode, '\\texttt', getText)
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
    ancestor().append(document.createTextNode(getText(from, node.to)))
  }

  return element
}
