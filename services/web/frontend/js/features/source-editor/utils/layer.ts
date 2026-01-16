/**
 * This file is adapted from CodeMirror 6, licensed under the MIT license:
 * https://github.com/codemirror/view/blob/main/src/layer.ts
 */
import {
  BlockInfo,
  BlockType,
  Direction,
  EditorView,
  Rect,
  RectangleMarker,
} from '@codemirror/view'
import { EditorSelection, SelectionRange } from '@codemirror/state'
import { isVisual } from '../extensions/visual/visual'
import { round } from 'lodash'

function canAssumeUniformLineHeights(view: EditorView) {
  return !isVisual(view)
}

export const rectangleMarkerForRange = (
  view: EditorView,
  className: string,
  range: SelectionRange
): readonly RectangleMarker[] => {
  if (range.empty) {
    const pos = fullHeightCoordsAtPos(view, range.head, range.assoc || 1)

    if (!pos) {
      return []
    }

    const base = getBase(view)

    return [
      new RectangleMarker(
        className,
        pos.left - base.left,
        pos.top - base.top,
        null,
        pos.bottom - pos.top
      ),
    ]
  }

  return rectanglesForRange(view, className, range)
}

export function getBase(view: EditorView) {
  const rect = view.scrollDOM.getBoundingClientRect()
  const left =
    view.textDirection === Direction.LTR
      ? rect.left
      : rect.right - view.scrollDOM.clientWidth
  return {
    left: left - view.scrollDOM.scrollLeft,
    top: rect.top - view.scrollDOM.scrollTop,
  }
}

function wrappedLine(
  view: EditorView,
  pos: number,
  inside: { from: number; to: number }
) {
  const range = EditorSelection.cursor(pos)
  return {
    from: Math.max(
      inside.from,
      view.moveToLineBoundary(range, false, true).from
    ),
    to: Math.min(inside.to, view.moveToLineBoundary(range, true, true).from),
    type: BlockType.Text,
  }
}

function blockAt(view: EditorView, pos: number): BlockInfo {
  const line = view.lineBlockAt(pos)
  if (Array.isArray(line.type))
    for (const l of line.type) {
      if (
        l.to > pos ||
        (l.to === pos && (l.to === line.to || l.type === BlockType.Text))
      )
        return l
    }
  return line as any
}

// Like coordsAtPos, provides screen coordinates for a document position, but
// unlike coordsAtPos, the top and bottom represent the full height of the
// visual line rather than the top and bottom of the text. To do this, it relies
// on the assumption that all text in the document has the same height and that
// the line contains no widget or decoration that changes the height of the
// line. This is, I am fairly certain, a safe assumption in source mode but not
// in rich text, so in rich text mode this function just returns coordsAtPos.
export function fullHeightCoordsAtPos(
  view: EditorView,
  pos: number,
  side?: -2 | -1 | 1 | 2 | undefined
): Rect | null {
  // @ts-ignore CodeMirror has incorrect type on coordsAtPos
  const coords = view.coordsAtPos(pos, side)
  if (!coords) {
    return null
  }

  if (!canAssumeUniformLineHeights(view)) {
    return coords
  }

  const { left, right } = coords
  const halfLeading =
    (view.defaultLineHeight - (coords.bottom - coords.top)) / 2

  return {
    left,
    right,
    top: round(coords.top - halfLeading, 2),
    bottom: round(coords.bottom + halfLeading, 2),
  }
}

// Added to range rectangle's vertical extent to prevent rounding
// errors from introducing gaps in the rendered content.
const Epsilon = 0.01

