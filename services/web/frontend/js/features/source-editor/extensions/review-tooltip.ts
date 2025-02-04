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
  Transaction,
} from '@codemirror/state'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { v4 as uuid } from 'uuid'

export const addNewCommentRangeEffect = StateEffect.define<Range<Decoration>>()

export const removeNewCommentRangeEffect = StateEffect.define<string>()

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
        const threadId = effect.value
        addCommentRanges = addCommentRanges.update({
          filter: (_from, _to, value) => {
            return value.spec.id !== threadId
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

    if (tr.state.selection.main.empty) {
      return { tooltip: null, addCommentRanges }
    }

    if (
      !tr.effects.some(effect => effect.is(mouseUpEffect)) &&
      tr.annotation(Transaction.userEvent) !== 'select' &&
      tr.annotation(Transaction.userEvent) !== 'select.pointer'
    ) {
      if (tr.selection) {
        // selection was changed, remove the tooltip
        return { tooltip: null, addCommentRanges }
      }
      // for any other update, we keep the tooltip because it could be created in previous transaction
      // and we are still waiting for "mouse up" event to show it
      return { tooltip, addCommentRanges }
    }

    const isMouseDown = tr.state.field(mouseDownStateField)
    // if "isMouseDown" is true, tooltip will be created but still hidden
    // the reason why we cant just create the tooltip on mouse up is because transaction.userEvent is empty at that point

    return { tooltip: buildTooltip(tr.state, isMouseDown), addCommentRanges }
  },

  provide: field => [
    EditorView.decorations.from(field, field => field.addCommentRanges),
    showTooltip.compute([field], state => state.field(field).tooltip),
  ],
})

function buildTooltip(state: EditorState, hidden: boolean): Tooltip | null {
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
    create: hidden
      ? createHiddenReviewTooltipView
      : createVisibleReviewTooltipView,
  }
}

const createReviewTooltipView = (hidden: boolean): TooltipView => {
  const dom = document.createElement('div')
  dom.className = 'review-tooltip-menu-container'
  dom.style.display = hidden ? 'none' : 'block'
  return {
    dom,
    overlap: true,
    offset: { x: 0, y: 8 },
  }
}
const createHiddenReviewTooltipView = () => createReviewTooltipView(true)
const createVisibleReviewTooltipView = () => createReviewTooltipView(false)

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
