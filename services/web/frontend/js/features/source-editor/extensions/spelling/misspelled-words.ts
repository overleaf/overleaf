import { StateField, StateEffect, Transaction } from '@codemirror/state'
import { EditorView, Decoration, DecorationSet } from '@codemirror/view'
import { updateAfterAddingIgnoredWord } from './ignored-words'
import _ from 'lodash'
import { Word } from './spellchecker'

export const addMisspelledWords = StateEffect.define<Word[]>()

export const resetMisspelledWords = StateEffect.define()

const createMark = (word: Word) => {
  const mark = Decoration.mark({
    class: 'ol-cm-spelling-error',
    word,
  })
  return mark.range(word.from, word.to)
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
    marks = marks.map(transaction.changes)
    marks = removeMarksUnderEdit(marks, transaction)
    for (const effect of transaction.effects) {
      if (effect.is(addMisspelledWords)) {
        // We're setting a new list of misspelled words
        const misspelledWords = effect.value
        marks = mergeMarks(marks, misspelledWords)
      } else if (effect.is(updateAfterAddingIgnoredWord)) {
        // Remove a misspelled word, all instances that match text
        const word = effect.value
        marks = removeAllMarksMatchingWordText(marks, word)
      } else if (effect.is(resetMisspelledWords)) {
        marks = Decoration.none
      }
    }
    return marks
  },
  provide: field => {
    return EditorView.decorations.from(field)
  },
})

/*
 * Remove any marks whos text has just been edited
 */
const removeMarksUnderEdit = (
  marks: DecorationSet,
  transaction: Transaction
) => {
  transaction.changes.iterChanges((fromA, toA, fromB, toB) => {
    marks = marks.update({
      // Filter out marks that overlap the change span
      filter: (from, to, mark) => {
        const changeStartWithinMark = from <= fromB && to >= fromB
        const changeEndWithinMark = from <= toB && to >= toB
        const markHasBeenEdited = changeStartWithinMark || changeEndWithinMark
        return !markHasBeenEdited
      },
    })
  })
  return marks
}

/*
 * Given the set of marks, and a list of new misspelled-words,
 * merge these together into a new set of marks
 */
const mergeMarks = (marks: DecorationSet, words: Word[]) => {
  const affectedLines = new Set(words.map(w => w.lineNumber))
  marks = marks
    .update({
      filter: (from, to, mark) => {
        return !affectedLines.has(mark.spec.word.lineNumber)
      },
    })
    .update({
      add: _.sortBy(words, ['from']).map(w => createMark(w)),
      sort: true,
    })
  return marks
}

/*
 * Remove existing marks matching the text of a supplied word
 */
const removeAllMarksMatchingWordText = (marks: DecorationSet, word: string) => {
  return marks.update({
    filter: (from, to, mark) => {
      return mark.spec.word.text !== word
    },
  })
}
