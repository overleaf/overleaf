import {
  EditorState,
  Line,
  Range,
  RangeSet,
  StateEffect,
  StateField,
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
  showTooltip,
  Tooltip,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { Highlight, HighlightType } from '../services/types/doc'

export const setHighlightsEffect = StateEffect.define<Highlight[]>()
const ADDITION_MARKER_CLASS = 'ol-cm-addition-marker'
const DELETION_MARKER_CLASS = 'ol-cm-deletion-marker'

function highlightToMarker(highlight: Highlight) {
  const className =
    highlight.type === 'addition'
      ? ADDITION_MARKER_CLASS
      : DELETION_MARKER_CLASS
  const { from, to } = highlight.range

  return Decoration.mark({
    class: className,
    attributes: {
      style: `--hue: ${highlight.hue}`,
    },
  }).range(from, to)
}

type LineStatus = {
  line: Line
  highlights: Highlight[]
  empty: boolean
  changeType: HighlightType | 'mixed'
}

type LineStatuses = Map<number, LineStatus>

function highlightedLines(highlights: Highlight[], state: EditorState) {
  const lineStatuses = new Map<number, LineStatus>()
  for (const highlight of highlights) {
    const fromLine = state.doc.lineAt(highlight.range.from).number
    const toLine = state.doc.lineAt(highlight.range.to).number
    for (let lineNum = fromLine; lineNum <= toLine; ++lineNum) {
      const status = lineStatuses.get(lineNum)
      if (status) {
        status.highlights.push(highlight)
        if (status.changeType !== highlight.type) {
          status.changeType = 'mixed'
        }
      } else {
        const line = state.doc.line(lineNum)
        lineStatuses.set(lineNum, {
          line,
          highlights: [highlight],
          empty: line.length === 0,
          changeType: highlight.type,
        })
      }
    }
  }
  return lineStatuses
}

const theme = EditorView.baseTheme({
  ['.' + ADDITION_MARKER_CLASS]: {
    paddingTop: 'var(--half-leading)',
    paddingBottom: 'var(--half-leading)',
    backgroundColor: 'hsl(var(--hue), 70%, 85%)',
  },
  ['.' + DELETION_MARKER_CLASS]: {
    textDecoration: 'line-through',
    color: 'hsl(var(--hue), 70%, 40%)',
  },
  '.cm-tooltip': {
    backgroundColor: 'transparent',
    borderWidth: 0,
    // Prevent a tooltip getting in the way of hovering over a line that it
    // obscures
    pointerEvents: 'none',
  },
  '.ol-cm-highlight-tooltip': {
    backgroundColor: 'hsl(var(--hue), 70%, 50%)',
    borderRadius: '4px',
    padding: '4px',
    color: '#fff',
  },
  '.ol-cm-empty-line-addition-marker': {
    padding: 'var(--half-leading) 2px',
  },
})

function createHighlightTooltip(pos: number, highlight: Highlight) {
  return {
    pos,
    above: true,
    create: () => {
      const dom = document.createElement('div')
      dom.classList.add('ol-cm-highlight-tooltip')
      dom.style.setProperty('--hue', highlight.hue.toString())
      dom.textContent = highlight.label

      return { dom }
    },
  }
}

const setHighlightTooltipEffect = StateEffect.define<Tooltip | null>()

const tooltipField = StateField.define<Tooltip | null>({
  create() {
    return null
  },

  update(tooltip, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setHighlightTooltipEffect)) {
        return effect.value
      }
    }
    return tooltip
  },

  provide: field => showTooltip.from(field),
})

function highlightAtPos(state: EditorState, pos: number) {
  const highlights = state.field(highlightDecorationsField).highlights
  return highlights.find(highlight => {
    const { from, to } = highlight.range
    return pos >= from && pos <= to
  })
}

