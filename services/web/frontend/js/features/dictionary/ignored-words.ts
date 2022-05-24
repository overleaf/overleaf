import getMeta from '../../utils/meta'
import { IGNORED_MISSPELLINGS } from '../../ide/editor/directives/aceEditor/spell-check/IgnoredMisspellings'

export class IgnoredWords {
  public learnedWords: Set<string>
  private ignoredMisspellings: Set<string>

  constructor() {
    this.reset()
    this.ignoredMisspellings = new Set(IGNORED_MISSPELLINGS)
  }

  reset() {
    this.learnedWords = new Set(getMeta('ol-learnedWords'))
  }

  add(wordText) {
    this.learnedWords.add(wordText)
    window.dispatchEvent(
      new CustomEvent('learnedWords:add', { detail: wordText })
    )
  }

  has(wordText) {
    return (
      this.ignoredMisspellings.has(wordText) || this.learnedWords.has(wordText)
    )
  }
}

export default new IgnoredWords()
