import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, hoverTooltip, Tooltip } from '@codemirror/view'
import { Highlight } from '../services/types/doc'

export const setHighlightsEffect = StateEffect.define<Highlight[]>()

function highlightToMarker(highlight: Highlight) {
  const className =
    highlight.type === 'addition' ? 'ol-addition-marker' : 'ol-deletion-marker'
  const { from, to } = highlight.range

  return Decoration.mark({
    class: className,
    attributes: {
      style: `--hue: ${highlight.hue}`,
    },
  }).range(from, to)
}

const theme = EditorView.baseTheme({
  '.ol-addition-marker': {
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
})

const tooltip = (view: EditorView, pos: number, side: any): Tooltip | null => {
  const highlights = view.state.field(highlightsField)
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

export const highlightsField = StateField.define<Highlight[]>({
  create() {
    return []
  },
  update(highlightMarkers, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightsEffect)) {
        return effect.value
      }
    }
    return highlightMarkers
  },
  provide: field => [
    EditorView.decorations.from(field, highlights =>
      Decoration.set(highlights.map(highlight => highlightToMarker(highlight)))
    ),
    theme,
    hoverTooltip(tooltip, { hoverTime: 0 }),
  ],
})

export function highlights() {
  return highlightsField
}
