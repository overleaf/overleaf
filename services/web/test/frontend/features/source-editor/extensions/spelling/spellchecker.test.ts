import {
  getWordsFromLine,
  viewportLinesToCheck,
  buildSpellCheckResult,
  Word,
} from '../../../../../../frontend/js/features/source-editor/extensions/spelling/spellchecker'
import { LineTracker } from '../../../../../../frontend/js/features/source-editor/extensions/spelling/line-tracker'
import { expect } from 'chai'
import { EditorView } from '@codemirror/view'
import { EditorState, Line } from '@codemirror/state'
import _ from 'lodash'
import { IgnoredWords } from '../../../../../../frontend/js/features/dictionary/ignored-words'
import { LaTeXLanguage } from '../../../../../../frontend/js/features/source-editor/languages/latex/latex-language'
import { LanguageSupport } from '@codemirror/language'

const latex = new LanguageSupport(LaTeXLanguage)

const makeView = (text: string) => {
  const view = new EditorView({
    state: EditorState.create({
      doc: text,
      extensions: [latex],
    }),
  })
  return view
}

describe('SpellChecker', function () {
  describe('getWordsFromLine', function () {
    let lang: string, ignoredWords: IgnoredWords
    beforeEach(function () {
      /* Note: ignore the word 'test' */
      lang = 'en'
      ignoredWords = new Set([]) as unknown as IgnoredWords
    })

    it('should get words from a line', function () {
      const view = makeView('Hello test one two')
      const line = view.state.doc.line(1)
      const words = getWordsFromLine(view, line, ignoredWords, lang)
      expect(words).to.deep.equal([
        { text: 'Hello', from: 0, to: 5, lineNumber: 1, lang: 'en' },
        { text: 'test', from: 6, to: 10, lineNumber: 1, lang: 'en' },
        { text: 'one', from: 11, to: 14, lineNumber: 1, lang: 'en' },
        { text: 'two', from: 15, to: 18, lineNumber: 1, lang: 'en' },
      ])
    })

    it('should ignore words in ignoredWords', function () {
      ignoredWords = new Set(['test']) as unknown as IgnoredWords
      const view = makeView('Hello test one two')
      const line = view.state.doc.line(1)
      const words = getWordsFromLine(view, line, ignoredWords, lang)
      expect(words).to.deep.equal([
        { text: 'Hello', from: 0, to: 5, lineNumber: 1, lang: 'en' },
        { text: 'one', from: 11, to: 14, lineNumber: 1, lang: 'en' },
        { text: 'two', from: 15, to: 18, lineNumber: 1, lang: 'en' },
      ])
    })

    it('should get no words from an empty line', function () {
      const view = makeView('    ')
      const line = view.state.doc.line(1)
      const words = getWordsFromLine(view, line, ignoredWords, lang)
      expect(words).to.deep.equal([])
    })

    it('should ignore content of some commands in the text', function () {
      const view = makeView('\\usepackage[foo]{ bar } seven eight')
      const line = view.state.doc.line(1)
      const words = getWordsFromLine(view, line, ignoredWords, lang)
      expect(words).to.deep.equal([
        { text: 'seven', from: 24, to: 29, lineNumber: 1, lang: 'en' },
        { text: 'eight', from: 30, to: 35, lineNumber: 1, lang: 'en' },
      ])
    })

    it('should ignore command names in the text', function () {
      const view = makeView('\\foo nine \\bar ten \\baz[]{}')
      const line = view.state.doc.line(1)
      const words = getWordsFromLine(view, line, ignoredWords, lang)
      expect(words).to.deep.equal([
        { text: 'nine', from: 5, to: 9, lineNumber: 1, lang: 'en' },
        { text: 'ten', from: 15, to: 18, lineNumber: 1, lang: 'en' },
      ])
    })
  })

  describe('viewportLinesToCheck', function () {
    const expectLines = (lines: Line[], expectations: any) => {
      expect(lines.map(l => l.number)).to.deep.equal(expectations)
    }
    const expectLineRange = (lines: Line[], from: number, to: number) => {
      expect(lines.map(l => l.number)).to.deep.equal(_.range(from, to + 1))
    }

    let view: EditorView
    beforeEach(function () {
      view = makeView(new Array(1000).fill('aa bb cc dd').join('\n'))
      // Test preconditions on these structures
      const viewport = view.viewport
      expect(view.state.doc.lines).to.equal(1000)
      const firstVisibleLine = view.state.doc.lineAt(viewport.from).number
      const lastVisibleLine = view.state.doc.lineAt(viewport.to).number
      expect(firstVisibleLine).to.equal(1)
      expect(lastVisibleLine).to.equal(36)
    })

    describe('when all lines are changed', function () {
      let lineTracker: LineTracker
      beforeEach(function () {
        lineTracker = new LineTracker(view.state.doc)
      })

      it('should check all lines in the viewport when not first check', function () {
        const firstCheck = false
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expectLineRange(linesToCheck, 1, 36)
      })

      it('should check more lines than the viewport on first check', function () {
        const firstCheck = true
        const lineTracker = new LineTracker(view.state.doc)
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expectLineRange(linesToCheck, 1, 108)
      })
    })

    describe('when no lines have changed', function () {
      let lineTracker: LineTracker
      beforeEach(function () {
        lineTracker = new LineTracker(view.state.doc)
        lineTracker.clearAllLines()
      })

      it('on first check, should not check any lines', function () {
        const firstCheck = true
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expect(linesToCheck).to.deep.equal([])
      })

      it('on not first check, should not check any lines', function () {
        const firstCheck = false
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expectLines(linesToCheck, [])
      })
    })

    describe('when some lines have changed in viewport', function () {
      let lineTracker: LineTracker
      beforeEach(function () {
        lineTracker = new LineTracker(view.state.doc)
        lineTracker.clearAllLines()
        lineTracker.markLineAsUpdated(3)
        lineTracker.markLineAsUpdated(7)
      })

      it('should check correct lines', function () {
        const firstCheck = false
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expectLines(linesToCheck, [3, 7])
      })
    })

    describe('when some lines have changed outside viewport', function () {
      let lineTracker: LineTracker
      beforeEach(function () {
        lineTracker = new LineTracker(view.state.doc)
        lineTracker.clearAllLines()
        lineTracker.markLineAsUpdated(300)
        lineTracker.markLineAsUpdated(307)
      })

      it('should not check lines', function () {
        const firstCheck = false
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expectLines(linesToCheck, [])
      })
    })

    describe('when some lines have changed inside and outside viewport', function () {
      let lineTracker: LineTracker
      beforeEach(function () {
        lineTracker = new LineTracker(view.state.doc)
        lineTracker.clearAllLines()
        lineTracker.markLineAsUpdated(10)
        lineTracker.markLineAsUpdated(12)
        lineTracker.markLineAsUpdated(300)
        lineTracker.markLineAsUpdated(307)
      })

      it('should check only lines in viewport', function () {
        const firstCheck = false
        const linesToCheck = viewportLinesToCheck(lineTracker, firstCheck, view)
        expectLines(linesToCheck, [10, 12])
      })
    })
  })

  describe('buildSpellCheckResult', function () {
    it('should build an empty result', function () {
      const knownMisspelledWords: Word[] = []
      const unknownWords: Word[] = []
      const misspellings: { index: number; suggestions: string[] }[] = []
      const result = buildSpellCheckResult(
        knownMisspelledWords,
        unknownWords,
        misspellings
      )
      expect(result).to.deep.equal({
        cacheAdditions: [],
        misspelledWords: [],
      })
    })
    it('should build a realistic result', function () {
      const _makeWord = (text: string, suggestions?: string[]) => {
        const word = new Word({
          text,
          from: 0,
          to: 0,
          lineNumber: 0,
          lang: 'xx',
        })
        if (suggestions != null) {
          word.suggestions = suggestions
        }
        return word
      }
      // We know this word is misspelled
      const knownMisspelledWords = [_makeWord('fff', ['food', 'fleece'])]
      // These words we didn't know
      const unknownWords = [
        _makeWord('aaa'),
        _makeWord('bbb'),
        _makeWord('ccc'),
        _makeWord('ddd'),
      ]
      // These are the suggestions we got back from the backend
      const misspellings = [
        { index: 1, suggestions: ['box', 'bass'] },
        { index: 3, suggestions: ['docs', 'dance'] },
      ]
      // Build the result structure
      const result = buildSpellCheckResult(
        knownMisspelledWords,
        unknownWords,
        misspellings
      )
      expect(result).to.have.keys('cacheAdditions', 'misspelledWords')
      // Check cache additions
      expect(result.cacheAdditions.map(([k, v]) => [k.text, v])).to.deep.equal([
        // Put these in cache as known misspellings
        ['bbb', ['box', 'bass']],
        ['ddd', ['docs', 'dance']],
        // Put these in cache as known-correct
        ['aaa', true],
        ['ccc', true],
      ])
      // Check misspellings
      expect(
        result.misspelledWords.map(w => [w.text, w.suggestions])
      ).to.deep.equal([
        // Words in the payload that we now know were misspelled
        ['bbb', ['box', 'bass']],
        ['ddd', ['docs', 'dance']],
        // Word we already knew was misspelled, preserved here
        ['fff', ['food', 'fleece']],
      ])
    })
  })
})
