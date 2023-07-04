/**
 * Adapted from the "isInPrimarySelection" function in CodeMirror 6, licensed under the MIT license:
 * https://github.com/codemirror/view/blob/main/src/input.ts
 */

import { EditorView } from '@codemirror/view'

export function isInPrimarySelection(
  event: MouseEvent | undefined,
  view?: EditorView
) {
  if (!event) return false
  if (view?.state.selection.main.empty) return false

  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return true

  const rects = selection.getRangeAt(0).getClientRects()
  for (const rect of rects) {
    if (
      rect.left <= event.clientX &&
      rect.right >= event.clientX &&
      rect.top <= event.clientY &&
      rect.bottom >= event.clientY
    )
      return true
  }
  return false
}
