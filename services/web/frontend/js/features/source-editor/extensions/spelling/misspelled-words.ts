import { StateField, StateEffect } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { updateAfterAddingIgnoredWord } from './ignored-words'
import { Word } from './spellchecker'
import { setSpellCheckLanguageEffect } from '@/features/source-editor/extensions/spelling/index'

export const addMisspelledWords = StateEffect.define<Word[]>()

const createMark = (word: Word) => {
  return Decoration.mark({
    class: 'ol-cm-spelling-error',
    word,
  }).range(word.from, word.to)
}

/*
 * State for misspelled words, the results of a
 * spellcheck request. Misspelled words are marked
 * with a red wavy underline.
 */
export const misspelledWordsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(marks, transaction) {
    if (transaction.docChanged) {
      // Remove any marks whose text has just been edited
      marks = marks.update({
        filter(from, to) {
          return !transaction.changes.touchesRange(from, to)
        },
      })
    }

    marks = marks.map(transaction.changes)

    for (const effect of transaction.effects) {
      if (effect.is(addMisspelledWords)) {
        // Merge the new misspelled words into the existing set of marks
        marks = marks.update({
          add: effect.value.map(word => createMark(word)), // TODO: make sure these positions are still accurate
          sort: true,
        })
      } else if (effect.is(updateAfterAddingIgnoredWord)) {
        // Remove existing marks matching the text of a supplied word
        marks = marks.update({
          filter(_from, _to, mark) {
            return mark.spec.word.text !== effect.value
          },
        })
      } else if (effect.is(setSpellCheckLanguageEffect)) {
        marks = Decoration.none
      }
    }
    return marks
  },
  provide: field => {
    return EditorView.decorations.from(field)
  },
})
