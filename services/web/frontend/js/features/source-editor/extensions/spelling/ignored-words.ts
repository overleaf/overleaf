import { StateField, StateEffect } from '@codemirror/state'
import ignoredWords, { IgnoredWords } from '../../../dictionary/ignored-words'

export const ignoredWordsField = StateField.define<IgnoredWords>({
  create() {
    return ignoredWords
  },
  update(ignoredWords, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(addIgnoredWord)) {
        const newWord = effect.value
        ignoredWords.add(newWord.text)
      }
    }
    return ignoredWords
  },
})

export const addIgnoredWord = StateEffect.define<{
  text: string
}>()

export const updateAfterAddingIgnoredWord = StateEffect.define<string>()

export const resetSpellChecker = StateEffect.define()
