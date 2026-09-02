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

  describe('oversized field values', function () {
    // overleaf/internal#24246: an oversized field is now truncated to
    // ~MAX_FIELD_VALUE_LENGTH instead of dropping the whole entry. Braced
    // values include the opening brace in the raw length, so the final
    // length can land a character under the limit rather than exactly on it.
    const MAX_FIELD_VALUE_LENGTH = 1000 * 20

    it('truncates an oversized field but keeps the entry and its other fields', function () {
      const hugeAuthorList = 'A'.repeat(MAX_FIELD_VALUE_LENGTH + 5000)
      const text = `@article{ key, title={Some title}, author={${hugeAuthorList}}, year={2024} }`
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('Some title')
      expect(result.entries[0].Fields.year).to.equal('2024')

      const author = result.entries[0].Fields.author
      expect(author.length).to.be.at.most(MAX_FIELD_VALUE_LENGTH)
      expect(author.length).to.be.lessThan(hugeAuthorList.length)
      expect(hugeAuthorList.startsWith(author)).to.equal(true)
    })

    it('keeps parsing later entries after an oversized field', function () {
      const hugeAuthorList = 'A'.repeat(MAX_FIELD_VALUE_LENGTH + 5000)
      const text =
        `@article{ first, title={First}, author={${hugeAuthorList}} }` +
        '@article{ second, title={Second}, author={Doe, Jane} }'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(2)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('First')
      expect(result.entries[0].Fields.author.length).to.be.at.most(
        MAX_FIELD_VALUE_LENGTH
      )
      expect(result.entries[1].Fields.title).to.equal('Second')
      expect(result.entries[1].Fields.author).to.equal('Doe, Jane')
    })

    it('does not truncate a field comfortably under the limit', function () {
      const authorList = 'A'.repeat(MAX_FIELD_VALUE_LENGTH - 100)
      const text = `@article{ key, author={${authorList}} }`
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.author).to.equal(authorList)
    })

    it('truncates an oversized quoted field but keeps the entry and its other fields', function () {
      const hugeAuthorList = 'A'.repeat(MAX_FIELD_VALUE_LENGTH + 5000)
      const text = `@article{ key, title="Some title", author="${hugeAuthorList}", year="2024" }`
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title).to.equal('Some title')
      expect(result.entries[0].Fields.year).to.equal('2024')

      const author = result.entries[0].Fields.author
      expect(author.length).to.be.at.most(MAX_FIELD_VALUE_LENGTH)
      expect(author.length).to.be.lessThan(hugeAuthorList.length)
      expect(hugeAuthorList.startsWith(author)).to.equal(true)
    })

    it('truncates cleanly through nested braces spanning the length boundary', function () {
      // cap lands inside a nested {Middle} group
      const before = 'A'.repeat(MAX_FIELD_VALUE_LENGTH - 3)
      const text = `@article{ key, title={${before}{Middle} end}, year={2024} }`
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(1)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.year).to.equal('2024')

      const title = result.entries[0].Fields.title
      expect(title.length).to.be.at.most(MAX_FIELD_VALUE_LENGTH)
      expect(title.startsWith('A'.repeat(100))).to.equal(true)
      expect(title.endsWith('end')).to.equal(false)
    })

    it('keeps parsing correctly when the length cap lands right after a backslash', function () {
      // Regression test: capping the value array mid-parse (instead of
      // truncating once complete) froze the escape check on a trailing
      // backslash, permanently misreading later quotes/braces as escaped and
      // swallowing the rest of the document with no error.
      const before = 'A'.repeat(MAX_FIELD_VALUE_LENGTH - 1)
      const text =
        `@article{ key, title="${before}\\"still inside", year="2024" }` +
        '@article{ second, title={Second} }'
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(2)
      expect(result.errors.length).to.equal(0)
      expect(result.entries[0].Fields.title.length).to.equal(
        MAX_FIELD_VALUE_LENGTH
      )
      // "year" follows the truncated "title" field in the same entry - the
      // bug above would have swallowed this too.
      expect(result.entries[0].Fields.year).to.equal('2024')
      expect(result.entries[1].Fields.title).to.equal('Second')
    })

    it('does not record parse errors as a side effect of truncation', function () {
      const hugeAuthorList = 'A'.repeat(MAX_FIELD_VALUE_LENGTH + 5000)
      const text =
        `@article{ first, title={First}, author={${hugeAuthorList}} }` +
        `@article{ second, title={Second}, author="${hugeAuthorList}" }`
      const result = BibtexParser(text)
      expect(result.entries.length).to.equal(2)
      expect(result.errors.length).to.equal(0)
    })
  })

  describe('boundary sweep near the truncation cap', function () {
    // Regression safety net for a planned refactor that will cap
    // PARSETMP_.Value while parsing (to bound memory on huge fields)
    // instead of only truncating once the value is complete. That refactor
    // touches the escape/verbatim-brace detection this suite exercises, so
    // these tests pin the exact current output at many cap offsets before
    // the change, using a helper that mirrors processEntry_'s brace/
    // backslash stripping (bib2json.js) rather than trusting the parser to
    // grade its own homework.
    const MAX_FIELD_VALUE_LENGTH = 1000 * 20

    function stripBracesAndBackslashes(raw: string): string {
      let result = ''
      for (let i = 0; i < raw.length; i++) {
        let c = raw[i]
        if (c === '\\' && i < raw.length - 1) {
          c = raw[++i]
        } else if (c === '{' || c === '}') {
          continue
        }
        result += c
      }
      return result
    }

    // decoded from the "handles one backslash {\}" fixture above
    const oneBackslash = '{\\}{A} \\\\very \\{{Big} \\"Book\\".'
    // decoded from the "handles two backslashes {\\}" fixture above -
    // exercises the doubleSlash branch that the single-backslash case doesn't
    const twoBackslashes = '{\\\\}{A} \\\\very \\{{Big} \\"Book\\".'

    function checkTruncationAtOffset(rawSpecial: string, k: number) {
      it(`truncates correctly when the cap lands ${k} chars into the sequence`, function () {
        const paddingLen = MAX_FIELD_VALUE_LENGTH - k
        const value = 'A'.repeat(paddingLen) + rawSpecial
        const expectedTitle = stripBracesAndBackslashes(
          value.slice(0, MAX_FIELD_VALUE_LENGTH)
        )
        const text =
          `@article{ first, title="${value}", year="2024" }` +
          '@article{ second, title={Second} }'
        const result = BibtexParser(text)
        expect(result.entries.length).to.equal(2)
        expect(result.errors.length).to.equal(0)
        expect(result.entries[0].Fields.title).to.equal(expectedTitle)
        expect(result.entries[0].Fields.year).to.equal('2024')
        expect(result.entries[1].Fields.title).to.equal('Second')
      })
    }

    ;[0, 1, 2, 3, 9, 16, 23, 31].forEach(k =>
      checkTruncationAtOffset(oneBackslash, k)
    )
    ;[0, 1, 2, 3, 4, 10, 17].forEach(k =>
      checkTruncationAtOffset(twoBackslashes, k)
    )
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
