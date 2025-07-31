import {
  MapMode,
  RangeSet,
  RangeValue,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
} from '@codemirror/state'
import {
  EditorView,
  hoverTooltip,
  layer,
  RectangleMarker,
  Tooltip,
} from '@codemirror/view'
import { findValidPosition } from '../utils/position'
import { Highlight } from '../../../../../types/highlight'
import { fullHeightCoordsAtPos, getBase } from '../utils/layer'
import { debugConsole } from '@/utils/debugging'

/**
 * A custom extension that displays collaborator cursors in a separate layer.
 */
export const cursorHighlights = () => {
  return [
    cursorHighlightsState,
    cursorHighlightsLayer,
    cursorHighlightsTheme,
    hoverTooltip(cursorTooltip, {
      hoverTime: 1,
    }),
  ]
}

const cursorHighlightsTheme = EditorView.theme({
  '.ol-cm-cursorHighlightsLayer': {
    zIndex: 100,
    contain: 'size style',
    pointerEvents: 'none',
  },
  '.ol-cm-cursorHighlight': {
    color: 'hsl(var(--hue), 70%, 50%)',
    borderLeft: '2px solid hsl(var(--hue), 70%, 50%)',
    display: 'inline-block',
    height: '1.6em',
    position: 'absolute',
    pointerEvents: 'none',
  },
  '.ol-cm-cursorHighlight:before': {
    content: "''",
    position: 'absolute',
    left: '-2px',
    top: '-5px',
    height: '5px',
    width: '5px',
    borderWidth: '3px 3px 2px 2px',
    borderStyle: 'solid',
    borderColor: 'inherit',
  },
  '.ol-cm-cursorHighlightLabel': {
    lineHeight: 1,
    backgroundColor: 'hsl(var(--hue), 70%, 50%)',
    padding: '1em 1em',
    fontSize: '0.8rem',
    fontFamily: 'Lato, sans-serif',
    color: 'white',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
  },
})

class HighlightRangeValue extends RangeValue {
  mapMode = MapMode.Simple

  constructor(public highlight: Highlight) {
    super()
  }

  eq(other: HighlightRangeValue) {
    return other.highlight === this.highlight
  }
}

const cursorHighlightsState = StateField.define<RangeSet<HighlightRangeValue>>({
  create() {
    return RangeSet.empty
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCursorHighlightsEffect)) {
        const highlightRanges = []

        for (const highlight of effect.value) {
          // NOTE: other highlight types could be handled here
          if ('cursor' in highlight) {
            try {
              const { row, column } = highlight.cursor
              const pos = findValidPosition(tr.state.doc, row + 1, column)
              highlightRanges.push(
                new HighlightRangeValue(highlight).range(pos)
              )
            } catch (error) {
              // ignore invalid highlights
              debugConsole.debug('invalid highlight position', error)
            }
          }
        }

        return RangeSet.of(highlightRanges, true)
      }
    }

    if (tr.docChanged && !tr.annotation(Transaction.remote)) {
      value = value.map(tr.changes)
    }

    return value
  },
})

const cursorTooltip = (view: EditorView, pos: number): Tooltip | null => {
  const highlights: Highlight[] = []

  view.state
    .field(cursorHighlightsState)
    .between(pos, pos, (from, to, value) => {
      highlights.push(value.highlight)
    })

  if (highlights.length === 0) {
    return null
  }

  return {
    pos,
    end: pos,
    above: true,
    create: () => {
      const dom = document.createElement('div')
      dom.classList.add('ol-cm-cursorTooltip')

      for (const highlight of highlights) {
        const label = document.createElement('div')
        label.classList.add('ol-cm-cursorHighlightLabel')
        label.style.setProperty('--hue', String(highlight.hue))
        label.textContent = highlight.label
        dom.appendChild(label)
      }

      return { dom }
    },
  }
}

const setCursorHighlightsEffect = StateEffect.define<Highlight[]>()

export const setCursorHighlights = (
  cursorHighlights: Highlight[] = []
): TransactionSpec => {
  return {
    effects: setCursorHighlightsEffect.of(cursorHighlights),
  }
}

class CursorMarker extends RectangleMarker {
  constructor(
    public highlight: Highlight,
    className: string,
    left: number,
    top: number,
    width: number | null,
    height: number
  ) {
    super(className, left, top, width, height)
  }

  draw(): HTMLDivElement {
    const element = super.draw()
    element.style.setProperty('--hue', String(this.highlight.hue))
    return element
  }

  update(element: HTMLDivElement, prev: CursorMarker) {
    if (!super.update(element, prev)) {
      return false
    }
    element.style.setProperty('--hue', String(this.highlight.hue))
    return true
  }

  eq(other: CursorMarker) {
    return super.eq(other) && this.highlight.hue === other.highlight.hue
  }
}

// draw the collaborator cursors in a separate layer, so they don't affect word wrapping
const cursorHighlightsLayer = layer({
  above: true,
  class: 'ol-cm-cursorHighlightsLayer',
  update: update => {
    return (
      update.docChanged ||
      update.selectionSet ||
      update.transactions.some(tr =>
        tr.effects.some(effect => effect.is(setCursorHighlightsEffect))
      )
    )
  },
  markers(view) {
    const markers: CursorMarker[] = []
    const highlightRanges = view.state.field(cursorHighlightsState)
    const base = getBase(view)
    const { from, to } = view.viewport
    highlightRanges.between(from, to, (from, to, { highlight }) => {
      const pos = fullHeightCoordsAtPos(view, from)
      if (pos) {
        markers.push(
          new CursorMarker(
            highlight,
            'ol-cm-cursorHighlight',
            pos.left - base.left,
            pos.top - base.top,
            null,
            pos.bottom - pos.top
          )
        )
      }
    })
    return markers
  },
})
