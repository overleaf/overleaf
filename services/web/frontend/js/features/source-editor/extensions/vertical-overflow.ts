import { Extension, Facet, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'

/**
 * A custom extension which stores values for padding needed
 * a) at the top and bottom of the editor, to match the height of the review panel, and
 * b) at the bottom of the editor content, so the last line of the document can be scrolled to the top of the editor.
 */
export function verticalOverflow(): Extension {
  return [
    overflowPaddingState,
    minimumBottomPaddingState,
    bottomPadding,
    topPadding,
    contentAttributes,
    topPaddingDecoration,
    bottomPaddingPlugin,
    topPaddingPlugin,
  ]
}

type VerticalPadding = { top: number; bottom: number }

const setOverflowPaddingEffect = StateEffect.define<VerticalPadding>()

// Store extra padding needed at the top and bottom of the editor to match the height of the review panel.
// The padding needs to allow enough space for tracked changes/comments at the top and/or bottom of the review panel.
const overflowPaddingState = StateField.define<VerticalPadding>({
  create() {
    return { top: 0, bottom: 0 }
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setOverflowPaddingEffect)) {
        const { top, bottom } = effect.value
        // only update the state when the values actually change
        if (top !== value.top || bottom !== value.bottom) {
          value = { top, bottom }
        }
      }
    }
    return value
  },
})

const setMinimumBottomPaddingEffect = StateEffect.define<number>()

// Store extra padding needed at the bottom of the editor content.
// The content must have a space at the bottom equivalent to the
// height of the editor content minus one line, so that the last
// line in the document can be scrolled to the top of the editor.
const minimumBottomPaddingState = StateField.define<number>({
  create() {
    return 0
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMinimumBottomPaddingEffect)) {
        value = effect.value
      }
    }
    return value
  },
})

// Set scrollTop to counteract changes to the top padding.
// This view plugin is needed because the overflowPaddingState StateField doesn't have access to the view.
const topPaddingPlugin = ViewPlugin.define(view => {
  let previousTop = 0

  return {
    update: update => {
      const { top } = update.state.field(overflowPaddingState)
      if (top !== previousTop) {
        const diff = top - previousTop

        if (diff < 0) {
          // padding is decreasing, scroll now
          view.scrollDOM.scrollTop += diff
        } else {
          // padding is increasing, scroll after it has been applied
          view.requestMeasure({
            key: 'vertical-overflow-scroll-top',
            read() {
              // do nothing
            },
            write(measure, view) {
              view.scrollDOM.scrollTop += diff
            },
          })
        }

        previousTop = top
      }
    },
  }
})

/**
 * When the editor geometry changes, recalculate the amount of padding needed at
 * the end of the doc: (the scrollDOM height - 1 line height).
 * Adapted from the CodeMirror 6 scrollPastEnd extension, licensed under the MIT
 * license:
 * https://github.com/codemirror/view/blob/main/src/scrollpastend.ts
 */
const bottomPaddingPlugin = ViewPlugin.define(view => {
  let previousHeight = 0

  const measure = {
    key: 'vertical-overflow-bottom-padding',
    read(view: EditorView) {
      return view.scrollDOM.clientHeight - view.defaultLineHeight
    },
    write(height: number, view: EditorView) {
      if (height !== previousHeight) {
        // dispatch must be wrapped in a timeout to avoid clashing with the current update
        window.setTimeout(() =>
          view.dispatch({
            effects: setMinimumBottomPaddingEffect.of(height),
          })
        )
        previousHeight = height
      }
    },
  }

  view.requestMeasure(measure)

  return {
    update: update => {
      if (update.geometryChanged) {
        update.view.requestMeasure(measure)
      }
    },
  }
})

const topPaddingFacet = Facet.define<number, number>({
  combine(values) {
    return Math.max(0, ...values)
  },
})
const topPadding = topPaddingFacet.from(overflowPaddingState, state => {
  return state.top
})

const bottomPaddingFacet = Facet.define<number, number>({
  combine(values) {
    return Math.max(0, ...values)
  },
})
const bottomPadding = bottomPaddingFacet.computeN(
  [overflowPaddingState, minimumBottomPaddingState],
  state => {
    return [
      state.field(minimumBottomPaddingState),
      state.field(overflowPaddingState).bottom,
    ]
  }
)

// Set a style attribute on the contentDOM containing the calculated bottom padding.
// This value will be concatenated with style values from any other extensions.
const contentAttributes = EditorView.contentAttributes.compute(
  [bottomPaddingFacet],
  state => {
    const bottom = state.facet(bottomPaddingFacet)
    const style = `padding-bottom: ${bottom}px;`
    return { style }
  }
)

class TopPaddingWidget extends WidgetType {
  constructor(private readonly height: number) {
    super()
    this.height = height
  }

  toDOM(): HTMLElement {
    const element = document.createElement('div')
    element.style.height = this.height + 'px'
    return element
  }

  get estimatedHeight() {
    return this.height
  }

  eq(widget: TopPaddingWidget) {
    return this.height === widget.height
  }

  updateDOM(element: HTMLElement, view: EditorView): boolean {
    element.style.height = this.height + 'px'
    view.requestMeasure()
    return true
  }
}

const topPaddingDecoration = EditorView.decorations.compute(
  [topPaddingFacet],
  state => {
    const top = state.facet(topPaddingFacet)

    return Decoration.set([
      Decoration.widget({
        widget: new TopPaddingWidget(top),
        block: true,
      }).range(0),
    ])
  }
)
