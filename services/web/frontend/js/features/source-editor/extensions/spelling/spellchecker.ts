import { addMisspelledWords, misspelledWordsField } from './misspelled-words'
import { ignoredWordsField, resetSpellChecker } from './ignored-words'
import { cacheField, addWordToCache, WordCacheValue } from './cache'
import { WORD_REGEX } from './helpers'
import OError from '@overleaf/o-error'
import { spellCheckRequest } from './backend'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { ChangeSet, Line, Range, RangeValue } from '@codemirror/state'
import { IgnoredWords } from '../../../dictionary/ignored-words'
import {
  getNormalTextSpansFromLine,
  NormalTextSpan,
} from '../../utils/tree-query'
import { waitForParser } from '../wait-for-parser'
import { debugConsole } from '@/utils/debugging'

/*
 * Spellchecker, handles updates, schedules spelling checks
 */
export class SpellChecker {
  private abortController?: AbortController | null = null
  private timeout: number | null = null
  private firstCheck = true
  private waitingForParser = false
  private firstCheckPending = false
  private trackedChanges: ChangeSet

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly language: string) {
    this.language = language
    this.trackedChanges = ChangeSet.empty(0)
  }

  destroy() {
    this._clearPendingSpellCheck()
  }

  _abortRequest() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  handleUpdate(update: ViewUpdate) {
    if (update.docChanged) {
      this.trackedChanges = this.trackedChanges.compose(update.changes)
      this.scheduleSpellCheck(update.view)
    } else if (update.viewportChanged) {
      this.trackedChanges = ChangeSet.empty(0)
      this.scheduleSpellCheck(update.view)
    } else if (
      update.transactions.some(tr => {
        return tr.effects.some(effect => effect.is(resetSpellChecker))
      })
    ) {
      // for tests
      this.trackedChanges = ChangeSet.empty(0)
      this.spellCheckAsap(update.view)
    }
    // At the point that the spellchecker is initialized, the editor may not
    // yet be editable, and the parser may not be ready. Therefore, to do the
    // initial spellcheck, watch for changes in the editability of the editor
    // and kick off the process that performs a spellcheck once the parser is
    // ready. CM6 dispatches a transaction after every chunk of parser work and
    // when the editability changes, which means the spell checker is
    // initialized as soon as possible.
    else if (
      this.firstCheck &&
      !this.firstCheckPending &&
      update.state.facet(EditorView.editable)
    ) {
      this.firstCheckPending = true
      this.spellCheckAsap(update.view)
    }
  }

  _performSpellCheck(view: EditorView) {
    const wordsToCheck = this.getWordsToCheck(view)
    if (wordsToCheck.length === 0) {
      return
    }
    const cache = view.state.field(cacheField)
    const { knownMisspelledWords, unknownWords } = cache.checkWords(
      this.language,
      wordsToCheck
    )
    const processResult = (
      misspellings: { index: number; suggestions: string[] }[]
    ) => {
      this.trackedChanges = ChangeSet.empty(0)

      if (this.firstCheck) {
        this.firstCheck = false
        this.firstCheckPending = false
      }
      const result = buildSpellCheckResult(
        knownMisspelledWords,
        unknownWords,
        misspellings
      )
      window.setTimeout(() => {
        view.dispatch({
          effects: compileEffects(result),
        })
      }, 0)
    }
    if (unknownWords.length === 0) {
      processResult([])
    } else {
      this._abortRequest()
      this.abortController = new AbortController()
      spellCheckRequest(this.language, unknownWords, this.abortController)
        .then(result => {
          this.abortController = null
          processResult(result.misspellings)
        })
        .catch(error => {
          this.abortController = null
          debugConsole.error(error)
        })
    }
  }

  _spellCheckWhenParserReady(view: EditorView) {
    if (this.waitingForParser) {
      return
    }

    this.waitingForParser = true
    waitForParser(view, view => view.viewport.to).then(() => {
      this.waitingForParser = false
      this._performSpellCheck(view)
    })
  }

  _clearPendingSpellCheck() {
    if (this.timeout) {
      window.clearTimeout(this.timeout)
      this.timeout = null
    }
    this._abortRequest()
  }

  _asyncSpellCheck(view: EditorView, delay: number) {
    this._clearPendingSpellCheck()

    this.timeout = window.setTimeout(() => {
      this._spellCheckWhenParserReady(view)
      this.timeout = null
    }, delay)
  }

  spellCheckAsap(view: EditorView) {
    this._asyncSpellCheck(view, 0)
  }

  scheduleSpellCheck(view: EditorView) {
    this._asyncSpellCheck(view, 1000)
  }

  getWordsToCheck(view: EditorView) {
    const wordsToCheck: Word[] = []

    const { from, to } = view.viewport
    const changedLineNumbers = new Set<number>()
    if (this.trackedChanges.length > 0) {
      this.trackedChanges.iterChangedRanges((fromA, toA, fromB, toB) => {
        if (fromB <= to && toB >= from) {
          const fromLine = view.state.doc.lineAt(fromB).number
          const toLine = view.state.doc.lineAt(toB).number
          for (let i = fromLine; i <= toLine; i++) {
            changedLineNumbers.add(i)
          }
        }
      })
    } else {
      const fromLine = view.state.doc.lineAt(from).number
      const toLine = view.state.doc.lineAt(to).number
      for (let i = fromLine; i <= toLine; i++) {
        changedLineNumbers.add(i)
      }
    }

    const ignoredWords = view.state.field(ignoredWordsField)
    for (const i of changedLineNumbers) {
      const line = view.state.doc.line(i)
      wordsToCheck.push(
        ...getWordsFromLine(view, line, ignoredWords, this.language)
      )
    }

    return wordsToCheck
  }
}

