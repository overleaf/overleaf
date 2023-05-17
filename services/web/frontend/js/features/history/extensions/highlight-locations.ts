import { EditorSelection, StateEffect, StateField } from '@codemirror/state'
import { Highlight } from '../services/types/doc'
import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { highlightDecorationsField } from './highlights'
import { throttle, isEqual } from 'lodash'
import { updateHasEffect } from '../../source-editor/utils/effects'

export type HighlightLocations = {
  before: number
  after: number
  next?: Highlight
  previous?: Highlight
}

const setHighlightLocationsEffect = StateEffect.define<HighlightLocations>()
const hasSetHighlightLocationsEffect = updateHasEffect(
  setHighlightLocationsEffect
)

// Returns the range within the document that is currently visible to the user
function visibleRange(view: EditorView) {
  const { top, bottom } = view.scrollDOM.getBoundingClientRect()
  const first = view.lineBlockAtHeight(top - view.documentTop)
  const last = view.lineBlockAtHeight(bottom - view.documentTop)
  return { from: first.from, to: last.to }
}

function calculateHighlightLocations(view: EditorView): HighlightLocations {
  const highlightsBefore: Highlight[] = []
  const highlightsAfter: Highlight[] = []
  let next
  let previous

  const highlights =
    view.state.field(highlightDecorationsField)?.highlights || []

  if (highlights.length === 0) {
    return { before: 0, after: 0 }
  }

  const { from: visibleFrom, to: visibleTo } = visibleRange(view)

  for (const highlight of highlights) {
    if (highlight.range.to <= visibleFrom) {
      highlightsBefore.push(highlight)
    } else if (highlight.range.from >= visibleTo) {
      highlightsAfter.push(highlight)
    }
  }

  const before = highlightsBefore.length
  const after = highlightsAfter.length
  if (before > 0) {
    previous = highlightsBefore[highlightsBefore.length - 1]
  }
  if (after > 0) {
    next = highlightsAfter[0]
  }

  return {
    before,
    after,
    previous,
    next,
  }
}

const plugin = ViewPlugin.fromClass(
  class {
    // eslint-disable-next-line no-useless-constructor
    constructor(readonly view: EditorView) {}

    dispatchIfChanged() {
      const oldLocations = this.view.state.field(highlightLocationsField)
      const newLocations = calculateHighlightLocations(this.view)

      if (!isEqual(oldLocations, newLocations)) {
        this.view.dispatch({
          effects: setHighlightLocationsEffect.of(newLocations),
        })
      }
    }

    update(update: ViewUpdate) {
      if (!hasSetHighlightLocationsEffect(update)) {
        // Normally, a timeout is a poor choice, but in this case it doesn't
        // matter that there is a slight delay or that it might run after the
        // viewer has been torn down
        window.setTimeout(() => this.dispatchIfChanged())
      }
    }
  },
  {
    eventHandlers: {
      scroll: throttle(
        (event, view: EditorView) => {
          view.plugin(plugin)?.dispatchIfChanged()
        },
        120,
        { trailing: true }
      ),
    },
  }
)

export const highlightLocationsField = StateField.define<HighlightLocations>({
  create() {
    return { before: 0, visible: 0, after: 0 }
  },
  update(highlightLocations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightLocationsEffect)) {
        return effect.value
      }
    }
    return highlightLocations
  },
  provide: () => [plugin],
})

export function highlightLocations() {
  return highlightLocationsField
}

export function scrollToHighlight(view: EditorView, highlight: Highlight) {
  view.dispatch({
    effects: EditorView.scrollIntoView(
      EditorSelection.range(highlight.range.from, highlight.range.to),
      {
        y: 'center',
      }
    ),
  })
}
