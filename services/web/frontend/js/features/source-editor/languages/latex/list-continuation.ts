import { EditorSelection, EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { insertNewlineAndIndent } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import {
  ListEnvironment,
  VerbatimEnvironment,
} from '../../lezer-latex/latex.terms.mjs'
import { ancestorOfNodeWithType } from '../../utils/tree-operations/ancestors'
import { getListType } from '../../utils/tree-operations/lists'
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

                // only continue when an \item precedes the cursor (skip empty lists)
                if (/\\item(\[|\s|$)/.test(state.sliceDoc(listNode.from, from))) {
                  let insert = '\n' + createListItem(state, from)
                  let pos: number

                  if (getListType(state, listNode) === 'description') {
                    insert = insert.replace(/\\item $/, '\\item[] ')
                    // position the cursor inside the square brackets
                    pos = from + insert.length - 2
                  } else {
                    // move the cursor past any whitespace on the new line
                    pos =
                      from +
                      insert.length +
                      countWhitespaceAfterPosition(state, from)
                  }

                  handled = true

                  return {
                    changes: { from, insert },
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