const highlightTooltipPlugin = ViewPlugin.fromClass(
  class {
    private lastTooltipPos: number | null = null

    // eslint-disable-next-line no-useless-constructor
    constructor(readonly view: EditorView) {}

    setHighlightTooltip(tooltip: Tooltip | null) {
      this.view.dispatch({
        effects: setHighlightTooltipEffect.of(tooltip),
      })
    }

    setTooltipFromEvent(event: MouseEvent) {
      const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos !== this.lastTooltipPos) {
        let tooltip = null
        if (pos !== null) {
          const highlight = highlightAtPos(this.view.state, pos)
          if (highlight) {
            tooltip = createHighlightTooltip(pos, highlight)
          }
        }
        this.setHighlightTooltip(tooltip)
        this.lastTooltipPos = pos
      }
    }

    handleMouseMove(event: MouseEvent) {
      this.setTooltipFromEvent(event)
    }

    startHover(event: MouseEvent, el: HTMLElement) {
      const handleMouseMove = this.handleMouseMove.bind(this)
      this.view.contentDOM.addEventListener('mousemove', handleMouseMove)

      const handleMouseLeave = () => {
        this.setHighlightTooltip(null)
        this.lastTooltipPos = null
        this.view.contentDOM.removeEventListener('mousemove', handleMouseMove)
        el.removeEventListener('mouseleave', handleMouseLeave)
      }

      el.addEventListener('mouseleave', handleMouseLeave)
      this.setTooltipFromEvent(event)
    }
  },
  {
    eventHandlers: {
      mouseover(event) {
        const el = event.target as HTMLElement
        const classList = el.classList
        if (
          classList.contains(ADDITION_MARKER_CLASS) ||
          classList.contains(DELETION_MARKER_CLASS) ||
          // An empty line widget doesn't trigger a mouseover event, so detect
          // an event on a line element that contains one instead
          (classList.contains('cm-line') &&
            el.querySelector(
              `.ol-cm-empty-line-addition-marker, .ol-cm-empty-line-deletion-marker`
            ))
        ) {
          this.startHover(event, el)
        }
      },
    },
    provide() {
      return tooltipField
    },
  }
)

class EmptyLineAdditionMarkerWidget extends WidgetType {
  constructor(readonly hue: number) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement('span')
    element.classList.add(
      'ol-cm-empty-line-addition-marker',
      ADDITION_MARKER_CLASS
    )
    element.style.setProperty('--hue', this.hue.toString())

    return element
  }
}

class EmptyLineDeletionMarkerWidget extends WidgetType {
  constructor(readonly hue: number) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement('span')
    element.classList.add(
      'ol-cm-empty-line-deletion-marker',
      DELETION_MARKER_CLASS
    )
    element.style.setProperty('--hue', this.hue.toString())
    element.textContent = ' '

    return element
  }
}

function createMarkers(highlights: Highlight[]) {
  return RangeSet.of(highlights.map(highlight => highlightToMarker(highlight)))
}

function createEmptyLineHighlightMarkers(lineStatuses: LineStatuses) {
  const markers: Range<Decoration>[] = []
  for (const lineStatus of lineStatuses.values()) {
    if (lineStatus.line.length === 0) {
      const highlight = lineStatus.highlights[0]
      const widget =
        highlight.type === 'addition'
          ? new EmptyLineAdditionMarkerWidget(highlight.hue)
          : new EmptyLineDeletionMarkerWidget(highlight.hue)

      markers.push(
        Decoration.widget({
          widget,
        }).range(lineStatus.line.from)
      )
    }
  }
  return RangeSet.of(markers)
}

type HighlightDecorations = {
  highlights: Highlight[]
  highlightMarkers: DecorationSet
  emptyLineHighlightMarkers: DecorationSet
}

export const highlightDecorationsField =
  StateField.define<HighlightDecorations>({
    create() {
      return {
        highlights: [],
        highlightMarkers: Decoration.none,
        emptyLineHighlightMarkers: Decoration.none,
      }
    },
    update(highlightMarkers, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setHighlightsEffect)) {
          const highlights = effect.value
          const lineStatuses = highlightedLines(highlights, tr.state)
          const highlightMarkers = createMarkers(highlights)
          const emptyLineHighlightMarkers =
            createEmptyLineHighlightMarkers(lineStatuses)
          return {
            highlights,
            highlightMarkers,
            emptyLineHighlightMarkers,
          }
        }
      }
      return highlightMarkers
    },
    provide: field => [
      EditorView.decorations.from(field, value => value.highlightMarkers),
      EditorView.decorations.from(
        field,
        value => value.emptyLineHighlightMarkers
      ),
      theme,
      highlightTooltipPlugin,
    ],
  })

export function highlights() {
  return highlightDecorationsField
}
