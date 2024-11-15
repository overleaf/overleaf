import { EditorState } from '@codemirror/state'
import { SyntaxNode, SyntaxNodeRef } from '@lezer/common'
import { NodeIntersectsChangeFn, ProjectionItem } from './projection'
import * as tokens from '../../lezer-latex/latex.terms.mjs'
import { getEnvironmentArguments, getEnvironmentName } from './environments'
import { PartialFlatOutline } from '@/features/ide-react/context/outline-context'
import { texOrPdfString } from './commands'

export type Outline = {
  line: number
  title: string
  level: number
  children?: Outline[]
}

/**
 * A projection of a part of the file outline, typically a (sub)section heading
 */
export class FlatOutlineItem extends ProjectionItem {
  readonly level: number = 0
  readonly title: string = ''
}

export type FlatOutline = FlatOutlineItem[]

/* eslint-disable no-unused-vars */
enum NestingLevel {
  Book = 1,
  Part = 2,
  Chapter = 3,
  Section = 4,
  SubSection = 5,
  SubSubSection = 6,
  Paragraph = 7,
  SubParagraph = 8,
  Frame = 9,
  Invalid = -1,
}

const fallbackSectionNames: { [index: string]: NestingLevel } = {
  book: NestingLevel.Book,
  part: NestingLevel.Part,
  chapter: NestingLevel.Part,
  section: NestingLevel.Section,
  subsection: NestingLevel.SubSection,
  subsubsection: NestingLevel.SubSubSection,
  paragraph: NestingLevel.Paragraph,
  subparagraph: NestingLevel.SubParagraph,
  frame: NestingLevel.Frame,
}

export const getNestingLevel = (token: number | string): NestingLevel => {
  if (typeof token === 'string') {
    return fallbackSectionNames[token] ?? NestingLevel.Invalid
  }
  switch (token) {
    case tokens.Book:
      return NestingLevel.Book
    case tokens.Part:
      return NestingLevel.Part
    case tokens.Chapter:
      return NestingLevel.Chapter
    case tokens.Section:
      return NestingLevel.Section
    case tokens.SubSection:
      return NestingLevel.SubSection
    case tokens.SubSubSection:
      return NestingLevel.SubSubSection
    case tokens.Paragraph:
      return NestingLevel.Paragraph
    case tokens.SubParagraph:
      return NestingLevel.SubParagraph
    default:
      return NestingLevel.Invalid
  }
}

const getEntryText = (state: EditorState, node: SyntaxNodeRef): string => {
  const titleParts: string[] = []
  node.node.cursor().iterate(token => {
    // For some reason, iterate can possibly visit sibling nodes as well as
    // child nodes
    if (token.from >= node.to) {
      return false
    }

    // Hide label definitions within the sectioning command
    if (token.type.is('Label')) {
      return false
    }

    // Handle the texorpdfstring command
    if (token.type.is('UnknownCommand')) {
      const pdfString = texOrPdfString(state, token.node, 'pdf')
      if (pdfString) {
        titleParts.push(pdfString)
        return false
      }
    }

    // Only add text from leaf nodes
    if (token.node.firstChild) {
      return true
    }

    titleParts.push(state.doc.sliceString(token.from, token.to))
  })
  return titleParts.join('')
}

/**
 * Extracts FlatOutlineItem instances from the syntax tree
 */
export const enterNode = (
  state: EditorState,
  node: SyntaxNodeRef,
  items: FlatOutlineItem[],
  nodeIntersectsChange: NodeIntersectsChangeFn
): any => {
  if (node.type.is('SectioningCommand')) {
    const command = node.node
    const parent = command.parent

    if (!nodeIntersectsChange(command)) {
      // This should already be in `items`
      return
    }
    const name = command.getChild('SectioningArgument')?.getChild('LongArg')

    if (!name) {
      return
    }

    // Filter out descendants of newcommand/renewcommand
    for (
      let ancestor: SyntaxNode | null = parent;
      ancestor;
      ancestor = ancestor.parent
    ) {
      if (ancestor.type.is('NewCommand') || ancestor.type.is('RenewCommand')) {
        return false
      }
    }

    const getCommandName = () => {
      const ctrlSeq = command.firstChild
      if (!ctrlSeq) return ''
      // Ignore the \
      return state.doc.sliceString(ctrlSeq.from + 1, ctrlSeq.to)
    }

    const nestingLevel = parent?.type.is('$Section')
      ? getNestingLevel(parent.type.id)
      : getNestingLevel(getCommandName())

    const thisNode = {
      line: state.doc.lineAt(command.from).number,
      title: getEntryText(state, name),
      from: command.from,
      to: command.to,
      level: nestingLevel,
    }

    items.push(thisNode)
  }
  if (node.type.is('$Environment')) {
    const environmentNode = node.node
    if (getEnvironmentName(environmentNode, state) === 'frame') {
      const beginEnv = environmentNode.getChild('BeginEnv')!
      if (!nodeIntersectsChange(beginEnv)) {
        // This should already be in `items`
        return
      }
      const args = getEnvironmentArguments(environmentNode)?.map(textArg =>
        textArg.getChild('LongArg')
      )
      if (args?.length) {
        const titleNode = args[0]
        const title = titleNode
          ? state.sliceDoc(titleNode.from, titleNode.to)
          : ''
        const thisNode = {
          line: state.doc.lineAt(beginEnv.from).number,
          title,
          from: beginEnv.from,
          to: beginEnv.to,
          level: NestingLevel.Frame,
        }
        items.push(thisNode)
      }
    }
  }
}

const flatItemToOutline = (item: {
  title: string
  line: number
  level: number
}): Outline => ({
  title: item.title,
  line: item.line,
  level: item.level,
})

export const nestOutline = (flatOutline: PartialFlatOutline): Outline[] => {
  const parentStack: Outline[] = []
  const outline = []

  for (const item of flatOutline) {
    const outlineItem = flatItemToOutline(item)

    // Pop all higher-leveled potential parents from the parent stack
    while (
      parentStack.length &&
      parentStack[parentStack.length - 1].level >= outlineItem.level
    ) {
      parentStack.pop()
    }

    // Append to parent if any, and otherwise add root element
    if (!parentStack.length) {
      parentStack.push(outlineItem)
      outline.push(outlineItem)
    } else {
      const parent = parentStack[parentStack.length - 1]
      if (!parent.children) {
        parent.children = [outlineItem]
      } else {
        parent.children.push(outlineItem)
      }
      parentStack.push(outlineItem)
    }
  }
  return outline
}
