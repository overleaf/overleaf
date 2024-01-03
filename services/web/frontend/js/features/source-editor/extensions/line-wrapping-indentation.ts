import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import { type Range, StateEffect, StateField } from '@codemirror/state'
import { sourceOnly } from './visual/visual'

const MAX_INDENT_FRACTION = 0.9

const setMaxIndentEffect = StateEffect.define<number>()

/**
 * Calculates the indentation needed for each line based on the spaces and tabs at the start of the line.
 * Decorates each line with a `style` attribute, to ensure that wrapped lines share the same indentation.
 *
 * NOTE: performance increases linearly with document size, but decorating only the viewport causes unacceptable layout shifts when scrolling.
 */
export const lineWrappingIndentation = (visual: boolean) => {
  // this extension should only be active in the source editor
  return sourceOnly(visual, [
    // store the current maxIndent, based on the clientWidth
    StateField.define<number>({
      create() {
        return 0
      },
      update(value, tr) {
        for (const effect of tr.effects) {
          if (effect.is(setMaxIndentEffect)) {
            value = effect.value
          }
        }

        return value
      },
      provide(field) {
        return [
          // calculate the max indent when the geometry changes
          ViewPlugin.define(view => {
            const measure = {
              key: 'line-wrapping-indentation-max-indent',
              read(view: EditorView) {
                return (
                  (view.contentDOM.clientWidth / view.defaultCharacterWidth) *
                  MAX_INDENT_FRACTION
                )
              },
              write(value: number, view: EditorView) {
                if (view.state.field(field) !== value) {
                  window.setTimeout(() => {
                    view.dispatch({
                      effects: setMaxIndentEffect.of(value),
                    })
                  })
                }
              },
            }

            return {
              update(update: ViewUpdate) {
                if (update.geometryChanged) {
                  view.requestMeasure(measure)
                }
              },
            }
          }),

          // rebuild the decorations when needed
          ViewPlugin.define<{ decorations: DecorationSet }>(
            view => {
              let previousMaxIndent = 0

              const value = {
                decorations: buildDecorations(view, view.state.field(field)),

                update(update: ViewUpdate) {
                  const maxIndent = view.state.field(field)

                  if (maxIndent !== previousMaxIndent) {
                    value.decorations = buildDecorations(view, maxIndent)
                  } else if (update.geometryChanged || update.viewportChanged) {
                    value.decorations = updateDecorations(
                      value.decorations,
                      update,
                      maxIndent
                    )
                  }

                  previousMaxIndent = maxIndent
                },
              }

              return value
            },
            {
              decorations: value => value.decorations,
            }
          ),
        ]
      },
    }),
  ])
}

export const buildDecorations = (view: EditorView, maxIndent: number) => {
  const { state } = view
  const { doc, tabSize } = state

  const decorations: Range<Decoration>[] = []

  let from = 0

  for (const line of doc.iterLines()) {
    const indent = calculateIndent(line, tabSize, maxIndent)

    if (indent) {
      decorations.push(lineIndentDecoration(indent).range(from))
    }

    from += line.length + 1
  }

  return Decoration.set(decorations)
}

export const updateDecorations = (
  decorations: DecorationSet,
  update: ViewUpdate,
  maxIndent: number
) => {
  const add: Range<Decoration>[] = []

  const { doc: startDoc } = update.startState
  const { doc, tabSize } = update.state

  const changedLinesFrom = new Set()

  let filterFrom = doc.length
  let filterTo = 0

  update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    // remove changed lines
    const fromALineNumber = startDoc.lineAt(fromA).number
    const toALineNumber = startDoc.lineAt(toA).number

    for (
      let lineNumber = fromALineNumber;
      lineNumber <= toALineNumber;
      lineNumber++
    ) {
      const line = startDoc.line(lineNumber)
      changedLinesFrom.add(line.from)
      filterFrom = Math.min(line.from, filterFrom)
      filterTo = Math.max(line.from, filterTo)
    }

    // add changed lines
    const fromBLineNumber = doc.lineAt(fromB).number
    const toBLineNumber = doc.lineAt(toB).number

    for (
      let lineNumber = fromBLineNumber;
      lineNumber <= toBLineNumber;
      lineNumber++
    ) {
      const line = doc.line(lineNumber)
      const indent = calculateIndent(line.text, tabSize, maxIndent)

      if (indent) {
        add.push(lineIndentDecoration(indent).range(line.from))
      }
    }
  })

  return decorations
    .update({
      filter(from) {
        return !changedLinesFrom.has(from)
      },
      filterFrom,
      filterTo,
    })
    .map(update.changes)
    .update({ add })
}

const lineIndentDecoration = (indent: number) =>
  Decoration.line({
    attributes: {
      // style: `text-indent: ${indent}ch hanging`, // "hanging" would be ideal, when browsers support it
      style: `text-indent: -${indent}ch; padding-left: calc(${indent}ch + 6px)`, // add 6px to account for existing padding-left
    },
  })

// calculate the character width of whitespace at the start of a line
const calculateIndent = (line: string, tabSize: number, maxIndent: number) => {
  let indent = 0

  for (const char of line) {
    if (char === ' ') {
      indent++
    } else if (char === '\t') {
      indent += tabSize - (indent % tabSize)
    } else {
      break
    }
  }

  return Math.min(indent, maxIndent)
}
