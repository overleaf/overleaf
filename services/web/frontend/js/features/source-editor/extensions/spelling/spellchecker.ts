import { addMisspelledWords, misspelledWordsField } from './misspelled-words'
import { addLearnedWordEffect, removeLearnedWordEffect } from './learned-words'
import { cacheField, addWordToCache } from './cache'
import { WORD_REGEX } from './helpers'
import OError from '@overleaf/o-error'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { ChangeSet, Line, Range, RangeValue } from '@codemirror/state'
import { getNormalTextSpansFromLine } from '../../utils/tree-query'
import { waitForParser } from '../wait-for-parser'
import { debugConsole } from '@/utils/debugging'
import type { HunspellManager } from '../../hunspell/HunspellManager'
import { captureException } from '@/infrastructure/error-reporter'

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
  private destroyed = false
  private readonly segmenter?: Intl.Segmenter

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly language: string,
    private hunspellManager?: HunspellManager
  ) {
    debugConsole.log('SpellChecker', language, hunspellManager)
    this.trackedChanges = ChangeSet.empty(0)

    const locale = language.replace(/_/, '-')

    try {
      if (Intl.Segmenter) {
        const supportedLocales = Intl.Segmenter.supportedLocalesOf([locale], {
          localeMatcher: 'lookup',
        })

        if (supportedLocales.includes(locale)) {
          this.segmenter = new Intl.Segmenter(locale, {
            localeMatcher: 'lookup',
            granularity: 'word',
          })
        }
      }
    } catch (error) {
      // ignore, not supported for some reason
      debugConsole.error(error)
    }

    if (this.segmenter) {
      debugConsole.log(`Using Intl.Segmenter for ${locale}`)
    } else {
      debugConsole.warn(`Not using Intl.Segmenter for ${locale}`)
    }
  }

  destroy() {
    this._clearPendingSpellCheck()
    this.destroyed = true
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
    } else {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(addLearnedWordEffect)) {
            this.addWord(effect.value)
              .then(() => {
                update.view.state.field(cacheField, false)?.reset()
                this.trackedChanges = ChangeSet.empty(0)
                this.spellCheckAsap(update.view)
              })
              .catch(error => {
                captureException(error)
                debugConsole.error(error)
              })
          } else if (effect.is(removeLearnedWordEffect)) {
            this.removeWord(effect.value)
              .then(() => {
                update.view.state.field(cacheField, false)?.reset()
                this.trackedChanges = ChangeSet.empty(0)
                this.spellCheckAsap(update.view)
              })
              .catch(error => {
                captureException(error)
                debugConsole.error(error)
              })
          }
        }
      }
    }
  }

  _performSpellCheck(view: EditorView) {
    const wordsToCheck = this.getWordsToCheck(view)
    if (wordsToCheck.length === 0) {
      this.trackedChanges = ChangeSet.empty(0)
      return
    }
    const cache = view.state.field(cacheField)
    const { knownMisspelledWords, unknownWords } = cache.checkWords(
      this.language,
      wordsToCheck
    )
    const processResult = (misspellings: { index: number }[]) => {
      this.trackedChanges = ChangeSet.empty(0)

      if (this.firstCheck) {
        this.firstCheck = false
        this.firstCheckPending = false
      }
      const { misspelledWords, cacheAdditions } = buildSpellCheckResult(
        knownMisspelledWords,
        unknownWords,
        misspellings
      )
      view.dispatch({
        effects: [
          addMisspelledWords.of(misspelledWords),
          ...cacheAdditions.map(([word, value]) => {
            return addWordToCache.of({
              lang: word.lang,
              wordText: word.text,
              value,
            })
          }),
        ],
      })
    }
    if (unknownWords.length === 0) {
      processResult([])
    } else {
      this._abortRequest()
      this.abortController = new AbortController()
      if (this.hunspellManager) {
        const signal = this.abortController.signal
        this.hunspellManager.send(
          {
            type: 'spell',
            words: unknownWords.map(word => word.text),
          },
          result => {
            if (!signal.aborted) {
              if ('error' in result) {
                debugConsole.error(result.error)
                captureException(
                  new Error('Error running spellcheck for word'),
                  { tags: { ol_spell_check_language: this.language } }
                )
              } else {
                processResult(result.misspellings)
              }
            }
          }
        )
      }
    }
  }

  suggest(word: string) {
    return new Promise<{ suggestions: string[] }>((resolve, reject) => {
      if (this.hunspellManager) {
        this.hunspellManager.send({ type: 'suggest', word }, result => {
          if ('error' in result) {
            reject(new Error('Error finding spelling suggestions for word'))
          } else {
            resolve(result)
          }
        })
      }
    })
  }

  addWord(word: string) {
    return new Promise<void>((resolve, reject) => {
      if (this.hunspellManager) {
        this.hunspellManager.send({ type: 'add_word', word }, result => {
          if ('error' in result) {
            reject(new Error('Error adding word to spellcheck'))
          } else {
            resolve()
          }
        })
      }
    })
  }

  removeWord(word: string) {
    return new Promise<void>((resolve, reject) => {
      if (this.hunspellManager) {
        this.hunspellManager.send({ type: 'remove_word', word }, result => {
          if ('error' in result) {
            reject(new Error('Error removing word from spellcheck'))
          } else {
            resolve()
          }
        })
      }
    })
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
    if (this.destroyed) {
      debugConsole.warn(
        'spellCheckAsap called after spellchecker was destroyed. Ignoring.'
      )
      return
    }
    this._asyncSpellCheck(view, 0)
  }

  scheduleSpellCheck(view: EditorView) {
    if (this.destroyed) {
      debugConsole.warn(
        'scheduleSpellCheck called after spellchecker was destroyed. Ignoring.'
      )
      return
    }
    this._asyncSpellCheck(view, 1000)
  }

  getWordsToCheck(view: EditorView) {
    const wordsToCheck: Word[] = []

    const { from, to } = view.viewport
    const changedLineNumbers = new Set<number>()
    if (!this.trackedChanges.empty) {
      this.trackedChanges.iterChangedRanges((_fromA, _toA, fromB, toB) => {
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

    for (const i of changedLineNumbers) {
      const line = view.state.doc.line(i)
      wordsToCheck.push(
        ...getWordsFromLine(view, line, this.language, this.segmenter)
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
  misspellings: { index: number }[]
) => {
  const cacheAdditions: [Word, boolean][] = []

  // Put known misspellings into cache
  const misspelledWords = misspellings.map(item => {
    const word = {
      ...unknownWords[item.index],
    }
    cacheAdditions.push([word, false])
    return word
  })

  const misspelledWordsSet = new Set<string>(
    misspelledWords.map(word => word.text)
  )

  // if word was not misspelled, put it in the cache
  for (const word of unknownWords) {
    if (!misspelledWordsSet.has(word.text)) {
      cacheAdditions.push([word, true])
    }
  }

  return {
    cacheAdditions,
    misspelledWords: misspelledWords.concat(knownMisspelledWords),
  }
}

export function* getWordsFromLine(
  view: EditorView,
  line: Line,
  lang: string,
  segmenter?: Intl.Segmenter
) {
  for (const span of getNormalTextSpansFromLine(view, line)) {
    if (segmenter) {
      for (const value of segmenter.segment(span.text)) {
        if (value.isWordLike) {
          const word = value.segment
          const from = span.from + value.index
          yield new Word({
            text: word,
            from,
            to: from + word.length,
            lineNumber: line.number,
            lang,
          })
        }
      }
    } else {
      for (const match of span.text.matchAll(WORD_REGEX)) {
        let word = match[0].replace(/'+$/, '')
        let from = span.from + match.index
        while (word.startsWith("'")) {
          word = word.slice(1)
          from++
        }
        yield new Word({
          text: word,
          from,
          to: from + word.length,
          lineNumber: line.number,
          lang,
        })
      }
    }
  }
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
