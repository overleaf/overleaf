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
  hoverTooltip,
  Tooltip,
  WidgetType,
} from '@codemirror/view'
import { Highlight, HighlightType } from '../services/types/doc'

export const setHighlightsEffect = StateEffect.define<Highlight[]>()

function highlightToMarker(highlight: Highlight) {
  const className =
    highlight.type === 'addition'
      ? 'ol-cm-addition-marker'
      : 'ol-cm-deletion-marker'
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
  '.ol-cm-addition-marker': {
    paddingTop: 'var(--half-leading)',
    paddingBottom: 'var(--half-leading)',
    backgroundColor: 'hsl(var(--hue), 70%, 85%)',
  },
  '.ol-deletion-marker': {
    textDecoration: 'line-through',
  },
  '&.overall-theme-dark .ol-deletion-marker': {
    color: 'hsl(var(--hue), 100%, 60%)',
  },
  '&.overall-theme-light .ol-deletion-marker': {
    color: 'hsl(var(--hue), 70%, 40%)',
  },
  '.cm-tooltip-hover': {
    backgroundColor: 'transparent',
    borderWidth: 0,
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

const tooltip = (view: EditorView, pos: number, side: any): Tooltip | null => {
  const highlights = view.state.field(highlightDecorationsField).highlights
  const highlight = highlights.find(highlight => {
    const { from, to } = highlight.range
    return !(
      pos < from ||
      pos > to ||
      (pos === from && side < 0) ||
      (pos === to && side > 0)
    )
  })

  if (!highlight) {
    return null
  }

  return {
    pos: highlight.range.from,
    end: highlight.range.to,
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

class EmptyLineAdditionMarkerWidget extends WidgetType {
  constructor(readonly hue: number) {
    super()
  }

  toDOM(view: EditorView): HTMLElement {
    const element = document.createElement('span')
    element.className = 'ol-cm-empty-line-addition-marker ol-cm-addition-marker'
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
    element.className = 'ol-cm-empty-line-deletion-marker ol-deletion-marker'
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

      // In order to make the hover tooltip appear for every empty line,
      // position the widget after the position if this is the first empty line
      // in a group or before it otherwise. Always using a value of 1 would
      // mean that the last empty line in a group of more than one would not
      // trigger the hover tooltip.
      const side =
        lineStatuses.get(lineStatus.line.number - 1)?.highlights[0]?.type ===
        highlight.type
          ? -1
          : 1

      markers.push(
        Decoration.widget({
          widget,
          side,
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
      hoverTooltip(tooltip, { hoverTime: 0 }),
    ],
  })

export function highlights() {
  return highlightDecorationsField
}
