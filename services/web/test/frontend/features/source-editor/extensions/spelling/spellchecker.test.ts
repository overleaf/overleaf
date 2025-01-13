import {
  getWordsFromLine,
  buildSpellCheckResult,
  Word,
} from '@/features/source-editor/extensions/spelling/spellchecker'
import { expect } from 'chai'
import { EditorView } from '@codemirror/view'
import { LaTeXLanguage } from '@/features/source-editor/languages/latex/latex-language'
import { LanguageSupport } from '@codemirror/language'

const extensions = [new LanguageSupport(LaTeXLanguage)]

describe('SpellChecker', function () {
  describe('getWordsFromLine', function () {
    let lang: string
    beforeEach(function () {
      /* Note: ignore the word 'test' */
      lang = 'en'
    })

    it('should get words from a line', function () {
      const view = new EditorView({
        doc: 'Hello test one two',
        extensions,
      })
      const line = view.state.doc.line(1)
      const words = Array.from(getWordsFromLine(view, line, lang))
      expect(words).to.deep.equal([
        { text: 'Hello', from: 0, to: 5, lineNumber: 1, lang: 'en' },
        { text: 'test', from: 6, to: 10, lineNumber: 1, lang: 'en' },
        { text: 'one', from: 11, to: 14, lineNumber: 1, lang: 'en' },
        { text: 'two', from: 15, to: 18, lineNumber: 1, lang: 'en' },
      ])
    })

    it('should get no words from an empty line', function () {
      const view = new EditorView({
        doc: '    ',
        extensions,
      })
      const line = view.state.doc.line(1)
      const words = Array.from(getWordsFromLine(view, line, lang))
      expect(words).to.deep.equal([])
    })

    it('should ignore content of some commands in the text', function () {
      const view = new EditorView({
        doc: '\\usepackage[foo]{ bar } seven eight',
        extensions,
      })
      const line = view.state.doc.line(1)
      const words = Array.from(getWordsFromLine(view, line, lang))
      expect(words).to.deep.equal([
        { text: 'seven', from: 24, to: 29, lineNumber: 1, lang: 'en' },
        { text: 'eight', from: 30, to: 35, lineNumber: 1, lang: 'en' },
      ])
    })

    it('should ignore command names in the text', function () {
      const view = new EditorView({
        doc: '\\foo nine \\bar ten \\baz[]{}',
        extensions,
      })
      const line = view.state.doc.line(1)
      const words = Array.from(getWordsFromLine(view, line, lang))
      expect(words).to.deep.equal([
        { text: 'nine', from: 5, to: 9, lineNumber: 1, lang: 'en' },
        { text: 'ten', from: 15, to: 18, lineNumber: 1, lang: 'en' },
      ])
    })
  })

  describe('buildSpellCheckResult', function () {
    it('should build an empty result', function () {
      const knownMisspelledWords: Word[] = []
      const unknownWords: Word[] = []
      const misspellings: { index: number }[] = []
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
      const _makeWord = (text: string) => {
        return new Word({
          text,
          from: 0,
          to: 0,
          lineNumber: 0,
          lang: 'xx',
        })
      }
      // We know this word is misspelled
      const knownMisspelledWords = [_makeWord('fff')]
      // These words we didn't know
      const unknownWords = [
        _makeWord('aaa'),
        _makeWord('bbb'),
        _makeWord('ccc'),
        _makeWord('ddd'),
      ]
      // These are the suggestions we got back from the backend
      const misspellings = [{ index: 1 }, { index: 3 }]
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
        ['bbb', false],
        ['ddd', false],
        // Put these in cache as known-correct
        ['aaa', true],
        ['ccc', true],
      ])
      // Check misspellings
      expect(result.misspelledWords.map(w => w.text)).to.deep.equal([
        // Words in the payload that we now know were misspelled
        'bbb',
        'ddd',
        // Word we already knew was misspelled, preserved here
        'fff',
      ])
    })
  })
})
