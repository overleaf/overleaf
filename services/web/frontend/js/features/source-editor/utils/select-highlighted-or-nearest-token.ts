import { EditorState } from '@codemirror/state'
import { isCursorOnEmptyLine } from './is-cursor-on-empty-line'

/**
 * Returns the current highlighted range, or the nearest non-whitespace token
 * to the cursor when there is no active selection.
 *
 * "Token" here means any contiguous run of non-whitespace characters (`/\S+/`),
 * not necessarily an alphanumeric word. When two tokens are equidistant the
 * earlier one (closer to document start) wins.
 *
 * Only searches the current line.
 *
 * Only called on user-initiated actions (e.g. "Add comment"), not on every render.
 * Returns null when the cursor is on an empty/whitespace-only line.
 */
export function selectHighlightedOrNearestToken(
  state: EditorState
): { from: number; to: number } | null {
  if (isCursorOnEmptyLine(state)) {
    return null
  }

  const { main } = state.selection

  if (!main.empty) {
    return { from: main.from, to: main.to }
  }

  const pos = main.head
  const line = state.doc.lineAt(pos)

  let bestFrom = 0
  let bestTo = 0
  let bestDist = Infinity

  for (const match of line.text.matchAll(/\S+/g)) {
    const from = line.from + match.index!
    const to = from + match[0].length

    let dist = 0
    if (pos < from) {
      dist = from - pos
    } else if (pos > to) {
      dist = pos - to
    }

    if (dist === 0) {
      return { from, to }
    }

    if (dist < bestDist) {
      bestFrom = from
      bestTo = to
      bestDist = dist
    }

    // Past the cursor — no closer match possible on this line
    if (from > pos) {
      break
    }
  }

  if (bestDist < Infinity) {
    return { from: bestFrom, to: bestTo }
  }
  return null
}
