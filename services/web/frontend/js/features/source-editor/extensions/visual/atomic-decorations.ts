import { EditorState, Range, StateField } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { SyntaxNode, Tree } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'
import {
  hasMouseDownEffect,
  mouseDownEffect,
  selectionIntersects,
  extendBackwardsOverEmptyLines,
  extendForwardsOverEmptyLines,
} from './selection'
import { ItemWidget } from './visual-widgets/item'
import { LaTeXWidget } from './visual-widgets/latex'
import { BraceWidget } from './visual-widgets/brace'
import { ancestorNodeOfType } from '../../utils/tree-query'
import { MakeTitleWidget } from './visual-widgets/maketitle'
import { BeginWidget } from './visual-widgets/begin'
import { EndWidget } from './visual-widgets/end'
import {
  getEnvironmentArguments,
  getEnvironmentName,
  getUnstarredEnvironmentName,
  parseFigureData,
} from '../../utils/tree-operations/environments'
import { MathWidget } from './visual-widgets/math'
import { IconBraceWidget } from './visual-widgets/icon-brace'
import { TeXWidget } from './visual-widgets/tex'
import {
  createCharacterCommand,
  hasCharacterSubstitution,
} from './visual-widgets/character'
import { centeringNodeForEnvironment } from '../../utils/tree-operations/figure'
import { Frame, FrameWidget } from './visual-widgets/frame'
import { DividerWidget } from './visual-widgets/divider'
import { Preamble, PreambleWidget } from './visual-widgets/preamble'
import { EndDocumentWidget } from './visual-widgets/end-document'
import { EnvironmentLineWidget } from './visual-widgets/environment-line'
import {
  ListEnvironmentName,
  ancestorOfNodeWithType,
  isDirectChildOfEnvironment,
} from '../../utils/tree-operations/ancestors'
import { EditableGraphicsWidget } from './visual-widgets/editable-graphics'
import { EditableInlineGraphicsWidget } from './visual-widgets/editable-inline-graphics'
import {
  CloseBrace,
  OpenBrace,
  CloseBracket,
  OpenBracket,
  OptionalArgument,
  ShortTextArgument,
  TextArgument,
} from '../../lezer-latex/latex.terms.mjs'
import { FootnoteWidget } from './visual-widgets/footnote'
import { getListItems } from '../toolbar/lists'
import { TildeWidget } from './visual-widgets/tilde'
import { BeginTheoremWidget } from './visual-widgets/begin-theorem'
import { parseTheoremArguments } from '../../utils/tree-operations/theorems'
import { IndicatorWidget } from './visual-widgets/indicator'
import { TabularWidget } from './visual-widgets/tabular'
import { nextSnippetField, pickedCompletion } from '@codemirror/autocomplete'
import { skipPreambleWithCursor } from './skip-preamble-cursor'
import { TableRenderingErrorWidget } from './visual-widgets/table-rendering-error'
import { GraphicsWidget } from './visual-widgets/graphics'
import { InlineGraphicsWidget } from './visual-widgets/inline-graphics'
import { PreviewPath } from '../../../../../../types/preview-path'
import { selectDecoratedArgument } from './select-decorated-argument'
import {
  generateTable,
  ParsedTableData,
  validateParsedTable,
} from '../../components/table-generator/utils'
import { debugConsole } from '@/utils/debugging'
import { DescriptionItemWidget } from './visual-widgets/description-item'
import {
  createSpaceCommand,
  hasSpaceSubstitution,
} from '@/features/source-editor/extensions/visual/visual-widgets/space'
import {
  mathAncestorNode,
  parseMathContainer,
} from '../../utils/tree-operations/math'

type Options = {
  previewByPath: (path: string) => PreviewPath | null
}

function shouldDecorate(
  state: EditorState,
  extents: { from: number; to: number }
) {
  return state.readOnly || !selectionIntersects(state.selection, extents)
}

function shouldDecorateFromLineEdges(
  state: EditorState,
  extents: { from: number; to: number }
) {
  return shouldDecorate(state, {
    from: state.doc.lineAt(extents.from).from,
    to: state.doc.lineAt(extents.to).to,
  })
}

function decorateArgumentBraces(
  startWidget: WidgetType,
  argumentNode: SyntaxNode | null | undefined,
  start: number,
  decorateEmptyArguments = false,
  endWidget?: WidgetType,
  braceTypes = {
    open: OpenBrace,
    close: CloseBrace,
  }
): Range<Decoration>[] {
  if (!argumentNode) {
    return []
  }
  const openBrace = argumentNode.getChild(braceTypes.open)
  const closeBrace = argumentNode.getChild(braceTypes.close)

  if (openBrace && closeBrace) {
    if (
      // Make sure that decoration ranges are non-empty
      openBrace.to > start &&
      (decorateEmptyArguments || argumentNode.to - argumentNode.from > 2)
    ) {
      return [
        Decoration.replace({
          widget: startWidget,
        }).range(start, openBrace.to),

        Decoration.replace({
          widget: endWidget,
        }).range(closeBrace.from, closeBrace.to),
      ]
    }
  }
  return []
}

