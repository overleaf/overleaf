import {
  Decoration,
  DecorationSet,
  EditorView,
  showTooltip,
  Tooltip,
} from '@codemirror/view'
import {
  EditorState,
  Extension,
  StateField,
  StateEffect,
  Range,
  SelectionRange,
} from '@codemirror/state'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import { v4 as uuid } from 'uuid'

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

export const addComment = (): Extension => {
  if (!isSplitTestEnabled('review-panel-redesign')) {
    return []
  }

  return [addCommentTheme, addCommentStateField]
}

export const addCommentStateField = StateField.define<{
  tooltip: Tooltip | null
  ranges: DecorationSet
}>({
  create() {
    return { tooltip: null, ranges: Decoration.none }
  },

  update(field, tr) {
    let { tooltip, ranges } = field

    ranges = ranges.map(tr.changes)

    for (const effect of tr.effects) {
      if (effect.is(removeNewCommentRangeEffect)) {
        const rangeToRemove = effect.value
        ranges = ranges.update({
          // eslint-disable-next-line no-unused-vars
          filter: (from, to, value) => {
            return value.spec.id !== rangeToRemove.spec.id
          },
        })
      }

      if (effect.is(addNewCommentRangeEffect)) {
        const rangeToAdd = effect.value
        ranges = ranges.update({
          add: [rangeToAdd],
        })
      }
    }

    if (tr.docChanged || tr.selection) {
      tooltip = buildTooltip(tr.state)
    }

    return { tooltip, ranges }
  },

  provide: field => [
    EditorView.decorations.from(field, field => field.ranges),
    showTooltip.compute([field], state => state.field(field).tooltip),
  ],
})

function buildTooltip(state: EditorState): Tooltip | null {
  const range = state.selection.main
  if (range.empty) {
    return null
  }

  return {
    pos: range.assoc < 0 ? range.to : range.from,
    above: true,
    strictSide: true,
    arrow: false,
    create() {
      const dom = document.createElement('div')
      dom.className = 'review-panel-add-comment-tooltip-container'
      return { dom, overlap: true, offset: { x: 0, y: 8 } }
    },
  }
}

/**
 * Styles for the tooltip
 */
const addCommentTheme = EditorView.baseTheme({
  '.review-panel-add-comment-tooltip-container.cm-tooltip': {
    backgroundColor: 'transparent',
    border: 'none',
  },

  '&light': {
    '& .review-panel-add-comment-tooltip': {
      backgroundColor: 'white',
      border: '1px solid #e7e9ee',
      '&:hover': {
        backgroundColor: '#e7e9ee',
      },
    },
  },

  '&dark': {
    '& .review-panel-add-comment-tooltip': {
      backgroundColor: '#1b222c',
      border: '1px solid #2f3a4c',
      '&:hover': {
        backgroundColor: '#2f3a4c',
      },
    },
  },
})
