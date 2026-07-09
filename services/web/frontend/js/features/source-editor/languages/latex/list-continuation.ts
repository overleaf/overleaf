import { EditorSelection, EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import {
  ListEnvironment,
  VerbatimEnvironment,
} from '../../lezer-latex/latex.terms.mjs'
import { ancestorOfNodeWithType } from '../../utils/tree-operations/ancestors'
import { createListItem } from '../../extensions/visual/utils/list-item'

const countWhitespaceAfterPosition = (
  state: EditorState,
  pos: number
): number => {
  const line = state.doc.lineAt(pos)
  const followingText = state.sliceDoc(pos, line.to)
  const matches = followingText.match(/^(\s+)/)
  return matches ? matches[1].length : 0
}

/**
 * A keymap which continues LaTeX lists in the source editor,
 * inserting a new \item on Enter.
 */
export const listItemContinuation = () =>
  Prec.high(
    keymap.of([
      {
        // insert a plain newline, never a new list item
        key: 'Shift-Enter',
        run: insertNewlineAndIndent,
      },
      {
        key: 'Enter',
        run: view => {
          const { state } = view

          let handled = false

          const changes = state.changeByRange(range => {
            if (range.empty) {
              const { from } = range

              // the innermost list, verbatim or math around the cursor
              const context = ancestorOfNodeWithType(
                syntaxTree(state).resolveInner(from),
                ListEnvironment,
                VerbatimEnvironment,
                '$MathContainer'
              )

              if (context && context.type.is(ListEnvironment)) {
                const listNode = context

                const precedingText = state.sliceDoc(listNode.from, from)

                // only continue when an \item precedes the cursor (skip empty lists)
                if (/\\item(\[|\s|$)/.test(precedingText)) {
                  let insert = '\n' + createListItem(state, from)
                  let pos: number

                  // mirror the \item[] optional argument when the item being
                  // continued uses one
                  const currentItem = precedingText.slice(
                    precedingText.lastIndexOf('\\item')
                  )
                  if (/^\\item\s*\[/.test(currentItem)) {
                    insert = insert.replace(/\\item $/, '\\item[] ')
                    // position the cursor inside the square brackets
                    pos = from + insert.length - 2
                  } else {
                    pos = from + insert.length
                  }

                  handled = true

                  // consume any whitespace after the cursor rather than
                  // carrying it onto the new item as stray indentation
                  const to = from + countWhitespaceAfterPosition(state, from)

                  return {
                    changes: { from, to, insert },
                    range: EditorSelection.cursor(pos, -1),
                  }
                }
              }
            }

            return { range }
          })

          if (handled) {
            view.dispatch(changes, {
              scrollIntoView: true,
              userEvent: 'input',
            })
          }
          return handled
        },
      },
    ])
  )
