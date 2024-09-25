import { keymap } from '@codemirror/view'
import {
  ChangeSpec,
  EditorSelection,
  Prec,
  SelectionRange,
} from '@codemirror/state'
import { ancestorNodeOfType } from '../../utils/tree-query'
import {
  cursorIsAtStartOfListItem,
  indentDecrease,
  indentIncrease,
} from '../toolbar/commands'
import { createListItem } from '@/features/source-editor/extensions/visual/utils/list-item'
import { getListType } from '../../utils/tree-operations/lists'

/**
 * A keymap which provides behaviours for the visual editor,
 * including lists and text formatting.
 */
export const visualKeymap = Prec.highest(
  keymap.of([
    // create a new list item with the same indentation
    {
      key: 'Enter',
      run: view => {
        const { state } = view

        let handled = false

        const changes = state.changeByRange(range => {
          if (range.empty) {
            const { from } = range
            const listNode = ancestorNodeOfType(state, from, 'ListEnvironment')
            if (listNode) {
              const line = state.doc.lineAt(range.from)
              const endLine = state.doc.lineAt(listNode.to)

              if (line.number === endLine.number - 1) {
                // last item line
                if (/^\\item(\[])?$/.test(line.text.trim())) {
                  // no content on this line

                  // outside the end of the current list
                  const pos = listNode.to + 1

                  // delete the current line
                  const deleteCurrentLine = {
                    from: line.from,
                    to: line.to + 1,
                    insert: '',
                  }

                  const changes: ChangeSpec[] = [deleteCurrentLine]

                  // the new cursor position
                  let range: SelectionRange

                  // if this is a nested list, insert a new empty list item after this list
                  if (
                    listNode.parent?.parent?.parent?.parent?.type.is(
                      'ListEnvironment'
                    )
                  ) {
                    const newListItem = createListItem(state, pos)

                    changes.push({
                      from: pos,
                      insert: newListItem + '\n',
                    })

                    // place the cursor at the end of the new list item
                    range = EditorSelection.cursor(pos + newListItem.length)
                  } else {
                    // place the cursor outside the end of the current list
                    range = EditorSelection.cursor(pos)
                  }

                  handled = true

                  return {
                    changes,
                    range: range.map(state.changes(deleteCurrentLine)),
                  }
                }
              }

              // handle a list item that isn't at the end of a list
              let insert = '\n' + createListItem(state, from)

              const countWhitespaceAfterPosition = (pos: number) => {
                const line = state.doc.lineAt(pos)
                const followingText = state.sliceDoc(pos, line.to)
                const matches = followingText.match(/^(\s+)/)
                return matches ? matches[1].length : 0
              }

              let pos: number

              if (getListType(state, listNode) === 'description') {
                insert = insert.replace(/\\item $/, '\\item[] ')
                // position the cursor inside the square brackets
                pos = from + insert.length - 2
              } else {
                // move the cursor past any whitespace on the new line
                pos = from + insert.length + countWhitespaceAfterPosition(from)
              }

              handled = true

              return {
                changes: { from, insert },
                range: EditorSelection.cursor(pos, -1),
              }
            }

            const sectioningNode = ancestorNodeOfType(
              state,
              from,
              'SectioningCommand'
            )
            if (sectioningNode) {
              // jump out of a section heading to the start of the next line
              const nextLineNumber = state.doc.lineAt(from).number + 1
              if (nextLineNumber <= state.doc.lines) {
                const line = state.doc.line(nextLineNumber)
                handled = true
                return {
                  range: EditorSelection.cursor(line.from),
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
    // Increase list indent
    {
      key: 'Mod-]',
      preventDefault: true,
      run: indentIncrease,
    },
    // Decrease list indent
    {
      key: 'Mod-[',
      preventDefault: true,
      run: indentDecrease,
    },
    // Increase list indent
    {
      key: 'Tab',
      preventDefault: true,
      run: view =>
        cursorIsAtStartOfListItem(view.state) && indentIncrease(view),
    },
    // Decrease list indent
    {
      key: 'Shift-Tab',
      preventDefault: true,
      run: indentDecrease,
    },
  ])
)
