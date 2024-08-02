import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import { COMMAND_SUBSTITUTIONS } from '../visual-widgets/character'

type Markup = {
  elementType: keyof HTMLElementTagNameMap
  className?: string
}

const textFormattingMarkupMap = new Map<string, Markup>([
  [
    'TextBoldCommand', // \\textbf
    { elementType: 'b' },
  ],
  [
    'TextItalicCommand', // \\textit
    { elementType: 'i' },
  ],
  [
    'TextSmallCapsCommand', // \\textsc
    { elementType: 'span', className: 'ol-cm-command-textsc' },
  ],
  [
    'TextTeletypeCommand', // \\texttt
    { elementType: 'span', className: 'ol-cm-command-texttt' },
  ],
  [
    'TextSuperscriptCommand', // \\textsuperscript
    { elementType: 'sup' },
  ],
  [
    'TextSubscriptCommand', // \\textsubscript
    { elementType: 'sub' },
  ],
  [
    'EmphasisCommand', // \\emph
    { elementType: 'em' },
  ],
  [
    'UnderlineCommand', // \\underline
    { elementType: 'span', className: 'ol-cm-command-underline' },
  ],
])

const markupMap = new Map<string, Markup>([
  ['\\and', { elementType: 'span', className: 'ol-cm-command-and' }],
])

/**
 * Does a small amount of typesetting of LaTeX content into a DOM element.
 * Does **not** typeset math, you **must manually** invoke MathJax after this
 * function if you wish to typeset math content.
 * @param node The syntax node containing the text to be typeset
 * @param element The DOM element to typeset into
 * @param getText The editor state where `node` is from or a custom function
 */
export function typesetNodeIntoElement(
  node: SyntaxNode,
  element: HTMLElement,
  getText: EditorState | ((from: number, to: number) => string)
) {
  if (getText instanceof EditorState) {
    getText = getText.sliceDoc.bind(getText)
  }

  // If we're a TextArgument node, we should skip the braces
  const argument = node.getChild('LongArg')
  if (argument) {
    node = argument
  }

  const ancestorStack = [element]

  const ancestor = () => ancestorStack[ancestorStack.length - 1]
  const popAncestor = () => ancestorStack.pop()!
  const pushAncestor = (element: HTMLElement) => ancestorStack.push(element)

  let from = node.from

  const addMarkup = (markup: Markup, childNode: SyntaxNode) => {
    const element = document.createElement(markup.elementType)
    if (markup.className) {
      element.classList.add(markup.className)
    }
    pushAncestor(element)
    from = chooseFrom(childNode)
  }

  node.cursor().iterate(
    function enter(childNodeRef) {
      const childNode = childNodeRef.node

      if (from < childNode.from) {
        ancestor().append(
          document.createTextNode(getText(from, childNode.from))
        )
        from = childNode.from
      }

      // commands defined in the grammar
      const markup = textFormattingMarkupMap.get(childNode.type.name)
      if (markup) {
        addMarkup(markup, childNode)
        return
      }

      // commands not defined in the grammar
      const commandName = unknownCommandName(childNode, getText)
      if (commandName) {
        const markup = markupMap.get(commandName)
        if (markup) {
          addMarkup(markup, childNode)
          return
        }

        if (['\\corref', '\\fnref', '\\thanks'].includes(commandName)) {
          // ignoring these commands
          from = childNode.to
          return false
        }

        const symbol = COMMAND_SUBSTITUTIONS.get(commandName)
        if (symbol) {
          ancestor().append(document.createTextNode(symbol))
          from = childNode.to
          return false
        }
      } else if (childNode.type.is('LineBreak')) {
        ancestor().append(document.createElement('br'))
        from = childNode.to
      }
    },
    function leave(childNodeRef) {
      const childNode = childNodeRef.node

      if (shouldHandleLeave(childNode, getText)) {
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

const chooseFrom = (node: SyntaxNode) =>
  node.getChild('TextArgument')?.getChild('LongArg')?.from ?? node.to

const shouldHandleLeave = (
  node: SyntaxNode,
  getText: (from: number, to: number) => string
) => {
  if (textFormattingMarkupMap.has(node.type.name)) {
    return true
  }

  const commandName = unknownCommandName(node, getText)
  return commandName && markupMap.has(commandName)
}

const unknownCommandName = (
  node: SyntaxNode,
  getText: (from: number, to: number) => string
): string | undefined => {
  if (node.type.is('UnknownCommand')) {
    const commandNameNode = node.getChild('$CtrlSeq')
    if (commandNameNode) {
      return getText(commandNameNode.from, commandNameNode.to).trim()
    }
  }
}