const hasClosingBrace = (node: SyntaxNode) =>
  node.getChild('EnvNameGroup')?.getChild('CloseBrace')

/**
 * A state field that decorates ranges of text (including multiple lines) with Widget or Line decorations.
 * Atomic decorations replace a range of content with an uneditable widget.
 * Decorations that span multiple lines must be contained in a StateField, not a ViewPlugin.
 */
export const atomicDecorations = (options: Options) => {
  const { previewByPath } = options
  const createDecorations = (
    state: EditorState,
    tree: Tree
  ): { decorations: DecorationSet; preamble: Preamble } => {
    const decorations: Range<Decoration>[] = []

    const listEnvironmentStack: ListEnvironmentName[] = []
    let currentListEnvironment: ListEnvironmentName | undefined

    const ordinalStack: number[] = []
    let currentOrdinal = 0

    let listDepth = 0

    const theoremEnvironments = new Map<string, string>([
      ['theorem', 'Theorem'],
      ['corollary', 'Corollary'],
      ['lemma', 'lemma'],
      ['proof', 'Proof'],
    ])

    let commandDefinitions = ''

    const preamble: Preamble = { from: 0, to: 0, authors: [] }

    const startListEnvironment = (envName: ListEnvironmentName) => {
      if (currentListEnvironment) {
        listEnvironmentStack.push(currentListEnvironment)
        ordinalStack.push(currentOrdinal)
      }
      currentListEnvironment = envName
      currentOrdinal = 0
    }

    const endListEnvironment = () => {
      currentListEnvironment = listEnvironmentStack.pop()
      currentOrdinal = ordinalStack.pop() ?? 0
    }

    let seenDocumentEnvironment = false

    tree.iterate({
      enter(nodeRef) {
        if (nodeRef.node.type.is('Maketitle')) {
          // end the preamble at \maketitle, if it's directly inside the document environment
          const parentEnvironment = ancestorOfNodeWithType(
            nodeRef.node,
            '$Environment'
          )
          if (parentEnvironment?.type.is('DocumentEnvironment')) {
            preamble.to = nodeRef.node.from
          }
        } else if (nodeRef.node.type.is('DocumentEnvironment')) {
          // only count the first instance of DocumentEnvironment
          if (!seenDocumentEnvironment) {
            preamble.to =
              nodeRef.node.getChild('Content')?.from ?? nodeRef.node.from
            seenDocumentEnvironment = true
          }
        } else if (nodeRef.node.type.is('Title')) {
          const node = nodeRef.node.getChild('TextArgument')
          if (node) {
            const content = state.sliceDoc(node.from, node.to)
            preamble.title = { node, content }
            preamble.to = nodeRef.node.to
          }
        } else if (nodeRef.node.type.is('Author')) {
          const node = nodeRef.node.getChild('TextArgument')
          if (node) {
            const content = state.sliceDoc(node.from, node.to)
            preamble.authors.push({ node, content })
            preamble.to = nodeRef.node.to
          }
        } else if (
          nodeRef.node.type.is('Affil') ||
          nodeRef.node.type.is('Affiliation')
        ) {
          const node = nodeRef.node.getChild('TextArgument')
          if (node) {
            preamble.to = nodeRef.node.to
          }
        }

        if (nodeRef.type.is('$Environment')) {
          const envName = getUnstarredEnvironmentName(nodeRef.node, state)
          const hideInEnvironmentTypes = [
            'figure',
            'table',
            'verbatim',
            'lstlisting',
            'quote',
            'quotation',
            'quoting',
            'displayquote',
          ]
          if (envName && hideInEnvironmentTypes.includes(envName)) {
            const beginNode = nodeRef.node.getChild('BeginEnv')
            const endNode = nodeRef.node.getChild('EndEnv')
            if (
              beginNode &&
              endNode &&
              hasClosingBrace(beginNode) &&
              hasClosingBrace(endNode)
            ) {
              const beginLine = state.doc.lineAt(beginNode.from)
              const endLine = state.doc.lineAt(endNode.from)

              const begin = {
                from: beginLine.from,
                to: extendForwardsOverEmptyLines(state.doc, beginLine),
              }
              const end = {
                from: extendBackwardsOverEmptyLines(state.doc, endLine),
                to: endLine.to,
              }

              if (shouldDecorate(state, { from: begin.from, to: end.to })) {
                decorations.push(
                  Decoration.replace({
                    widget: new EnvironmentLineWidget(envName, 'begin'),
                    block: true,
                  }).range(begin.from, begin.to),
                  Decoration.replace({
                    widget: new EnvironmentLineWidget(envName, 'end'),
                    block: true,
                  }).range(end.from, end.to)
                )

                const centeringNode = centeringNodeForEnvironment(nodeRef)

                if (centeringNode) {
                  const line = state.doc.lineAt(centeringNode.from)
                  const from = extendBackwardsOverEmptyLines(state.doc, line)
                  const to = extendForwardsOverEmptyLines(state.doc, line)

                  decorations.push(
                    Decoration.replace({
                      block: true,
                    }).range(from, to)
                  )
                }
              }
            }
          } else if (nodeRef.type.is('ListEnvironment')) {
            const beginNode = nodeRef.node.getChild('BeginEnv')
            const endNode = nodeRef.node.getChild('EndEnv')

            if (
              beginNode &&
              endNode &&
              hasClosingBrace(beginNode) &&
              hasClosingBrace(endNode)
            ) {
              const beginLine = state.doc.lineAt(beginNode.from)
              const endLine = state.doc.lineAt(endNode.from)

              const begin = {
                from: beginLine.from,
                to: extendForwardsOverEmptyLines(state.doc, beginLine),
              }
              const end = {
                from: extendBackwardsOverEmptyLines(state.doc, endLine),
                to: endLine.to,
              }

              if (
                !selectionIntersects(state.selection, begin) &&
                !selectionIntersects(state.selection, end) &&
                getListItems(nodeRef.node).length > 0 // not empty
              ) {
                decorations.push(
                  Decoration.replace({
                    block: true,
                  }).range(begin.from, begin.to),
                  Decoration.replace({
                    block: true,
                  }).range(end.from, end.to)
                )
              }
            }
          } else if (nodeRef.type.is('TabularEnvironment')) {
            if (shouldDecorate(state, nodeRef)) {
              const tabularNode = nodeRef.node
              const tableNode = ancestorOfNodeWithType(
                tabularNode,
                'TableEnvironment'
              )
              const directChild = isDirectChildOfEnvironment(
                tabularNode.parent,
                tableNode
              )

              let parsedTableData: ParsedTableData | null = null
              let validTable = false
              try {
                parsedTableData = generateTable(tabularNode, state)
                validTable = validateParsedTable(parsedTableData)
              } catch (e) {
                debugConsole.error(e)
              }

              if (parsedTableData && validTable) {
                decorations.push(
                  Decoration.replace({
                    widget: new TabularWidget(
                      parsedTableData,
                      tabularNode,
                      state.doc.sliceString(
                        (tableNode ?? tabularNode).from,
                        (tableNode ?? tabularNode).to
                      ),
                      tableNode,
                      directChild
                    ),
                    block: true,
                  }).range(nodeRef.from, nodeRef.to)
                )
                return false
              } else {
                // Show error message
                decorations.push(
                  Decoration.widget({
                    widget: new TableRenderingErrorWidget(tableNode),
                    block: true,
                  }).range(nodeRef.from, nodeRef.from)
                )
              }
            }
          }
        } else if (nodeRef.type.is('BeginEnv')) {
          // the beginning of an environment, with an environment name argument
          const envName = getUnstarredEnvironmentName(nodeRef.node, state)

          if (envName) {
            switch (envName) {
              case 'itemize':
              case 'enumerate':
              case 'description':
                startListEnvironment(envName)
                listDepth++
                break

              case 'abstract':
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    Decoration.replace({
                      widget: new BeginWidget(envName),
                      block: true,
                    }).range(nodeRef.from, nodeRef.to)
                  )
                }
                break
              case 'frame':
                if (shouldDecorate(state, nodeRef)) {
                  const parent = nodeRef.node.parent
                  if (parent?.type.is('Environment')) {
                    const args = getEnvironmentArguments(parent)
                    if (!args) {
                      break
                    }

                    if (args.length > 0) {
                      const title = args[0]
                      if (!title) {
                        break
                      }
                      let to = title.to
                      const titleTextNode = title.getChild('LongArg')
                      if (!titleTextNode) {
                        break
                      }
                      const frame: Frame = {
                        title: {
                          node: title,
                          content: state.sliceDoc(
                            titleTextNode.from,
                            titleTextNode.to
                          ),
                        },
                      }
                      if (args.length > 1) {
                        // We have a subtitle too
                        const subtitle = args[1]
                        if (subtitle) {
                          const subtitleTextNode = subtitle.getChild('LongArg')
                          if (subtitleTextNode) {
                            to = subtitle.to
                            frame.subtitle = {
                              node: subtitle,
                              content: state.sliceDoc(
                                subtitleTextNode.from,
                                subtitleTextNode.to
                              ),
                            }
                          }
                        }
                      }
                      decorations.push(
                        Decoration.replace({
                          widget: new FrameWidget(frame),
                          block: true,
                        }).range(nodeRef.from, to)
                      )
                    }
                  }
                }
                break
              default:
                {
                  const theoremName = theoremEnvironments.get(envName)

                  if (theoremName && shouldDecorate(state, nodeRef)) {
                    const argumentNode = nodeRef.node
                      .getChild('OptionalArgument')
                      ?.getChild('ShortOptionalArg')

                    decorations.push(
                      Decoration.replace({
                        widget: new BeginTheoremWidget(
                          envName,
                          theoremName,
                          argumentNode
                        ),
                        block: true,
                      }).range(nodeRef.from, nodeRef.to)
                    )
                  }

                  // do nothing
                }
                break
            }
          }
        } else if (nodeRef.type.is('EndEnv')) {
          // the end of an environment, with an environment name argument
          const envName = getEnvironmentName(nodeRef.node, state)

          if (envName) {
            switch (envName) {
              case 'itemize':
              case 'enumerate':
              case 'description':
                if (currentListEnvironment === envName) {
                  endListEnvironment()
                }
                listDepth--
                break

              case 'abstract':
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    Decoration.replace({
                      widget: new EndWidget(),
                      block: true,
                    }).range(nodeRef.from, nodeRef.to)
                  )
                }
                break
              case 'document':
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    Decoration.replace({
                      widget: new EndDocumentWidget(),
                      block: true,
                    }).range(nodeRef.from, nodeRef.to)
                  )
                }
                break
              case 'frame':
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    Decoration.replace({
                      widget: new DividerWidget(),
                      block: true,
                    }).range(nodeRef.from, nodeRef.to)
                  )
                }
                break
              default:
                if (theoremEnvironments.has(envName)) {
                  if (shouldDecorate(state, nodeRef)) {
                    decorations.push(
                      Decoration.replace({
                        widget: new EndWidget(),
                        block: true,
                      }).range(nodeRef.from, nodeRef.to)
                    )
                  }
                }
                // do nothing
                break
            }
          }
        } else if (nodeRef.type.is('$SectioningCtrlSeq')) {
          const ancestorNode = ancestorNodeOfType(
            state,
            nodeRef.to,
            'SectioningCommand'
          )
          if (ancestorNode) {
            // a section (or subsection, etc) command
            const argumentNode = ancestorNode.getChild('SectioningArgument')
            if (argumentNode) {
              const openBrace = argumentNode.getChild(OpenBrace)
              const closeBrace = argumentNode.getChild(CloseBrace)
              if (!openBrace || !closeBrace) {
                return false
              }
              const sectionCtrlSeqNode = ancestorNode.getChild('$CtrlSeq')
              if (!sectionCtrlSeqNode) {
                return false
              }
              const titleNode = argumentNode.getChild('LongArg')
              if (!titleNode) {
                return false
              }
              const title = state.sliceDoc(titleNode.from, titleNode.to)
              if (!title.trim()) {
                return false
              }

              const showBraces =
                selectionIntersects(state.selection, sectionCtrlSeqNode) ||
                selectionIntersects(state.selection, openBrace) ||
                selectionIntersects(state.selection, closeBrace)

              decorations.push(
                Decoration.replace({
                  widget: new BraceWidget(showBraces ? '{' : ''),
                }).range(nodeRef.from, titleNode.from)
              )

              decorations.push(
                Decoration.replace({
                  widget: new BraceWidget(showBraces ? '}' : ''),
                }).range(closeBrace.from, closeBrace.to)
              )

              return false
            }
          }
        } else if (nodeRef.type.is('VerbCommand')) {
          if (shouldDecorate(state, nodeRef)) {
            // \verb content (text only)
            const contentNode = nodeRef.node.getChild('VerbContent')

            if (contentNode) {
              if (contentNode.to - contentNode.from > 2) {
                decorations.push(
                  Decoration.replace({}).range(
                    nodeRef.from,
                    contentNode.from + 1
                  )
                )

                decorations.push(
                  Decoration.replace({}).range(nodeRef.to - 1, nodeRef.to)
                )
              }
            }
          }

          return false // no markup in verbatim content
        } else if (
          nodeRef.type.is('NewCommand') ||
          nodeRef.type.is('RenewCommand') ||
          nodeRef.type.is('Def')
        ) {
          const nameNode =
            nodeRef.node.getChild('LiteralArgContent') ??
            nodeRef.node.getChild('Csname') ??
            nodeRef.node.getChild('CtrlSym')
          if (nameNode) {
            const name = state.sliceDoc(nameNode.from, nameNode.to).trim()
            if (/^\\\w+/.test(name)) {
              const content = state.sliceDoc(nodeRef.from, nodeRef.to)
              if (content) {
                commandDefinitions += `${content}\n`
              }
            }
          }
        } else if (
          nodeRef.type.is('RenewEnvironment') ||
          nodeRef.type.is('NewEnvironment')
        ) {
          const nameNode = nodeRef.node.getChild('LiteralArgContent')
          if (nameNode) {
            const name = state.sliceDoc(nameNode.from, nameNode.to).trim()
            if (/^\w+/.test(name)) {
              const content = state.sliceDoc(nodeRef.from, nodeRef.to)
              if (content) {
                commandDefinitions += `${content}\n`
              }
            }
          }
        } else if (nodeRef.type.is('Let')) {
          const commandNodes = nodeRef.node.getChildren('Csname')
          if (commandNodes.length !== 2) {
            return
          }
          const nameNode = commandNodes[0]
          if (nameNode) {
            // We support more flexible names in let (Csname) than in newcommand
            const name = state.sliceDoc(nameNode.from, nameNode.to).trim()
            if (name.length > 1 && name.startsWith('\\')) {
              const content = state.sliceDoc(nodeRef.from, nodeRef.to)
              if (content) {
                commandDefinitions += `${content}\n`
              }
            }
          }
        } else if (nodeRef.type.is('Cite')) {
          // \cite command with a bibkey argument
          if (shouldDecorate(state, nodeRef)) {
            const argumentNode = nodeRef.node
              .getChild('BibKeyArgument')
              ?.getChild('ShortTextArgument')

            decorations.push(
              ...decorateArgumentBraces(
                new IconBraceWidget('📚'),
                argumentNode,
                nodeRef.from
              )
            )
          }

          return false // no markup in cite content
        } else if (nodeRef.type.is('Ref')) {
          // \ref command with a ref label argument

          const argumentNode = nodeRef.node
            .getChild('RefArgument')
            ?.getChild('ShortTextArgument')

          const shouldShowBraces =
            !shouldDecorate(state, nodeRef) ||
            argumentNode?.from === argumentNode?.to

          decorations.push(
            ...decorateArgumentBraces(
              new IconBraceWidget(shouldShowBraces ? '🏷{' : '🏷'),
              argumentNode,
              nodeRef.from,
              true,
              new BraceWidget(shouldShowBraces ? '}' : '')
            )
          )

          return false // no markup in ref content
        } else if (nodeRef.type.is('Label')) {
          // \label definition
          if (shouldDecorate(state, nodeRef)) {
            const argumentNode = nodeRef.node
              .getChild('LabelArgument')
              ?.getChild('ShortTextArgument')

            decorations.push(
              ...decorateArgumentBraces(
                new IconBraceWidget('🏷'),
                argumentNode,
                nodeRef.from
              )
            )
          }

          return false // no markup in label content
        } else if (nodeRef.type.is('Include')) {
          // \include (a file path)
          if (shouldDecorate(state, nodeRef)) {
            const argumentNode = nodeRef.node
              .getChild('IncludeArgument')
              ?.getChild('FilePathArgument')
            decorations.push(
              ...decorateArgumentBraces(
                new IconBraceWidget('🔗'),
                argumentNode,
                nodeRef.from
              )
            )
          }

          return false // no markup in include content
        } else if (nodeRef.type.is('Input')) {
          // \input (a file path)
          // TODO: Ensure this works with BareFilePathArgument
          if (shouldDecorate(state, nodeRef)) {
            const contentNode = nodeRef.node.getChild('InputArgument')

            if (contentNode) {
              if (contentNode.to - contentNode.from > 2) {
                decorations.push(
                  Decoration.replace({
                    widget: new IconBraceWidget('🔗'),
                  }).range(nodeRef.from, contentNode.from + 1)
                )

                decorations.push(
                  Decoration.replace({
                    widget: new BraceWidget(),
                  }).range(nodeRef.to - 1, nodeRef.to)
                )
              }
            }
          }

          return false // no markup in input content
        } else if (nodeRef.type.is('Math')) {
          // math equations
          const ancestorNode = mathAncestorNode(state, nodeRef.from)

          if (
            ancestorNode &&
            (ancestorNode.type.is('$Environment')
              ? shouldDecorateFromLineEdges(state, ancestorNode)
              : shouldDecorate(state, ancestorNode))
          ) {
            const math = parseMathContainer(state, nodeRef, ancestorNode)

            if (math && math.passToMathJax) {
              decorations.push(
                Decoration.replace({
                  widget: new MathWidget(
                    math.content,
                    math.displayMode,
                    commandDefinitions
                  ),
                  block: math.displayMode,
                }).range(ancestorNode.from, ancestorNode.to)
              )
            }
          }

          return false // never decorate inside math
        } else if (nodeRef.type.is('HrefCommand')) {
          // a hyperlink with URL and content arguments
          const urlArgumentNode = nodeRef.node.getChild('UrlArgument')
          const urlNode = urlArgumentNode?.getChild('LiteralArgContent')
          const contentArgumentNode = nodeRef.node.getChild('ShortTextArgument')
          const contentNode = contentArgumentNode?.getChild('ShortArg')

          if (
            urlArgumentNode &&
            urlNode &&
            contentArgumentNode &&
            contentNode
          ) {
            const shouldShowBraces =
              !shouldDecorate(state, nodeRef) ||
              contentNode.from === contentNode.to

            const url = state.sliceDoc(urlNode.from, urlNode.to)

            // avoid decorating when the URL spans multiple lines, as the argument node is probably unclosed
            if (!url.includes('\n')) {
              decorations.push(
                ...decorateArgumentBraces(
                  new BraceWidget(shouldShowBraces ? '{' : ''),
                  contentArgumentNode,
                  nodeRef.from,
                  true,
                  new BraceWidget(shouldShowBraces ? '}' : '')
                )
              )
            }
          }
        } else if (nodeRef.type.is('UrlCommand')) {
          // a hyperlink with URL and content arguments
          const argumentNode = nodeRef.node.getChild('UrlArgument')

          if (argumentNode) {
            const contentNode = argumentNode.getChild('LiteralArgContent')

            const shouldShowBraces =
              !shouldDecorate(state, nodeRef) ||
              contentNode?.from === contentNode?.to

            decorations.push(
              ...decorateArgumentBraces(
                new BraceWidget(shouldShowBraces ? '{' : ''),
                argumentNode,
                nodeRef.from,
                false,
                new BraceWidget(shouldShowBraces ? '}' : '')
              )
            )
          }
        } else if (nodeRef.type.is('Tilde')) {
          // a tilde (non-breaking space)
          if (shouldDecorate(state, nodeRef)) {
            decorations.push(
              Decoration.replace({
                widget: new TildeWidget(),
              }).range(nodeRef.from, nodeRef.to)
            )
          }
        } else if (nodeRef.type.is('LineBreak')) {
          // line break
          const optionalArgument = nodeRef.node.getChild('OptionalArgument')
          if (!optionalArgument || shouldDecorate(state, optionalArgument)) {
            decorations.push(
              Decoration.replace({
                widget: new IndicatorWidget('\u21A9'),
              }).range(nodeRef.from, nodeRef.to)
            )
          }
          return false
        } else if (nodeRef.type.is('Caption')) {
          if (shouldDecorate(state, nodeRef)) {
            // a caption
            const argumentNode = nodeRef.node.getChild('TextArgument')
            decorations.push(
              ...decorateArgumentBraces(
                new BraceWidget(),
                argumentNode,
                nodeRef.from
              )
            )
          }
        } else if (nodeRef.type.is('IncludeGraphics')) {
          // \includegraphics with a file path argument
          if (shouldDecorate(state, nodeRef)) {
            const filePathArgument = nodeRef.node
              .getChild('IncludeGraphicsArgument')
              ?.getChild('FilePathArgument')
              ?.getChild('LiteralArgContent')

            if (filePathArgument) {
              const filePath = state.doc.sliceString(
                filePathArgument.from,
                filePathArgument.to
              )

              if (filePath) {
                const environmentNode = ancestorNodeOfType(
                  state,
                  nodeRef.from,
                  'FigureEnvironment'
                )
                const centered = Boolean(
                  environmentNode &&
                    centeringNodeForEnvironment(environmentNode)
                )
                const figureData = environmentNode
                  ? parseFigureData(environmentNode, state)
                  : null

                const line = state.doc.lineAt(nodeRef.from)

                const lineContainsOnlyNode =
                  line.text.trim().length === nodeRef.to - nodeRef.from

                if (lineContainsOnlyNode) {
                  const Widget = state.readOnly
                    ? GraphicsWidget
                    : EditableGraphicsWidget
                  decorations.push(
                    Decoration.replace({
                      widget: new Widget(
                        filePath,
                        previewByPath,
                        centered,
                        figureData
                      ),
                      block: true,
                    }).range(line.from, line.to)
                  )
                } else {
                  const Widget = state.readOnly
                    ? InlineGraphicsWidget
                    : EditableInlineGraphicsWidget
                  decorations.push(
                    Decoration.replace({
                      widget: new Widget(
                        filePath,
                        previewByPath,
                        centered,
                        figureData
                      ),
                    }).range(nodeRef.from, nodeRef.to)
                  )
                }
              }

              return false
            }
          }
        } else if (nodeRef.type.is('Maketitle')) {
          if (shouldDecorate(state, nodeRef)) {
            const line = state.doc.lineAt(nodeRef.from)
            const from = extendBackwardsOverEmptyLines(state.doc, line)
            const { to } = state.doc.lineAt(nodeRef.to)

            if (shouldDecorate(state, { from, to })) {
              decorations.push(
                Decoration.replace({
                  widget: new MakeTitleWidget(preamble),
                  block: true,
                }).range(from, to)
              )
            }

            return false
          }
        } else if (nodeRef.type.is('Item')) {
          // only decorate \item inside a list
          if (currentListEnvironment) {
            currentOrdinal++
            const line = state.doc.lineAt(nodeRef.from)
            const onlySpaceBeforeNode = /^\s*$/.test(
              state.sliceDoc(line.from, nodeRef.from)
            )
            const from = onlySpaceBeforeNode ? line.from : nodeRef.from

            if (currentListEnvironment === 'description') {
              const argumentNode = nodeRef.node.getChild(OptionalArgument)
              const to = argumentNode ? argumentNode.from : nodeRef.to

              const onlySpaceAfterNode =
                !argumentNode &&
                /^\s*$/.test(state.sliceDoc(nodeRef.to, line.to))

              if (!onlySpaceAfterNode) {
                // decorate the \item command and subsequent whitespace, if there is other content on the line
                decorations.push(
                  Decoration.replace({
                    widget: new DescriptionItemWidget(listDepth),
                  }).range(from, to)
                )
              }

              if (argumentNode) {
                // decorate the optional argument
                const decorateBrackets = shouldDecorate(state, argumentNode)

                decorations.push(
                  ...decorateArgumentBraces(
                    new BraceWidget(decorateBrackets ? '' : '['),
                    argumentNode,
                    from,
                    false,
                    new BraceWidget(decorateBrackets ? '' : ']'),
                    { open: OpenBracket, close: CloseBracket }
                  )
                )
              }
            } else {
              decorations.push(
                Decoration.replace({
                  widget: new ItemWidget(
                    currentListEnvironment || 'document',
                    currentOrdinal,
                    listDepth
                  ),
                }).range(from, nodeRef.to)
              )
              return false
            }
          }
        } else if (nodeRef.type.is('NewTheoremCommand')) {
          const result = parseTheoremArguments(state, nodeRef.node)
          if (result) {
            const { name, label } = result
            theoremEnvironments.set(name, label)
          }
        } else if (
          nodeRef.type.is('TextColorCommand') ||
          nodeRef.type.is('ColorBoxCommand')
        ) {
          if (shouldDecorate(state, nodeRef)) {
            const colorArgumentNode = nodeRef.node.getChild(ShortTextArgument)
            const contentArgumentNode = nodeRef.node.getChild(TextArgument)
            if (colorArgumentNode && contentArgumentNode) {
              // command name and opening brace
              decorations.push(
                ...decorateArgumentBraces(
                  new BraceWidget(),
                  contentArgumentNode,
                  nodeRef.from
                )
              )
            }
          }
        } else if (nodeRef.type.is('$ToggleTextFormattingCommand')) {
          // markup that can be toggled using toolbar buttons/keyboard shortcuts
          const textArgumentNode = nodeRef.node.getChild('TextArgument')
          const argumentText = textArgumentNode?.getChild('LongArg')
          const shouldShowBraces =
            !shouldDecorate(state, nodeRef) ||
            argumentText?.from === argumentText?.to
          decorations.push(
            ...decorateArgumentBraces(
              new BraceWidget(shouldShowBraces ? '{' : ''),
              textArgumentNode,
              nodeRef.from,
              true,
              new BraceWidget(shouldShowBraces ? '}' : '')
            )
          )
        } else if (nodeRef.type.is('$OtherTextFormattingCommand')) {
          // markup that can't be toggled using toolbar buttons/keyboard shortcuts
          const textArgumentNode = nodeRef.node.getChild('TextArgument')
          if (shouldDecorate(state, nodeRef)) {
            decorations.push(
              ...decorateArgumentBraces(
                new BraceWidget(),
                textArgumentNode,
                nodeRef.from
              )
            )
          }
        } else if (nodeRef.type.is('UnknownCommand')) {
          // a command that's not defined separately by the grammar
          const commandNode = nodeRef.node
          const commandNameNode = commandNode.getChild('$CtrlSeq')

          if (commandNameNode) {
            const commandName = state.doc
              .sliceString(commandNameNode.from, commandNameNode.to)
              .trim()

            if (commandName.length > 0) {
              const textArgumentNode = commandNode.getChild('TextArgument')

              if (commandName === '\\keywords') {
                if (shouldDecorate(state, nodeRef)) {
                  // command name and opening brace
                  decorations.push(
                    ...decorateArgumentBraces(
                      new BraceWidget('keywords: '),
                      textArgumentNode,
                      nodeRef.from
                    )
                  )
                  return false
                }
              } else if (
                commandName === '\\footnote' ||
                commandName === '\\endnote'
              ) {
                if (textArgumentNode) {
                  if (
                    state.readOnly &&
                    selectionIntersects(state.selection, nodeRef)
                  ) {
                    // a special case for a read-only document:
                    // always display the content, styled differently from the main content.
                    decorations.push(
                      ...decorateArgumentBraces(
                        new BraceWidget(),
                        textArgumentNode,
                        nodeRef.from
                      ),
                      Decoration.mark({
                        class: 'ol-cm-footnote ol-cm-footnote-view',
                      }).range(textArgumentNode.from, textArgumentNode.to)
                    )
                  } else {
                    if (shouldDecorate(state, nodeRef)) {
                      // collapse the footnote when the selection is outside it
                      decorations.push(
                        Decoration.replace({
                          widget: new FootnoteWidget(
                            commandName === '\\footnote'
                              ? 'footnote'
                              : 'endnote'
                          ),
                        }).range(nodeRef.from, nodeRef.to)
                      )
                      return false
                    }
                  }
                }
              } else if (commandName === '\\LaTeX') {
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    Decoration.replace({
                      widget: new LaTeXWidget(),
                    }).range(nodeRef.from, nodeRef.to)
                  )
                  return false
                }
              } else if (commandName === '\\TeX') {
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    Decoration.replace({
                      widget: new TeXWidget(),
                    }).range(nodeRef.from, nodeRef.to)
                  )
                  return false
                }
              } else if (commandName === '\\ce') {
                // Chemical equation/formula, from the `mhchem` CTAN package.
                // Handled by the MathJaX mhchem extension:
                // https://docs.mathjax.org/en/latest/input/tex/extensions/mhchem.html
                if (textArgumentNode && shouldDecorate(state, nodeRef)) {
                  const innerContent = state.doc
                    .sliceString(
                      textArgumentNode.from + 1,
                      textArgumentNode.to - 1
                    )
                    .trim()

                  if (innerContent.length) {
                    const outerContent = state.doc.sliceString(
                      nodeRef.from,
                      nodeRef.to
                    )

                    decorations.push(
                      Decoration.replace({
                        widget: new MathWidget(outerContent, false),
                      }).range(nodeRef.from, nodeRef.to)
                    )
                  }

                  return false
                }
              } else if (hasCharacterSubstitution(commandName)) {
                if (shouldDecorate(state, nodeRef)) {
                  const replacement = createCharacterCommand(commandName)
                  if (replacement) {
                    decorations.push(
                      Decoration.replace({
                        widget: replacement,
                      }).range(nodeRef.from, nodeRef.to)
                    )
                    return false
                  }
                }
              } else if (hasSpaceSubstitution(commandName)) {
                if (shouldDecorate(state, nodeRef)) {
                  const replacement = createSpaceCommand(commandName)
                  if (replacement) {
                    decorations.push(
                      Decoration.replace({
                        widget: replacement,
                      }).range(nodeRef.from, nodeRef.to)
                    )
                    return false
                  }
                }
              }
            }
          }
        }
      },
    })

    if (preamble.to > 0) {
      // add environmentclass names to each line of the preamble
      // note: this should be in markDecorations,
      // but the preamble extents are calculated in this extension.
      const endLine = state.doc.lineAt(preamble.to).number
      for (let lineNumber = 1; lineNumber <= endLine; ++lineNumber) {
        const line = state.doc.line(lineNumber)
        const classes = ['ol-cm-preamble-line']
        if (lineNumber === 1) {
          classes.push('ol-cm-environment-first-line')
        }
        if (lineNumber === endLine) {
          classes.push('ol-cm-environment-last-line')
        }
        decorations.push(
          Decoration.line({
            class: classes.join(' '),
          }).range(line.from)
        )
      }

      // hide the preamble. We use selectionIntersects directly, so that it also
      // expands in readOnly mode.
      const isExpanded = selectionIntersects(state.selection, preamble)
      if (!isExpanded) {
        decorations.push(
          Decoration.replace({
            widget: new PreambleWidget(isExpanded),
            block: true,
          }).range(0, preamble.to)
        )
      } else {
        decorations.push(
          Decoration.widget({
            widget: new PreambleWidget(isExpanded),
            block: true,
            side: -1,
          }).range(0)
        )
      }
    }
    return {
      decorations: Decoration.set(decorations, true),
      preamble,
    }
  }

  return [
    StateField.define<{
      mousedown: boolean
      decorations: DecorationSet
      preamble: Preamble
      previousTree: Tree
    }>({
      create(state) {
        const previousTree = syntaxTree(state)
        const { decorations, preamble } = createDecorations(state, previousTree)

        return {
          mousedown: false,
          decorations,
          preamble,
          previousTree,
        }
      },
      update(value, tr) {
        for (const effect of tr.effects) {
          // store the "mousedown" value when it changes
          if (effect.is(mouseDownEffect)) {
            value = {
              ...value,
              mousedown: effect.value,
            }
          }
        }

        const tree = syntaxTree(tr.state)
        if (
          tree.type === value.previousTree.type &&
          tree.length < tr.state.doc.length
        ) {
          // still parsing
          value = {
            ...value,
            decorations: value.decorations.map(tr.changes),
          }
        } else if (
          // only update the decorations when the mouse is not making a selection
          !value.mousedown &&
          (tree !== value.previousTree ||
            tr.selection ||
            hasMouseDownEffect(tr))
        ) {
          // tree changed, or selection changed, or mousedown ended
          // TODO: update the existing decorations for the changed range(s)?
          const { decorations, preamble } = createDecorations(tr.state, tree)
          value = {
            ...value,
            decorations,
            preamble,
            previousTree: tree,
          }
        }

        return value
      },
      provide(field) {
        return [
          EditorView.decorations.from(field, field => field.decorations),
          EditorView.atomicRanges.from(field, value => () => value.decorations),
          ViewPlugin.define(view => {
            return {
              update(update) {
                for (const tr of update.transactions) {
                  if (tr.annotation(pickedCompletion)?.label === '\\href{}{}') {
                    window.setTimeout(() => nextSnippetField(view))
                  }
                }
              },
            }
          }),
          skipPreambleWithCursor(field),
          selectDecoratedArgument(field),
        ]
      },
    }),
  ]
}
