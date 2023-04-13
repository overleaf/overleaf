/**
 * This file is adapted from CodeMirror 6, licensed under the MIT license:
 * https://github.com/codemirror/search/blob/main/src/selection-match.ts
 */
import { EditorView, layer, RectangleMarker } from '@codemirror/view'
import {
  CharCategory,
  EditorSelection,
  EditorState,
  Extension,
} from '@codemirror/state'
import { SearchCursor } from '@codemirror/search'
import { rectangleMarkerForRange } from '../utils/layer'

/*
This extension highlights text that matches the selection.
It uses the `"cm-selectionMatch"` class for the highlighting.
 */
export const highlightSelectionMatches = (): Extension => [
  layer({
    above: false,
    markers(view) {
      return buildMarkers(view, view.state)
    },
    update(update) {
      return update.docChanged || update.selectionSet || update.viewportChanged
    },
    class: 'ol-cm-selectionMatchesLayer',
  }),
  EditorView.baseTheme({
    '.ol-cm-selectionMatchesLayer': {
      contain: 'size style',
      pointerEvents: 'none',
    },
    '.cm-selectionMatch': {
      position: 'absolute',
    },
  }),
]

// Whether the characters directly outside the given positions are non-word characters
function insideWordBoundaries(
  check: (char: string) => CharCategory,
  state: EditorState,
  from: number,
  to: number
): boolean {
  return (
    (from === 0 ||
      check(state.sliceDoc(from - 1, from)) !== CharCategory.Word) &&
    (to === state.doc.length ||
      check(state.sliceDoc(to, to + 1)) !== CharCategory.Word)
  )
}

// Whether the characters directly at the given positions are word characters
function insideWord(
  check: (char: string) => CharCategory,
  state: EditorState,
  from: number,
  to: number
): boolean {
  return (
    check(state.sliceDoc(from, from + 1)) === CharCategory.Word &&
    check(state.sliceDoc(to - 1, to)) === CharCategory.Word
  )
}

const buildMarkers = (
  view: EditorView,
  state: EditorState
): RectangleMarker[] => {
  const sel = state.selection
  if (sel.ranges.length > 1) {
    return []
  }

  const range = sel.main

  if (range.empty) {
    return []
  }

  const len = range.to - range.from
  if (len < 3 || len > 200) {
    return []
  }

  const query = state.sliceDoc(range.from, range.to) // TODO: allow and include leading/trailing space?
  if (query === '') {
    return []
  }

  const check = state.charCategorizer(range.head)
  if (
    !(
      insideWordBoundaries(check, state, range.from, range.to) &&
      insideWord(check, state, range.from, range.to)
    )
  ) {
    return []
  }

  const markers: RectangleMarker[] = []

  for (const part of view.visibleRanges) {
    const cursor = new SearchCursor(state.doc, query, part.from, part.to)

    while (!cursor.next().done) {
      const { from, to } = cursor.value

      if (!check || insideWordBoundaries(check, state, from, to)) {
        markers.push(
          ...rectangleMarkerForRange(
            view,
            'cm-selectionMatch',
            EditorSelection.range(from, to)
          )
        )

        if (markers.length > 100) {
          return []
        }
      }
    }
  }
  return markers
}
