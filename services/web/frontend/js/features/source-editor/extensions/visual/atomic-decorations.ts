import { EditorState, Range, StateField } from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
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
  parseFigureData,
} from '../../utils/tree-operations/environments'
import { MathWidget } from './visual-widgets/math'
import { GraphicsWidget } from './visual-widgets/graphics'
import { IconBraceWidget } from './visual-widgets/icon-brace'
import { TeXWidget } from './visual-widgets/tex'
import {
  createCharacterCommand,
  hasCharacterSubstitution,
} from './visual-widgets/character'
import { centeringNodeForEnvironment } from '../../utils/tree-operations/figure'
import { Frame, FrameWidget } from './visual-widgets/frame'
import { DividerWidget } from './visual-widgets/divider'
import { PreambleWidget } from './visual-widgets/preamble'
import { EndDocumentWidget } from './visual-widgets/end-document'
import { EnvironmentLineWidget } from './visual-widgets/environment-line'
import { ListEnvironmentName } from '../../utils/tree-operations/ancestors'
import { InlineGraphicsWidget } from './visual-widgets/inline-graphics'
import getMeta from '../../../../utils/meta'
import { EditableGraphicsWidget } from './visual-widgets/editable-graphics'
import { EditableInlineGraphicsWidget } from './visual-widgets/editable-inline-graphics'

type Options = {
  fileTreeManager: {
    getPreviewByPath: (
      path: string
    ) => { url: string; extension: string } | null
  }
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
  endWidget?: WidgetType
): Range<Decoration>[] {
  if (!argumentNode) {
    return []
  }
  const openBrace = argumentNode.getChild('OpenBrace')
  const closeBrace = argumentNode.getChild('CloseBrace')

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

        Decoration.replace({ widget: endWidget }).range(
          closeBrace.from,
          closeBrace.to
        ),
      ]
    }
  }
  return []
}

const hasClosingBrace = (node: SyntaxNode) =>
  node.getChild('EnvNameGroup')?.getChild('CloseBrace')

/**
 * Atomic decorations replace a range of content with an uneditable widget.
 * Decorations that span multiple lines must be contained in a StateField, not a ViewPlugin.
 */
