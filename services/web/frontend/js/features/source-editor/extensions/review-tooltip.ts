import {
  Decoration,
  DecorationSet,
  EditorView,
  showTooltip,
  Tooltip,
  TooltipView,
} from '@codemirror/view'
import {
  Extension,
  StateField,
  StateEffect,
  Range,
  SelectionRange,
  EditorState,
} from '@codemirror/state'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { v4 as uuid } from 'uuid'

export const addNewCommentRangeEffect = StateEffect.define<Range<Decoration>>()

export const removeNewCommentRangeEffect = StateEffect.define<Decoration>()

export const textSelectedEffect = StateEffect.define<null>()

export const removeReviewPanelTooltipEffect = StateEffect.define()

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

  return [
    reviewTooltipTheme,
    reviewTooltipStateField,
    EditorView.updateListener.of(update => {
      if (update.selectionSet && !update.state.selection.main.empty) {
        update.view.dispatch({
          effects: textSelectedEffect.of(null),
        })
      } else if (
        !update.startState.selection.main.empty &&
        update.state.selection.main.empty
      ) {
        update.view.dispatch({
          effects: removeReviewPanelTooltipEffect.of(null),
        })
      }
    }),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        view.dispatch({
          effects: removeReviewPanelTooltipEffect.of(null),
        })
      },
    }),
  ]
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
      if (effect.is(removeReviewPanelTooltipEffect)) {
        return { tooltip: null, addCommentRanges }
      }

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
        tooltip = buildTooltip(tr.state)
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

function buildTooltip(state: EditorState): Tooltip | null {
  if (state.selection.main.empty) {
    return null
  }

  return {
    pos: state.selection.main.head,
    above: true,
    create: createReviewTooltipView,
  }
}

const createReviewTooltipView = (): TooltipView => {
  const dom = document.createElement('div')
  dom.className = 'review-tooltip-menu-container'
  return {
    dom,
    overlap: true,
    offset: { x: 0, y: 8 },
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
