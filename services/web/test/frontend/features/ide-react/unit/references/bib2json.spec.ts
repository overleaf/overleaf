import { Bib2JsonEntry } from '@/features/ide-react/references/types'
import BibtexParserImport from '../../../../../../frontend/js/features/ide-react/references/bib2json'
import { expect } from 'chai'

const BibtexParser = BibtexParserImport as unknown as (
  content: string,
  allowedKeys?: string[]
) => {
  entries: Bib2JsonEntry[]
  errors: any[]
}

describe('Bib2JsonTests', function () {
  describe('Upstream', function () {
    // pulled in from the bib2json repository
    // https://github.com/mayanklahiri/bib2json/blob/3d7c1f0d738c07d0e1c9a59f4cb9b96c74deb744/test/spec/ParserSpec.js
    // Author: Mayank Lahiri <mlahiri@gmail.com>
    // License: BSD-2-Clause
    it('Parse an empty string without errors or results', function () {
      const result = BibtexParser('  \t\t\n   \n\n')
      expect(result.entries.length).to.equal(0)
      expect(result.errors.length).to.equal(0)
    })

    it('Parse braces within braces', function () {
      const result = BibtexParser(
        '@book { pollock, title={{{A}} very {Big} Book.} }'
      )
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('A very Big Book.')
    })

    it('Parse braces within quotes', function () {
      const result = BibtexParser(
        '@book { pollock, title="{A} very {Big} Book."}'
      )
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('A very Big Book.')
    })

    it('Parse quotes within braces', function () {
      const result = BibtexParser(
        '@book { pollock, title="{A} very {"Big"} Book."}'
      )
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('A very "Big" Book.')
    })

    it('Respect backslashes', function () {
      const text = '@book { pollock, title="{A} \\\\very \\{{Big} \\"Book\\"."}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('A \\very {Big "Book".')
    })

    it('Convert some Latex characters to UTF-8', function () {
      const result = BibtexParser(
        '@book { pollock, title="\\"{o}\\AA \\^{I}\\alpha " }'
      )
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal(
        '\u00f6\u00c5\u00ce\u03b1'
      )
    })

    it('Expand a predefined macro in the middle an entry', function () {
      const text = '@book{ pollock, month   = jan, title="A title!" }'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.month).to.equal('January')
    })

    return it('Expand a macro at the end of an entry', function () {
      const text =
        '@string  \n{ howdy = "well, hello!" }@book{ pollock, title=howdy }'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('well, hello!')
    })
  })

  describe('normalize keys to lower case', function () {
    it('should lower the case of RaNDoM', function () {
      const text = '@book{ id, RaNDoM = "VALUE" }'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields).to.deep.equal({ random: 'VALUE' })
    })

    return it('should preserve the marco usage of RaNDoM', function () {
      const text = '@string{ RaNDoM="MACRO"}@book{ id, Title = RaNDoM }'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields).to.deep.equal({ title: 'MACRO' })
    })
  })

  // sometimes imported bib files contain {\\}, {\\\}, {\\\\} etc to replace whitespace in values
  describe('handles backslash braces from imported bibs', function () {
    it('handles one backslash {\\}', function () {
      const text =
        '@book { pollock, title="{\\}{A} \\\\very \\{{Big} \\"Book\\"."}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('}A \\very {Big "Book".')
    })
    it('handles two backslashes {\\\\}', function () {
      const text =
        '@book { pollock, title="{\\\\}{A} \\\\very \\{{Big} \\"Book\\"."}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('\\A \\very {Big "Book".')
    })
    it('handles three backslashes {\\\\\\}', function () {
      const text =
        '@book { pollock, title="{\\\\\\}{A} \\\\very \\{{Big} \\"Book\\"."}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal(
        '\\}A \\very {Big "Book".'
      )
    })
    it('handles four backslashes {\\\\\\\\}', function () {
      const text =
        '@book { pollock, title="{\\\\\\\\}{A} \\\\very \\{{Big} \\"Book\\"."}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal(
        '\\\\A \\very {Big "Book".'
      )
    })
    it('keeps parsing future entries after an even amount of backslashes {\\\\}', function () {
      const text =
        '@book { pollock, title="{\\\\}{A} \\\\very \\{{Big} \\"Book\\"."}' +
        '@book { pollock, title="{\\\\}{A} \\\\very \\{{Big} secondary \\"Book\\".", author="Muräkämi, Häruki"}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(2)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('\\A \\very {Big "Book".')
      expect(result.entries[1].Fields.title).to.equal(
        '\\A \\very {Big secondary "Book".'
      )
      expect(result.entries[1].Fields.author).to.equal('Muräkämi, Häruki')
    })
    return it('keeps parsing future entries after an odd amount of backslashes {\\\\\\}', function () {
      const text =
        '@book { pollock, title="{\\\\\\}{A} \\\\very \\{{Big} \\"Book\\"."}' +
        '@book { pollock, title="{\\\\}{A} \\\\very \\{{Big} secondary \\"Book\\".", author="Muräkämi, Häruki"}'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(2)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal(
        '\\}A \\very {Big "Book".'
      )
      expect(result.entries[1].Fields.title).to.equal(
        '\\A \\very {Big secondary "Book".'
      )
      expect(result.entries[1].Fields.author).to.equal('Muräkämi, Häruki')
    })
  })

  return describe('with allowedKeys set', function () {
    it('should skip the unknown key Random', function () {
      const text = '@book{ id, Random = "ABC", title="VALUE" }'
      const result = BibtexParser(text, ['title'])
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields).to.deep.equal({ title: 'VALUE' })
    })

    it('should still parse unknown entry types', function () {
      const text = '@myCustomType{ id, Random = "ABC", title="VALUE" }'
      const result = BibtexParser(text, ['title'])
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields).to.deep.equal({ title: 'VALUE' })
    })

    return it('should preserve the marco usage of RaNDoM', function () {
      const text =
        '@string{ RaNDoM="MACRO"}@book{ id, Random = "ABC", Title = RaNDoM }'
      const result = BibtexParser(text, ['title'])
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields).to.deep.equal({ title: 'MACRO' })
    })
  })
})