export const atomicDecorations = (options: Options) => {
  const splitTestVariants = getMeta('ol-splitTestVariants', {})
  const figureModalEnabled = splitTestVariants['figure-modal'] === 'enabled'

  const getPreviewByPath = (path: string) =>
    options.fileTreeManager.getPreviewByPath(path)

  const createDecorations = (state: EditorState, tree: Tree): DecorationSet => {
    const decorations: Range<Decoration>[] = []

    const listEnvironmentStack: ListEnvironmentName[] = []
    let currentListEnvironment: ListEnvironmentName | undefined

    const ordinalStack: number[] = []
    let currentOrdinal = 0

    let listDepth = 0

    const preamble: {
      from: number
      to: number
      title?: {
        node: SyntaxNode
        content: string
      }
      author?: {
        node: SyntaxNode
        content: string
      }
    } = { from: 0, to: 0 }

    // find the positions of the title and author in the preamble
    tree.iterate({
      enter(nodeRef) {
        if (nodeRef.type.is('DocumentEnvironment')) {
          // Attempt to include \begin{document} in the preamble
          preamble.to = nodeRef.node.getChild('Content')?.from ?? nodeRef.from
          return false
        } else if (nodeRef.type.is('Title')) {
          const node = nodeRef.node.getChild('TextArgument')
          if (node) {
            const content = state.sliceDoc(node.from, node.to)
            preamble.title = { node, content }
          }
        } else if (nodeRef.type.is('Author')) {
          const node = nodeRef.node.getChild('TextArgument')
          if (node) {
            const content = state.sliceDoc(node.from, node.to)
            preamble.author = { node, content }
          }
        }
      },
    })
    if (preamble.to > 0) {
      // hide the preamble. We use selectionIntersects directly, so that it also
      // expands in readOnly mode.
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

      const isExpanded = selectionIntersects(state.selection, preamble)
      if (!isExpanded) {
        decorations.push(
          Decoration.replace({
            widget: new PreambleWidget(preamble.to, isExpanded),
            block: true,
          }).range(0, preamble.to)
        )
      } else {
        decorations.push(
          Decoration.widget({
            widget: new PreambleWidget(preamble.to, isExpanded),
            block: true,
            side: -1,
          }).range(0)
        )
      }
    }

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

    tree.iterate({
      enter(nodeRef) {
        if (nodeRef.type.is('$Environment')) {
          if (shouldDecorate(state, nodeRef)) {
            const envName = getEnvironmentName(nodeRef.node, state)
            const hideInEnvironmentTypes = ['figure', 'table']
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
                  !selectionIntersects(state.selection, end)
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
            }
          }
        } else if (nodeRef.type.is('BeginEnv')) {
          // the beginning of an environment, with an environment name argument
          const envName = getEnvironmentName(nodeRef.node, state)

          if (envName) {
            switch (envName) {
              case 'itemize':
              case 'enumerate':
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
                // do nothing
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
                // do nothing
                break
            }
          }
        } else if (nodeRef.type.is('$SectioningCommand')) {
          const ancestorNode = ancestorNodeOfType(
            state,
            nodeRef.to,
            'SectioningCommand'
          )
          if (ancestorNode) {
            const shouldShowBraces = !shouldDecorate(state, ancestorNode)
            // a section (or subsection, etc) command
            const argumentNode = ancestorNode.getChild('SectioningArgument')
            if (argumentNode) {
              const braces = argumentNode.getChildren('$Brace')
              if (braces.length !== 2) {
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

              decorations.push(
                Decoration.replace({
                  widget: new BraceWidget(shouldShowBraces ? '}' : ''),
                }).range(braces[1].from, braces[1].to)
              )

              decorations.push(
                Decoration.replace({
                  widget: new BraceWidget(shouldShowBraces ? '{' : ''),
                }).range(nodeRef.from, titleNode.from)
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
          if (shouldDecorate(state, nodeRef)) {
            const argumentNode = nodeRef.node
              .getChild('RefArgument')
              ?.getChild('ShortTextArgument')

            decorations.push(
              ...decorateArgumentBraces(
                new IconBraceWidget('🏷'),
                argumentNode,
                nodeRef.from
              )
            )
          }

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

          const ancestorNode =
            ancestorNodeOfType(state, nodeRef.from, '$MathContainer') ||
            ancestorNodeOfType(state, nodeRef.from, 'EquationEnvironment') ||
            // NOTE: EquationArrayEnvironment can be nested inside EquationEnvironment
            ancestorNodeOfType(state, nodeRef.from, 'EquationArrayEnvironment')

          if (
            ancestorNode &&
            (ancestorNode.type.is('$Environment')
              ? shouldDecorateFromLineEdges(state, ancestorNode)
              : shouldDecorate(state, ancestorNode))
          ) {
            // the content of the Math element, without braces
            const innerContent = state.doc
              .sliceString(nodeRef.from, nodeRef.to)
              .trim()

            // only replace when there's content inside the braces
            if (innerContent.length) {
              let content = innerContent
              let displayMode = false

              if (ancestorNode.type.is('$Environment')) {
                const environmentName = getEnvironmentName(ancestorNode, state)
                if (environmentName) {
                  // use the outer content of environments that MathJax supports
                  // https://docs.mathjax.org/en/latest/input/tex/macros/index.html#environments
                  if (
                    environmentName !== 'math' &&
                    environmentName !== 'displaymath'
                  ) {
                    content = state.doc
                      .sliceString(ancestorNode.from, ancestorNode.to)
                      .trim()
                  }

                  if (environmentName !== 'math') {
                    displayMode = true
                  }
                }
              } else {
                if (
                  ancestorNode.type.is('BracketMath') ||
                  Boolean(ancestorNode.getChild('DisplayMath'))
                ) {
                  displayMode = true
                }
              }

              decorations.push(
                Decoration.replace({
                  widget: new MathWidget(content, displayMode),
                  block: displayMode,
                }).range(ancestorNode.from, ancestorNode.to)
              )
              return false
            }
          }
        } else if (nodeRef.type.is('HrefCommand')) {
          // a hyperlink with URL and content arguments
          if (shouldDecorate(state, nodeRef)) {
            const urlArgument = nodeRef.node.getChild('UrlArgument')
            const textArgument = nodeRef.node.getChild('ShortTextArgument')

            if (urlArgument) {
              decorations.push(
                ...decorateArgumentBraces(
                  new BraceWidget(),
                  textArgument,
                  nodeRef.from
                )
              )
            }
          }
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

                const BlockGraphicsWidgetClass = figureModalEnabled
                  ? EditableGraphicsWidget
                  : GraphicsWidget

                const InlineGraphicsWidgetClass = figureModalEnabled
                  ? EditableInlineGraphicsWidget
                  : InlineGraphicsWidget

                if (lineContainsOnlyNode) {
                  decorations.push(
                    Decoration.replace({
                      widget: new BlockGraphicsWidgetClass(
                        filePath,
                        getPreviewByPath,
                        centered,
                        figureData
                      ),
                      block: true,
                    }).range(line.from, line.to)
                  )
                } else {
                  decorations.push(
                    Decoration.replace({
                      widget: new InlineGraphicsWidgetClass(
                        filePath,
                        getPreviewByPath,
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
            const to = extendForwardsOverEmptyLines(state.doc, line)

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
        } else if (nodeRef.type.is('UnknownCommand')) {
          // a command that's not defined separately by the grammar
          const commandNode = nodeRef.node
          const commandNameNode = commandNode.getChild('$CtrlSeq')
          const textArgumentNode = commandNode.getChild('TextArgument')

          if (commandNameNode) {
            const commandName = state.doc
              .sliceString(commandNameNode.from, commandNameNode.to)
              .trim()

            if (commandName.length > 0) {
              if (
                // markup that can be toggled using toolbar buttons/keyboard shortcuts
                ['\\textbf', '\\textit', '\\underline'].includes(commandName)
              ) {
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
              } else if (
                // markup that can't be toggled using toolbar buttons/keyboard shortcuts
                ['\\textsc', '\\texttt', '\\sout', '\\emph'].includes(
                  commandName
                )
              ) {
                if (shouldDecorate(state, nodeRef)) {
                  decorations.push(
                    ...decorateArgumentBraces(
                      new BraceWidget(),
                      textArgumentNode,
                      nodeRef.from
                    )
                  )
                }
              } else if (commandName === '\\url') {
                if (shouldDecorate(state, nodeRef)) {
                  // command name and opening brace
                  decorations.push(
                    ...decorateArgumentBraces(
                      new BraceWidget(),
                      textArgumentNode,
                      nodeRef.from
                    )
                  )
                  return false
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
              }
            }
          }
        }
      },
    })

    return Decoration.set(decorations, true)
  }

  let previousTree: Tree

  return [
    StateField.define<{
      mousedown: boolean
      decorations: DecorationSet
    }>({
      create(state) {
        previousTree = syntaxTree(state)

        return {
          mousedown: false,
          decorations: createDecorations(state, previousTree),
        }
      },
      update(value, tr) {
        for (const effect of tr.effects) {
          // store the "mousedown" value when it changes
          if (effect.is(mouseDownEffect)) {
            value = {
              mousedown: effect.value,
              decorations: value.decorations, // unchanged
            }
          }
        }

        const tree = syntaxTree(tr.state)
        if (
          tree.type === previousTree.type &&
          tree.length < tr.state.doc.length
        ) {
          // still parsing
          value = {
            mousedown: value.mousedown, // unchanged
            decorations: value.decorations.map(tr.changes),
          }
        } else if (
          // only update the decorations when the mouse is not making a selection
          !value.mousedown &&
          (tree !== previousTree || tr.selection || hasMouseDownEffect(tr))
        ) {
          // tree changed
          previousTree = tree
          // TODO: update the existing decorations for the changed range(s)?
          value = {
            mousedown: value.mousedown, // unchanged
            decorations: createDecorations(tr.state, tree),
          }
        }

        return value
      },
      provide(field) {
        return [
          EditorView.decorations.from(field, field => field.decorations),
          EditorView.atomicRanges.from(field, value => () => value.decorations),
        ]
      },
    }),
  ]
}
