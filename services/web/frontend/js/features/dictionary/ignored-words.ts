import getMeta from '../../utils/meta'
import { IGNORED_MISSPELLINGS } from '../../ide/editor/directives/aceEditor/spell-check/IgnoredMisspellings'

export class IgnoredWords {
  public learnedWords!: Set<string>
  private ignoredMisspellings: Set<string>

  constructor() {
    this.reset()
    this.ignoredMisspellings = new Set(IGNORED_MISSPELLINGS)
    window.addEventListener('learnedWords:doreset', () => this.reset()) // for tests
  }

  reset() {
    this.learnedWords = new Set(getMeta('ol-learnedWords'))
    window.dispatchEvent(new CustomEvent('learnedWords:reset'))
  }

  add(wordText: string) {
    this.learnedWords.add(wordText)
    window.dispatchEvent(
      new CustomEvent('learnedWords:add', { detail: wordText })
    )
  }

  remove(wordText: string) {
    this.learnedWords.delete(wordText)
    window.dispatchEvent(
      new CustomEvent('learnedWords:remove', { detail: wordText })
    )
  }

  has(wordText: string) {
    return (
      this.ignoredMisspellings.has(wordText) || this.learnedWords.has(wordText)
    )
  }
}

export default new IgnoredWords()
