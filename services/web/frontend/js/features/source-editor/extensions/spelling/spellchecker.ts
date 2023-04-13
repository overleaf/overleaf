import { addMisspelledWords } from './misspelled-words'
import { ignoredWordsField, resetSpellChecker } from './ignored-words'
import { LineTracker } from './line-tracker'
import { cacheField, addWordToCache, WordCacheValue } from './cache'
import { WORD_REGEX } from './helpers'
import OError from '@overleaf/o-error'
import { spellCheckRequest } from './backend'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { Line } from '@codemirror/state'
import { IgnoredWords } from '../../../dictionary/ignored-words'
import {
  getNormalTextSpansFromLine,
  NormalTextSpan,
} from '../../utils/tree-query'
import { waitForParser } from '../wait-for-parser'

const DEBUG = window ? window.sl_debugging : false

const _log = (...args: any) => {
  if (DEBUG) {
    console.debug('[SpellChecker]: ', ...args)
  }
}

/*
 * Spellchecker, handles updates, schedules spelling checks
 */
export class SpellChecker {
  private abortController?: AbortController | null = null
  private timeout: number | null = null
  private firstCheck = true
  private lineTracker: LineTracker | null = null
  private waitingForParser = false
  private firstCheckPending = false

  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly language: string) {
    this.language = language
  }

  destroy() {
    _log('destroy')
    this._clearPendingSpellCheck()
  }

  _abortRequest() {
    if (this.abortController) {
      _log('abort request')
      this.abortController.abort()
      this.abortController = null
    }
  }

  handleUpdate(update: ViewUpdate) {
    if (!this.lineTracker) {
      this.lineTracker = new LineTracker(update.state.doc)
    }
    if (update.docChanged) {
      this.lineTracker.applyUpdate(update)
      this.scheduleSpellCheck(update.view)
    } else if (update.viewportChanged) {
      this.scheduleSpellCheck(update.view)
    } else if (
      update.transactions.some(tr => {
        return tr.effects.some(effect => effect.is(resetSpellChecker))
      })
    ) {
      this.lineTracker.resetAllLines()
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
      _log('Scheduling initial spellcheck')
      this.spellCheckAsap(update.view)
    }
  }

  _performSpellCheck(view: EditorView) {
    _log('Begin ---------------->')
    const wordsToCheck = this.getWordsToCheck(view)
    if (wordsToCheck.length === 0) {
      return
    }
    _log(
      '- words to check',
      wordsToCheck.map(w => w.text)
    )
    const cache = view.state.field(cacheField)
    const { knownMisspelledWords, unknownWords } = cache.checkWords(
      this.language,
      wordsToCheck
    )
    const processResult = (
      misspellings: { index: number; suggestions: string[] }[]
    ) => {
      this.lineTracker?.clearChangedLinesForWords(wordsToCheck)
      if (this.firstCheck) {
        this.firstCheck = false
        this.firstCheckPending = false
      }
      const result = buildSpellCheckResult(
        knownMisspelledWords,
        unknownWords,
        misspellings
      )
      _log('- result', result)
      window.setTimeout(() => {
        view.dispatch({
          effects: compileEffects(result),
        })
      }, 0)
      _log('<---------------- End')
    }
    _log('- before spellcheck request')
    _log(
      '  - unknownWords',
      unknownWords.map(w => w.text)
    )
    _log(
      '  - knownMisspelledWords',
      knownMisspelledWords.map(w => w.text)
    )
    if (unknownWords.length === 0) {
      _log('- skip request')
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
          _log('>> error in spellcheck request', error)
        })
    }
  }

  _spellCheckWhenParserReady(view: EditorView) {
    if (this.waitingForParser) {
      return
    }

    this.waitingForParser = true
    waitForParser(
      view,
      view => viewportRangeToCheck(this.firstCheck, view).to
    ).then(() => {
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
    const lang = this.language
    const ignoredWords = view.state.field(ignoredWordsField)
    _log('- ignored words', ignoredWords)
    if (!this.lineTracker) {
      this.lineTracker = new LineTracker(view.state.doc)
    }
    let wordsToCheck: Word[] = []
    for (const line of viewportLinesToCheck(
      this.lineTracker,
      this.firstCheck,
      view
    )) {
      wordsToCheck = wordsToCheck.concat(
        getWordsFromLine(view, line, ignoredWords, lang)
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
    const word = { ...unknownWords[item.index] }
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
  const finalMisspellings = misspelledWords.concat(knownMisspelledWords)
  _log('- result')
  _log(
    '  - finalMisspellings',
    finalMisspellings.map(w => w.text)
  )
  _log(
    '  - cacheAdditions',
    cacheAdditions.map(([w, v]) => `'${w.text}'=>${v}`)
  )
  return {
    cacheAdditions,
    misspelledWords: finalMisspellings,
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

const viewportRangeToCheck = (firstCheck: boolean, view: EditorView) => {
  const doc = view.state.doc
  let { from, to } = view.viewport
  let firstLineNumber = doc.lineAt(from).number
  let lastLineNumber = doc.lineAt(to).number

  /*
   * On first check, we scan the viewport plus some padding on either side.
   * Then on subsequent checks we just scan the viewport
   */
  if (firstCheck) {
    const visibleLineCount = lastLineNumber - firstLineNumber + 1
    const padding = Math.floor(visibleLineCount * 2)
    firstLineNumber = Math.max(firstLineNumber - padding, 1)
    lastLineNumber = Math.min(lastLineNumber + padding, doc.lines)
    from = doc.line(firstLineNumber).from
    to = doc.line(lastLineNumber).to
  }

  return { from, to, firstLineNumber, lastLineNumber }
}

export const viewportLinesToCheck = (
  lineTracker: LineTracker,
  firstCheck: boolean,
  view: EditorView
) => {
  const { firstLineNumber, lastLineNumber } = viewportRangeToCheck(
    firstCheck,
    view
  )
  _log('- viewport lines', firstLineNumber, lastLineNumber)
  const lines = []
  for (
    let lineNumber = firstLineNumber;
    lineNumber <= lastLineNumber;
    lineNumber++
  ) {
    if (!lineTracker.lineHasChanged(lineNumber)) {
      continue
    }
    lines.push(view.state.doc.line(lineNumber))
  }
  _log(
    '- lines to check',
    lines.map(l => l.number)
  )
  return lines
}

export const getWordsFromLine = (
  view: EditorView,
  line: Line,
  ignoredWords: IgnoredWords,
  lang: string
): Word[] => {
  const lineNumber = line.number
  const normalTextSpans: Array<NormalTextSpan> = getNormalTextSpansFromLine(
    view,
    line
  )
  const words: Word[] = []
  let regexResult
  normalTextSpans.forEach(span => {
    WORD_REGEX.lastIndex = 0 // reset global stateful regexp for this usage
    while ((regexResult = WORD_REGEX.exec(span.text))) {
      let word = regexResult[0]
      if (word.startsWith("'")) {
        word = word.slice(1)
      }
      if (word.endsWith("'")) {
        word = word.slice(0, -1)
      }
      if (!ignoredWords.has(word)) {
        words.push(
          new Word({
            text: word,
            from: span.from + regexResult.index,
            to: span.from + regexResult.index + word.length,
            lineNumber,
            lang,
          })
        )
      }
    }
  })
  return words
}
