import { EditorView } from '@codemirror/view'

const TOP_EDGE_THRESHOLD = 100
const BOTTOM_EDGE_THRESHOLD = 200

export function isCursorNearViewportEdge(view: EditorView, pos: number) {
  return (
    isCursorNearViewportTop(view, pos) || isCursorNearViewportBottom(view, pos)
  )
}

export function isCursorNearViewportTop(
  view: EditorView,
  pos: number,
  threshold = TOP_EDGE_THRESHOLD
) {
  const cursorCoords = view.coordsAtPos(pos)

  if (!cursorCoords) {
    return false
  }

  const scrollInfo = view.scrollDOM.getBoundingClientRect()

  return Math.abs(cursorCoords.bottom - scrollInfo.top) <= threshold
}

export function isCursorNearViewportBottom(
  view: EditorView,
  pos: number,
  threshold = BOTTOM_EDGE_THRESHOLD
) {
  const cursorCoords = view.coordsAtPos(pos)

  if (!cursorCoords) {
    return false
  }

  const scrollInfo = view.scrollDOM.getBoundingClientRect()
  const viewportHeight = view.scrollDOM.clientHeight
  const viewportBottom = scrollInfo.top + viewportHeight
  return Math.abs(cursorCoords.bottom - viewportBottom) <= threshold
}
