import { EditorView } from '@codemirror/view'

const TOP_EDGE_THRESHOLD = 100
const BOTTOM_EDGE_THRESHOLD = 200

export function isCursorNearViewportEdge(view: EditorView, pos: number) {
  const cursorCoords = view.coordsAtPos(pos)

  if (!cursorCoords) {
    return false
  }

  const scrollInfo = view.scrollDOM.getBoundingClientRect()

  // check if the cursor is near the top of the viewport
  if (Math.abs(cursorCoords.bottom - scrollInfo.top) <= TOP_EDGE_THRESHOLD) {
    return true
  }
  // check if the cursor is near the bottom of the viewport
  const viewportHeight = view.scrollDOM.clientHeight
  const viewportBottom = scrollInfo.top + viewportHeight
  return Math.abs(cursorCoords.bottom - viewportBottom) <= BOTTOM_EDGE_THRESHOLD
}