function rectanglesForRange(
  view: EditorView,
  className: string,
  range: SelectionRange
): RectangleMarker[] {
  if (range.to <= view.viewport.from || range.from >= view.viewport.to) {
    return []
  }
  const from = Math.max(range.from, view.viewport.from)
  const to = Math.min(range.to, view.viewport.to)

  const ltr = view.textDirection === Direction.LTR
  const content = view.contentDOM
  const contentRect = content.getBoundingClientRect()
  const base = getBase(view)

  const lineElt = content.querySelector('.cm-line')
  const lineStyle = lineElt && window.getComputedStyle(lineElt)
  const leftSide =
    contentRect.left +
    (lineStyle
      ? parseInt(lineStyle.paddingLeft) +
        Math.min(0, parseInt(lineStyle.textIndent))
      : 0)
  const rightSide =
    contentRect.right - (lineStyle ? parseInt(lineStyle.paddingRight) : 0)

  const startBlock = blockAt(view, from)
  const endBlock = blockAt(view, to)
  let visualStart: { from: number; to: number } | null =
    startBlock.type === BlockType.Text ? startBlock : null
  let visualEnd: { from: number; to: number } | null =
    endBlock.type === BlockType.Text ? endBlock : null
  if (view.lineWrapping) {
    if (visualStart) visualStart = wrappedLine(view, from, visualStart)
    if (visualEnd) visualEnd = wrappedLine(view, to, visualEnd)
  }
  if (visualStart && visualEnd && visualStart.from === visualEnd.from) {
    return pieces(drawForLine(range.from, range.to, visualStart))
  } else {
    const top = visualStart
      ? drawForLine(range.from, null, visualStart)
      : drawForWidget(startBlock, false)
    const bottom = visualEnd
      ? drawForLine(null, range.to, visualEnd)
      : drawForWidget(endBlock, true)
    const between = []

    if (
      (visualStart || startBlock).to <
      (visualEnd || endBlock).from - (visualStart && visualEnd ? 1 : 0)
    )
      between.push(piece(leftSide, top.bottom, rightSide, bottom.top))
    else if (
      top.bottom < bottom.top &&
      view.elementAtHeight((top.bottom + bottom.top) / 2).type ===
        BlockType.Text
    )
      top.bottom = bottom.top = (top.bottom + bottom.top) / 2
    return pieces(top).concat(between).concat(pieces(bottom))
  }

  function piece(left: number, top: number, right: number, bottom: number) {
    return new RectangleMarker(
      className,
      left - base.left,
      top - base.top - Epsilon,
      right - left,
      bottom - top + Epsilon
    )
  }

  function pieces({
    top,
    bottom,
    horizontal,
  }: {
    top: number
    bottom: number
    horizontal: number[]
  }) {
    const pieces = []
    for (let i = 0; i < horizontal.length; i += 2)
      pieces.push(piece(horizontal[i], top, horizontal[i + 1], bottom))
    return pieces
  }

  // Gets passed from/to in line-local positions
  function drawForLine(
    from: null | number,
    to: null | number,
    line: { from: number; to: number }
  ) {
    let top = 1e9
    let bottom = -1e9
    const horizontal: number[] = []

    function addSpan(
      from: number,
      fromOpen: boolean,
      to: number,
      toOpen: boolean,
      dir: Direction
    ) {
      // Passing 2/-2 is a kludge to force the view to return
      // coordinates on the proper side of block widgets, since
      // normalizing the side there, though appropriate for most
      // coordsAtPos queries, would break selection drawing.
      const fromCoords = fullHeightCoordsAtPos(
        view,
        from,
        (from === line.to ? -2 : 2) as any
      )
      const toCoords = fullHeightCoordsAtPos(
        view,
        to,
        (to === line.from ? 2 : -2) as any
      )
      // coordsAtPos can sometimes return null even when the document position
      // is within the viewport. It's not clear exactly when this happens;
      // sometimes, the editor has previously failed to complete a measure.
      if (!fromCoords || !toCoords) {
        return
      }
      top = Math.min(fromCoords.top, toCoords.top, top)
      bottom = Math.max(fromCoords.bottom, toCoords.bottom, bottom)
      if (dir === Direction.LTR)
        horizontal.push(
          ltr && fromOpen ? leftSide : fromCoords.left,
          ltr && toOpen ? rightSide : toCoords.right
        )
      else
        horizontal.push(
          !ltr && toOpen ? leftSide : toCoords.left,
          !ltr && fromOpen ? rightSide : fromCoords.right
        )
    }

    const start = from ?? line.from
    const end = to ?? line.to
    // Split the range by visible range and document line
    for (const r of view.visibleRanges)
      if (r.to > start && r.from < end) {
        for (
          let pos = Math.max(r.from, start), endPos = Math.min(r.to, end);
          ;
        ) {
          const docLine = view.state.doc.lineAt(pos)
          for (const span of view.bidiSpans(docLine)) {
            const spanFrom = span.from + docLine.from
            const spanTo = span.to + docLine.from
            if (spanFrom >= endPos) break
            if (spanTo > pos)
              addSpan(
                Math.max(spanFrom, pos),
                from === null && spanFrom <= start,
                Math.min(spanTo, endPos),
                to === null && spanTo >= end,
                span.dir
              )
          }
          pos = docLine.to + 1
          if (pos >= endPos) break
        }
      }
    if (horizontal.length === 0)
      addSpan(start, from === null, end, to === null, view.textDirection)

    return { top, bottom, horizontal }
  }

  function drawForWidget(block: BlockInfo, top: boolean) {
    const y = contentRect.top + (top ? block.top : block.bottom)
    return { top: y, bottom: y, horizontal: [] }
  }
}