export class Word {
  public text: string
  public from: number
  public to: number
  public lineNumber: number
  public lang: string
  public suggestions?: WordCacheValue

  constructor(options: {
    text: string
    from: number
    to: number
    lineNumber: number
    lang: string
  }) {
    const { text, from, to, lineNumber, lang } = options
    if (
      text == null ||
      from == null ||
      to == null ||
      lineNumber == null ||
      lang == null
    ) {
      throw new OError('Spellcheck: invalid word').withInfo({ options })
    }
    this.text = text
    this.from = from
    this.to = to
    this.lineNumber = lineNumber
    this.lang = lang
  }
}

export const buildSpellCheckResult = (
  knownMisspelledWords: Word[],
  unknownWords: Word[],
  misspellings: { index: number; suggestions: string[] }[]
) => {
  const cacheAdditions: [Word, string[] | boolean][] = []

  // Put known misspellings into cache
  const misspelledWords = misspellings.map(item => {
    const word = {
      ...unknownWords[item.index],
    }
    word.suggestions = item.suggestions
    if (word.suggestions) {
      cacheAdditions.push([word, word.suggestions])
    }
    return word
  })

  // if word was not misspelled, put it in the cache
  for (const word of unknownWords) {
    if (!misspelledWords.find(mw => mw.text === word.text)) {
      cacheAdditions.push([word, true])
    }
  }

  return {
    cacheAdditions,
    misspelledWords: misspelledWords.concat(knownMisspelledWords),
  }
}

export const compileEffects = (results: {
  cacheAdditions: [Word, string[] | boolean][]
  misspelledWords: Word[]
}) => {
  const { cacheAdditions, misspelledWords } = results
  return [
    addMisspelledWords.of(misspelledWords),
    ...cacheAdditions.map(([word, value]) => {
      return addWordToCache.of({
        lang: word.lang,
        wordText: word.text,
        value,
      })
    }),
  ]
}

export const getWordsFromLine = (
  view: EditorView,
  line: Line,
  ignoredWords: IgnoredWords,
  lang: string
): Word[] => {
  const normalTextSpans: Array<NormalTextSpan> = getNormalTextSpansFromLine(
    view,
    line
  )
  const words: Word[] = []
  for (const span of normalTextSpans) {
    for (const match of span.text.matchAll(WORD_REGEX)) {
      let word = match[0]
      if (word.startsWith("'")) {
        word = word.slice(1)
      }
      if (word.endsWith("'")) {
        word = word.slice(0, -1)
      }
      if (!ignoredWords.has(word)) {
        const from = span.from + match.index
        words.push(
          new Word({
            text: word,
            from,
            to: from + word.length,
            lineNumber: line.number,
            lang,
          })
        )
      }
    }
  }
  return words
}

export type Mark = Range<RangeValue & { spec: { word: Word } }>

export const getMarkAtPosition = (
  view: EditorView,
  position: number
): Mark | null => {
  const marks = view.state.field(misspelledWordsField)

  let targetMark: Mark | null = null
  marks.between(view.viewport.from, view.viewport.to, (from, to, value) => {
    if (position >= from && position <= to) {
      targetMark = { from, to, value }
      return false
    }
  })
  return targetMark
}
