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
  gutter,
  gutterLineClass,
  GutterMarker,
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

const tooltipTheme = EditorView.theme({
  '.cm-tooltip': {
    backgroundColor: 'transparent',
    borderWidth: 0,
    // Prevent a tooltip getting in the way of hovering over a line that it
    // obscures
    pointerEvents: 'none',
  },
})

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
  '.cm-tooltip.ol-cm-highlight-tooltip': {
    backgroundColor: 'hsl(var(--hue), 70%, 50%)',
    borderRadius: '4px',
    padding: '4px',
    color: '#fff',
  },
  '.ol-cm-empty-line-addition-marker': {
    padding: 'var(--half-leading) 2px',
  },
  '.ol-cm-changed-line': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  '.ol-cm-change-gutter': {
    width: '3px',
    paddingLeft: '1px',
  },
  '.ol-cm-changed-line-gutter': {
    backgroundColor: 'hsl(var(--hue), 70%, 40%)',
    height: '100%',
  },
  '.ol-cm-highlighted-line-gutter': {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
})

function createHighlightTooltip(pos: number, highlight: Highlight) {
  return {
    pos,
    above: true,
    create: () => {
      const dom = document.createElement('div')
      dom.classList.add('ol-cm-highlight-tooltip')
      dom.style.setProperty('--hue', String(highlight.hue))
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

  toDOM(): HTMLElement {
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

  toDOM(): HTMLElement {
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

class ChangeGutterMarker extends GutterMarker {
  constructor(readonly hue: number) {
    super()
  }

  toDOM() {
    const el = document.createElement('div')
    el.className = 'ol-cm-changed-line-gutter'
    el.style.setProperty('--hue', this.hue.toString())

    return el
  }
}

function createGutterMarkers(lineStatuses: LineStatuses) {
  const gutterMarkers: Range<GutterMarker>[] = []
  for (const lineStatus of lineStatuses.values()) {
    gutterMarkers.push(
      new ChangeGutterMarker(lineStatus.highlights[0].hue).range(
        lineStatus.line.from
      )
    )
  }
  return RangeSet.of(gutterMarkers)
}

const lineHighlight = Decoration.line({ class: 'ol-cm-changed-line' })

function createLineHighlights(lineStatuses: LineStatuses) {
  const lineHighlights: Range<Decoration>[] = []
  for (const lineStatus of lineStatuses.values()) {
    lineHighlights.push(lineHighlight.range(lineStatus.line.from))
  }
  return RangeSet.of(lineHighlights)
}

const changeLineGutterMarker = new (class extends GutterMarker {
  elementClass = 'ol-cm-highlighted-line-gutter'
})()

function createGutterHighlights(lineStatuses: LineStatuses) {
  const gutterMarkers: Range<GutterMarker>[] = []
  for (const lineStatus of lineStatuses.values()) {
    gutterMarkers.push(changeLineGutterMarker.range(lineStatus.line.from))
  }
  return RangeSet.of(gutterMarkers, true)
}

type HighlightDecorations = {
  highlights: Highlight[]
  highlightMarkers: DecorationSet
  emptyLineHighlightMarkers: DecorationSet
  lineHighlights: DecorationSet
  gutterMarkers: RangeSet<GutterMarker>
  gutterHighlights: RangeSet<GutterMarker>
}

export const highlightDecorationsField =
  StateField.define<HighlightDecorations>({
    create() {
      return {
        highlights: [],
        highlightMarkers: Decoration.none,
        emptyLineHighlightMarkers: Decoration.none,
        lineHighlights: Decoration.none,
        gutterMarkers: RangeSet.empty,
        gutterHighlights: RangeSet.empty,
      }
    },
    update(highlightDecorations, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setHighlightsEffect)) {
          const highlights = effect.value
          const lineStatuses = highlightedLines(highlights, tr.state)
          const highlightMarkers = createMarkers(highlights)
          const emptyLineHighlightMarkers =
            createEmptyLineHighlightMarkers(lineStatuses)
          const lineHighlights = createLineHighlights(lineStatuses)
          const gutterMarkers = createGutterMarkers(lineStatuses)
          const gutterHighlights = createGutterHighlights(lineStatuses)
          return {
            highlights,
            highlightMarkers,
            emptyLineHighlightMarkers,
            lineHighlights,
            gutterMarkers,
            gutterHighlights,
          }
        }
      }
      return highlightDecorations
    },
    provide: field => [
      EditorView.decorations.from(field, value => value.highlightMarkers),
      EditorView.decorations.from(
        field,
        value => value.emptyLineHighlightMarkers
      ),
      EditorView.decorations.from(field, value => value.lineHighlights),
      theme,
      tooltipTheme,
      highlightTooltipPlugin,
    ],
  })

const changeGutter = gutter({
  class: 'ol-cm-change-gutter',
  markers: view => view.state.field(highlightDecorationsField).gutterMarkers,
  renderEmptyElements: false,
})

const gutterHighlighter = gutterLineClass.from(
  highlightDecorationsField,
  value => value.gutterHighlights
)

export function highlights() {
  return [highlightDecorationsField, changeGutter, gutterHighlighter]
}
