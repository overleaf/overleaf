import {
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import { EditorState, Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { getUnstarredEnvironmentName } from '../../utils/tree-operations/environments'
import { centeringNodeForEnvironment } from '../../utils/tree-operations/figure'
import { parseTheoremStyles } from '../../utils/tree-operations/theorems'
import { Tree } from '@lezer/common'
import { parseColorArguments } from '../../utils/tree-operations/colors'

/**
 * A view plugin that decorates ranges of text with Mark decorations.
 * Mark decorations add attributes to elements within a range.
 */
export const markDecorations = ViewPlugin.define(
  view => {
    const createDecorations = (
      state: EditorState,
      tree: Tree
    ): DecorationSet => {
      const decorations: Range<Decoration>[] = []

      const theoremStyles = parseTheoremStyles(state, tree)

      for (const { from, to } of view.visibleRanges) {
        tree?.iterate({
          from,
          to,
          enter(nodeRef) {
            if (
              nodeRef.type.is('KnownCommand') ||
              nodeRef.type.is('UnknownCommand')
            ) {
              // decorate commands with a class, for optional styling
              const ctrlSeq =
                nodeRef.node.getChild('$CtrlSeq') ??
                nodeRef.node.firstChild?.getChild('$CtrlSeq')

              if (ctrlSeq) {
                const text = state.doc.sliceString(ctrlSeq.from + 1, ctrlSeq.to)

                // a special case for "label" as the whole command needs a space afterwards
                if (text === 'label') {
                  // decorate the whole command
                  const from = nodeRef.from
                  const to = nodeRef.to
                  if (to > from) {
                    decorations.push(
                      Decoration.mark({
                        class: `ol-cm-${text}`,
                        inclusive: true,
                      }).range(from, to)
                    )
                  }
                } else {
                  // decorate the command content
                  const from = ctrlSeq.to + 1
                  const to = nodeRef.to - 1
                  if (to > from) {
                    decorations.push(
                      Decoration.mark({
                        class: `ol-cm-command-${text}`,
                        inclusive: true,
                      }).range(from, to)
                    )
                  }
                }
              }
            } else if (nodeRef.type.is('SectioningCommand')) {
              // decorate section headings with a class, for styling
              const ctrlSeq = nodeRef.node.getChild('$CtrlSeq')
              if (ctrlSeq) {
                const text = state.doc.sliceString(ctrlSeq.from + 1, ctrlSeq.to)

                decorations.push(
                  Decoration.mark({
                    class: `ol-cm-heading ol-cm-command-${text}`,
                  }).range(nodeRef.from, nodeRef.to)
                )
              }
            } else if (nodeRef.type.is('Caption') || nodeRef.type.is('Label')) {
              const type = nodeRef.type.is('Caption') ? 'caption' : 'label'
              // decorate caption and label lines with a class, for styling
              const argument = nodeRef.node.getChild('$Argument')

              if (argument) {
                const lines = {
                  start: state.doc.lineAt(nodeRef.from),
                  end: state.doc.lineAt(nodeRef.to),
                }

                for (
                  let lineNumber = lines.start.number;
                  lineNumber <= lines.end.number;
                  lineNumber++
                ) {
                  const line = state.doc.line(lineNumber)
                  decorations.push(
                    Decoration.line({
                      class: `ol-cm-${type}-line`,
                    }).range(line.from)
                  )
                }
              }
            } else if (nodeRef.type.is('TextColorCommand')) {
              const result = parseColorArguments(state, nodeRef.node)

              if (result) {
                const { color, from, to } = result

                // decorate the content
                decorations.push(
                  Decoration.mark({
                    class: 'ol-cm-textcolor',
                    inclusive: true,
                    attributes: {
                      style: `color: ${color}`,
                    },
                  }).range(from, to)
                )
              }
            } else if (nodeRef.type.is('ColorBoxCommand')) {
              const result = parseColorArguments(state, nodeRef.node)

              if (result) {
                const { color, from, to } = result

                // decorate the content
                decorations.push(
                  Decoration.mark({
                    class: 'ol-cm-colorbox',
                    inclusive: true,
                    attributes: {
                      style: `background-color: ${color}`,
                    },
                  }).range(from, to)
                )
              }
            } else if (nodeRef.type.is('$Environment')) {
              const environmentName = getUnstarredEnvironmentName(
                nodeRef.node,
                state
              )

              if (environmentName) {
                switch (environmentName) {
                  case 'abstract':
                  case 'figure':
                  case 'table':
                  case 'verbatim':
                  case 'lstlisting':
                    {
                      const centered = Boolean(
                        centeringNodeForEnvironment(nodeRef)
                      )

                      const lines = {
                        start: state.doc.lineAt(nodeRef.from),
                        end: state.doc.lineAt(nodeRef.to),
                      }

                      for (
                        let lineNumber = lines.start.number;
                        lineNumber <= lines.end.number;
                        lineNumber++
                      ) {
                        const line = state.doc.line(lineNumber)

                        const classNames = [
                          `ol-cm-environment-${environmentName}`,
                          'ol-cm-environment-line',
                        ]

                        if (centered) {
                          classNames.push('ol-cm-environment-centered')
                        }

                        decorations.push(
                          Decoration.line({
                            class: classNames.join(' '),
                          }).range(line.from)
                        )
                      }
                    }
                    break

                  case 'quote':
                  case 'quotation':
                  case 'quoting':
                  case 'displayquote':
                    {
                      const lines = {
                        start: state.doc.lineAt(nodeRef.from),
                        end: state.doc.lineAt(nodeRef.to),
                      }

                      for (
                        let lineNumber = lines.start.number;
                        lineNumber <= lines.end.number;
                        lineNumber++
                      ) {
                        const line = state.doc.line(lineNumber)

                        const classNames = [
                          `ol-cm-environment-${environmentName}`,
                          'ol-cm-environment-quote-block',
                          'ol-cm-environment-line',
                        ]

                        decorations.push(
                          Decoration.line({
                            class: classNames.join(' '),
                          }).range(line.from)
                        )
                      }
                    }
                    break

                  default:
                    if (theoremStyles.has(environmentName)) {
                      const theoremStyle = theoremStyles.get(environmentName)

                      if (theoremStyle) {
                        const lines = {
                          start: state.doc.lineAt(nodeRef.from),
                          end: state.doc.lineAt(nodeRef.to),
                        }

                        decorations.push(
                          Decoration.line({
                            class: [
                              `ol-cm-environment-theorem-${theoremStyle}`,
                              'ol-cm-environment-first-line',
                            ].join(' '),
                          }).range(lines.start.from)
                        )

                        for (
                          let lineNumber = lines.start.number + 1;
                          lineNumber <= lines.end.number - 1;
                          lineNumber++
                        ) {
                          const line = state.doc.line(lineNumber)

                          decorations.push(
                            Decoration.line({
                              class: [
                                `ol-cm-environment-theorem-${theoremStyle}`,
                                'ol-cm-environment-line',
                              ].join(' '),
                            }).range(line.from)
                          )
                        }

                        decorations.push(
                          Decoration.line({
                            class: [
                              `ol-cm-environment-theorem-${theoremStyle}`,
                              'ol-cm-environment-last-line',
                            ].join(' '),
                          }).range(lines.start.from)
                        )
                      }
                    }
                    break
                }
              }
            }
          },
        })
      }

      return Decoration.set(decorations, true)
    }

    let previousTree = syntaxTree(view.state)

    return {
      decorations: createDecorations(view.state, previousTree),
      update(update: ViewUpdate) {
        const tree = syntaxTree(update.state)

        // still parsing
        if (
          tree.type === previousTree.type &&
          tree.length < update.view.viewport.to
        ) {
          this.decorations = this.decorations.map(update.changes)
        } else if (tree !== previousTree || update.viewportChanged) {
          // parsed or resized
          previousTree = tree
          // TODO: update the existing decorations for the changed range(s)?
          this.decorations = createDecorations(update.state, tree)
        }
      },
    }
  },
  {
    decorations(value) {
      return value.decorations
    },
  }
)
