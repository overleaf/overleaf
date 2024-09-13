import { EditorSelection, Prec } from '@codemirror/state'
import { EditorView, layer } from '@codemirror/view'
import { rectangleMarkerForRange } from '../utils/layer'
import { updateHasMouseDownEffect } from './visual/selection'
import browser from './browser'

/**
 * The built-in extension which draws the cursor and selection(s) in layers,
 * copied to make use of a custom version of rectangleMarkerForRange which calls
 * fullHeightCoordsAtPos when in Source mode, extending the top and bottom
 * of the coords to cover the full line height.
 */
export const drawSelection = () => {
  return [cursorLayer, selectionLayer, Prec.highest(hideNativeSelection)]
}

const canHidePrimary = !browser.ios

const hideNativeSelection = EditorView.theme({
  '.cm-line': {
    'caret-color': canHidePrimary ? 'transparent !important' : null,
    '& ::selection': {
      backgroundColor: 'transparent !important',
    },
    '&::selection': {
      backgroundColor: 'transparent !important',
    },
  },
})

const cursorLayer = layer({
  above: true,
  markers(view) {
    const {
      selection: { ranges, main },
    } = view.state

    const cursors = []

    for (const range of ranges) {
      const primary = range === main

      if (!range.empty || !primary || canHidePrimary) {
        const className = primary
          ? 'cm-cursor cm-cursor-primary'
          : 'cm-cursor cm-cursor-secondary'

        const cursor = range.empty
          ? range
          : EditorSelection.cursor(
              range.head,
              range.head > range.anchor ? -1 : 1
            )

        for (const piece of rectangleMarkerForRange(view, className, cursor)) {
          cursors.push(piece)
        }
      }
    }

    return cursors
  },
  update(update, dom) {
    if (update.transactions.some(tr => tr.selection)) {
      dom.style.animationName =
        dom.style.animationName === 'cm-blink' ? 'cm-blink2' : 'cm-blink'
    }
    return (
      update.docChanged ||
      update.selectionSet ||
      updateHasMouseDownEffect(update)
    )
  },
  mount(dom) {
    dom.style.animationDuration = '1200ms'
  },
  class: 'cm-cursorLayer',
})

const selectionLayer = layer({
  above: false,
  markers(view) {
    const markers = []
    for (const range of view.state.selection.ranges) {
      if (!range.empty) {
        markers.push(
          ...rectangleMarkerForRange(view, 'cm-selectionBackground', range)
        )
      }
    }
    return markers
  },
  update(update) {
    return (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged ||
      updateHasMouseDownEffect(update)
    )
  },
  class: 'cm-selectionLayer',
})
