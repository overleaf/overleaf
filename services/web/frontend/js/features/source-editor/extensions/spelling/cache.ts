import { StateField, StateEffect } from '@codemirror/state'
import LRU from 'lru-cache'
import { Word } from './spellchecker'
const CACHE_MAX = 15000

export const cacheKey = (lang: string, wordText: string) => {
  return `${lang}:${wordText}`
}

export class WordCache {
  private _cache: LRU<string, boolean>

  constructor() {
    this._cache = new LRU({ max: CACHE_MAX })
  }

  set(lang: string, wordText: string, value: boolean) {
    const key = cacheKey(lang, wordText)
    this._cache.set(key, value)
  }

  get(lang: string, wordText: string) {
    const key = cacheKey(lang, wordText)
    return this._cache.get(key)
  }

  remove(lang: string, wordText: string) {
    const key = cacheKey(lang, wordText)
    this._cache.delete(key)
  }

  reset() {
    this._cache = new LRU({ max: CACHE_MAX })
  }

  /*
   * Given a language and a list of words,
   * check the cache and sort the words into two categories:
   *   - words we know to be misspelled
   *   - words that are presently unknown to us
   */
  checkWords(
    lang: string,
    wordsToCheck: Word[]
  ): {
    knownMisspelledWords: Word[]
    unknownWords: Word[]
  } {
    const knownMisspelledWords: Word[] = []
    const unknownWords: Word[] = []
    const seen: Record<string, boolean | undefined> = {}
    for (const word of wordsToCheck) {
      const wordText = word.text
      if (seen[wordText] === undefined) {
        seen[wordText] = this.get(lang, wordText)
      }
      const cached = seen[wordText]
      if (cached === undefined) {
        // Word is not known
        unknownWords.push(word)
      } else if (!cached) {
        // Word is known to be misspelled
        knownMisspelledWords.push(word)
      }
    }
    return {
      knownMisspelledWords,
      unknownWords,
    }
  }
}

export const addWordToCache = StateEffect.define<{
  lang: string
  wordText: string
  value: boolean
}>()

export const removeWordFromCache = StateEffect.define<{
  lang: string
  wordText: string
}>()

// Share a single instance of WordCache between all instances of the CM6 source editor. This means that cached words are
// retained when switching away from CM6 and then back to it.
const wordCache = new WordCache()

export const cacheField = StateField.define<WordCache>({
  create() {
    return wordCache
  },
  update(cache, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(addWordToCache)) {
        const { lang, wordText, value } = effect.value
        cache.set(lang, wordText, value)
      } else if (effect.is(removeWordFromCache)) {
        const { lang, wordText } = effect.value
        cache.remove(lang, wordText)
      }
    }
    return cache
  },
})
