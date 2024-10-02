import getMeta from '../../utils/meta'

export const globalLearnedWords = new Set([
  'Overleaf',
  'overleaf',
  'ShareLaTeX',
  'sharelatex',
  'LaTeX',
  'TeX',
  'BibTeX',
  'BibLaTeX',
  'XeTeX',
  'XeLaTeX',
  'LuaTeX',
  'LuaLaTeX',
  'http',
  'https',
  'www',
  'COVID',
  'Lockdown',
  'lockdown',
  'Coronavirus',
  'coronavirus',
])

export class IgnoredWords {
  public learnedWords!: Set<string>
  private readonly ignoredMisspellings: Set<string>

  constructor() {
    this.reset()
    this.ignoredMisspellings = globalLearnedWords
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
