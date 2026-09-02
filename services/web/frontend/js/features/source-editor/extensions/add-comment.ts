import { Decoration, DecorationSet, EditorView } from '@codemirror/view'
import {
  StateField,
  StateEffect,
  Range,
  SelectionRange,
} from '@codemirror/state'
import { v4 as uuid } from 'uuid'

export const addNewCommentRangeEffect = StateEffect.define<Range<Decoration>>()

export const removeNewCommentRangeEffect = StateEffect.define<string>()

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

export const addCommentRangesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },

  update(addCommentRanges, tr) {
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

    return addCommentRanges
  },

  provide: field => EditorView.decorations.from(field),
})
