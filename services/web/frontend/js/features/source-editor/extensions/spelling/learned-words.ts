import { StateEffect } from '@codemirror/state'
import getMeta from '@/utils/meta'

export const addLearnedWordEffect = StateEffect.define<string>()

export const removeLearnedWordEffect = StateEffect.define<string>()

export const learnedWords = {
  global: new Set(getMeta('ol-learnedWords')),
}

export const addLearnedWord = (text: string) => {
  learnedWords.global.add(text)
  return {
    effects: addLearnedWordEffect.of(text),
  }
}

export const removeLearnedWord = (text: string) => {
  learnedWords.global.delete(text)
  return {
    effects: removeLearnedWordEffect.of(text),
  }
}
