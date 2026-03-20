import { EditorState } from '@codemirror/state'

/**
 * Returns true when the cursor is on an empty line with no active selection.
 *
 * Used to disable the "Add comment" action — there is nothing to anchor a
 * comment to on a blank line.
 */
export function isCursorOnEmptyLine(state: EditorState): boolean {
  const { main } = state.selection

  if (!main.empty) {
    return false
  }

  const line = state.doc.lineAt(main.head)
  return line.text.trim().length === 0
}
