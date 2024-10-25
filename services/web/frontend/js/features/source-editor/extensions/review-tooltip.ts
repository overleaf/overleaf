import {
  Decoration,
  DecorationSet,
  EditorView,
  showTooltip,
  Tooltip,
} from '@codemirror/view'
import {
  Extension,
  StateField,
  StateEffect,
  Range,
  SelectionRange,
} from '@codemirror/state'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { v4 as uuid } from 'uuid'
import { textSelected, textSelectedEffect } from './text-selected'
import { isCursorNearViewportTop } from '../utils/is-cursor-near-edge'

export const addNewCommentRangeEffect = StateEffect.define<Range<Decoration>>()

export const removeNewCommentRangeEffect = StateEffect.define<Decoration>()

export const buildAddNewCommentRangeEffect = (range: SelectionRange) => {
  return addNewCommentRangeEffect.of(
    Decoration.mark({
      tagName: 'span',
      class: `ol-cm-change ol-cm-change-c`,
      opType: 'c',
      id: uuid(),
    }).range(range.from, range.to)
  )
}

export const reviewTooltip = (): Extension => {
  if (!isSplitTestEnabled('review-panel-redesign')) {
    return []
  }

  return [reviewTooltipTheme, reviewTooltipStateField, textSelected]
}

export const reviewTooltipStateField = StateField.define<{
  tooltip: Tooltip | null
  addCommentRanges: DecorationSet
}>({
  create() {
    return { tooltip: null, addCommentRanges: Decoration.none }
  },

  update(field, tr) {
    let { tooltip, addCommentRanges } = field

    addCommentRanges = addCommentRanges.map(tr.changes)

    for (const effect of tr.effects) {
      if (effect.is(removeNewCommentRangeEffect)) {
        const rangeToRemove = effect.value
        addCommentRanges = addCommentRanges.update({
          // eslint-disable-next-line no-unused-vars
          filter: (from, to, value) => {
            return value.spec.id !== rangeToRemove.spec.id
          },
        })
      }

      if (effect.is(addNewCommentRangeEffect)) {
        const rangeToAdd = effect.value
        addCommentRanges = addCommentRanges.update({
          add: [rangeToAdd],
        })
      }

      if (effect.is(textSelectedEffect)) {
        tooltip = buildTooltip(effect.value)
      }

      if (tooltip && tr.state.selection.main.empty) {
        tooltip = null
      }
    }

    return { tooltip, addCommentRanges }
  },

  provide: field => [
    EditorView.decorations.from(field, field => field.addCommentRanges),
    showTooltip.compute([field], state => state.field(field).tooltip),
  ],
})

function buildTooltip(view: EditorView): Tooltip | null {
  if (view.state.selection.main.empty) {
    return null
  }

  const pos = view.state.selection.main.head
  return {
    pos,
    above: !isCursorNearViewportTop(view, pos, 50),
    strictSide: true,
    arrow: false,
    create() {
      const dom = document.createElement('div')
      dom.className = 'review-tooltip-menu-container'
      return { dom, overlap: true, offset: { x: 0, y: 8 } }
    },
  }
}

/**
 * Styles for the tooltip
 */
const reviewTooltipTheme = EditorView.baseTheme({
  '.review-tooltip-menu-container.cm-tooltip': {
    backgroundColor: 'transparent',
    border: 'none',
    zIndex: 0,
  },

  '&light': {
    '& .review-tooltip-menu': {
      backgroundColor: 'white',
    },
    '& .review-tooltip-menu-button': {
      '&:hover': {
        backgroundColor: '#2f3a4c14',
      },
    },
  },

  '&dark': {
    '& .review-tooltip-menu': {
      backgroundColor: '#1b222c',
    },
    '& .review-tooltip-menu-button': {
      '&:hover': {
        backgroundColor: '#2f3a4c',
      },
    },
  },
})
