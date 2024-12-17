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

const mouseDownEffect = StateEffect.define()
const mouseUpEffect = StateEffect.define()
const mouseDownStateField = StateField.define<boolean>({
  create() {
    return false
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(mouseDownEffect)) {
        return true
      } else if (effect.is(mouseUpEffect)) {
        return false
      }
    }

    return value
  },
})

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

  let mouseUpListener: null | (() => void) = null
  const disableMouseUpListener = () => {
    if (mouseUpListener) {
      document.removeEventListener('mouseup', mouseUpListener)
    }
  }

  return [
    reviewTooltipTheme,
    reviewTooltipStateField,
    mouseDownStateField,
    EditorView.domEventHandlers({
      mousedown: (event, view) => {
        disableMouseUpListener()
        mouseUpListener = () => {
          disableMouseUpListener()
          view.dispatch({ effects: mouseUpEffect.of(null) })
        }

        view.dispatch({
          effects: mouseDownEffect.of(null),
        })
        document.addEventListener('mouseup', mouseUpListener)
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
    }

    const isMouseDown = tr.state.field(mouseDownStateField)
    if (!isMouseDown && !tr.state.selection.main.empty) {
      tooltip = buildTooltip(tr.state)
    } else if (tooltip && tr.state.selection.main.empty) {
      tooltip = null
    }

    return { tooltip, addCommentRanges }
  },

  provide: field => [
    EditorView.decorations.from(field, field => field.addCommentRanges),
    showTooltip.compute([field], state => state.field(field).tooltip),
  ],
})

function buildTooltip(state: EditorState): Tooltip | null {
  const lineAtFrom = state.doc.lineAt(state.selection.main.from)
  const lineAtTo = state.doc.lineAt(state.selection.main.to)
  const multiLineSelection = lineAtFrom.number !== lineAtTo.number
  const column = state.selection.main.head - lineAtTo.from

  // If the selection is a multi-line selection and the cursor is at the beginning of the next line
  // we want to show the tooltip at the end of the previous line
  const pos =
    multiLineSelection && column === 0
      ? state.selection.main.head - 1
      : state.selection.main.head

  return {
    pos,
    above: state.selection.main.head !== state.selection.main.to,
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
