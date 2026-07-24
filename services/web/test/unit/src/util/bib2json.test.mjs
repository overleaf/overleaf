import { describe, expect, it } from 'vitest'
import BibtexParser from '../../../../app/src/util/bib2json.js'

describe('bib2json', function () {
  // Server-side parser used by Write & Cite / Zotero / ReadCube sync
  // (services/web/modules/tpr-webmodule). overleaf/internal#24246: an
  // oversized field is now truncated instead of dropping the whole entry.
  const MAX_FIELD_VALUE_LENGTH = 1000 * 20

  it('parses a simple entry', function () {
    const result = BibtexParser('@book{ pollock, title={A Book} }')
    expect(result.entries.length).to.equal(1)
    expect(result.errors.length).to.equal(0)
    expect(result.entries[0].Fields.title).to.equal('A Book')
  })

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
    expect(result.entries[1].Fields.title).to.equal('Second')
    expect(result.entries[1].Fields.author).to.equal('Doe, Jane')
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

  describe('boundary sweep near the truncation cap', function () {
    // Regression safety net for a planned refactor that will cap
    // PARSETMP_.Value while parsing (to bound memory on huge fields)
    // instead of only truncating once the value is complete. That refactor
    // touches the escape/verbatim-brace detection this suite exercises, so
    // these tests pin the exact current output at many cap offsets before
    // the change, using a helper that mirrors processEntry_'s brace/
    // backslash stripping (bib2json.js) rather than trusting the parser to
    // grade its own homework.
    function stripBracesAndBackslashes(raw) {
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

    // decoded from the "one backslash {\}" style fixture in the frontend spec
    const oneBackslash = '{\\}{A} \\\\very \\{{Big} \\"Book\\".'
    // decoded from the "two backslashes {\\}" style fixture - exercises the
    // doubleSlash branch that the single-backslash case doesn't
    const twoBackslashes = '{\\\\}{A} \\\\very \\{{Big} \\"Book\\".'

    function checkTruncationAtOffset(rawSpecial, k) {
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
})
