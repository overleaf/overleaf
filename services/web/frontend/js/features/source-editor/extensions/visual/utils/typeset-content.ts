import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import { COMMAND_SUBSTITUTIONS } from '../visual-widgets/character'

const isUnknownCommandWithName = (
  node: SyntaxNode,
  command: string,
  getText: (from: number, to: number) => string
): boolean => {
  const commandName = getUnknownCommandName(node, getText)
  if (commandName === undefined) {
    return false
  }
  return commandName === command
}

const getUnknownCommandName = (
  node: SyntaxNode,
  getText: (from: number, to: number) => string
): string | undefined => {
  if (!node.type.is('UnknownCommand')) {
    return undefined
  }
  const commandNameNode = node.getChild('CtrlSeq')
  if (!commandNameNode) {
    return undefined
  }
  const commandName = getText(commandNameNode.from, commandNameNode.to)
  return commandName
}

type NodeMapping = {
  elementType: keyof HTMLElementTagNameMap
  className?: string
}
type MarkupMapping = {
  [command: string]: NodeMapping
}
const MARKUP_COMMANDS: MarkupMapping = {
  '\\textit': {
    elementType: 'i',
  },
  '\\textbf': {
    elementType: 'b',
  },
  '\\emph': {
    elementType: 'em',
  },
  '\\texttt': {
    elementType: 'span',
    className: 'ol-cm-command-texttt',
  },
  '\\textsc': {
    elementType: 'span',
    className: 'ol-cm-command-textsc',
  },
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

      if (childNode.type.is('UnknownCommand')) {
        const commandNameNode = childNode.getChild('CtrlSeq')
        if (commandNameNode) {
          const commandName = getText(commandNameNode.from, commandNameNode.to)
          const mapping: NodeMapping | undefined = MARKUP_COMMANDS[commandName]
          if (mapping) {
            const element = document.createElement(mapping.elementType)
            if (mapping.className) {
              element.classList.add(mapping.className)
            }
            pushAncestor(element)
            const textArgument = childNode.getChild('TextArgument')
            from = textArgument?.getChild('LongArg')?.from ?? childNode.to
            return
          }
        }
      }
      if (isUnknownCommandWithName(childNode, '\\and', getText)) {
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
      } else if (childNode.type.is('UnknownCommand')) {
        const command = getText(childNode.from, childNode.to)
        const symbol = COMMAND_SUBSTITUTIONS.get(command.trim())
        if (symbol !== undefined) {
          ancestor().append(document.createTextNode(symbol))
          from = childNode.to
          return false
        }
      }
    },
    function leave(childNodeRef) {
      const childNode = childNodeRef.node
      const commandName = getUnknownCommandName(childNode, getText)
      if (
        (commandName && Boolean(MARKUP_COMMANDS[commandName])) ||
        isUnknownCommandWithName(childNode, '\\and', getText)
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
