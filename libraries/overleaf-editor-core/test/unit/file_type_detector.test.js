// @ts-check
'use strict'

const { expect } = require('chai')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  needsContent,
  detectBuffer,
  detectFile,
} = require('../../lib/file_type_detector')

// Small enough to exercise the size and length limits with tiny fixtures.
const MAX_DOC_LENGTH = 32

/** @type {import('../../lib/file_type_detector').FileTypeConfig} */
const CONFIG = {
  textExtensions: ['tex', 'txt'],
  editableFilenames: ['latexmkrc', '.latexmkrc', 'makefile'],
  maxDocLength: MAX_DOC_LENGTH,
}

describe('file type detector', function () {
  /** @type {string} */
  let tmpDir

  beforeEach(async function () {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'file-type-detector-')
    )
  })

  afterEach(async function () {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  /**
   * The two entry points have to agree on every row of the table, so each case
   * below runs through both: detectFile with the content spooled to disk, and
   * detectBuffer with it in memory.
   *
   * @param {string | Buffer} bytes
   * @param {string} pathname
   * @param {import('../../lib/file_type_detector').ExistingType} existingType
   * @return {Promise<import('../../lib/file_type_detector').DetectedType>}
   */
  async function detect(bytes, pathname, existingType) {
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
    const localPath = path.join(tmpDir, 'spooled')
    await fs.promises.writeFile(localPath, buffer)

    const fromFile = await detectFile(pathname, localPath, existingType, CONFIG)
    const fromBuffer = detectBuffer(buffer, { pathname, existingType }, CONFIG)
    expect(fromBuffer).to.deep.equal(fromFile)
    return fromFile
  }

  describe('the filename', function () {
    it('accepts a listed extension', async function () {
      expect(await detect('hello', 'dir/main.tex', null)).to.deep.equal({
        kind: 'text',
        content: 'hello',
      })
    })

    it('accepts a listed extension in upper case', async function () {
      expect(await detect('hello', 'MAIN.TeX', null)).to.have.property(
        'kind',
        'text'
      )
    })

    it('rejects an extension that is not listed', async function () {
      expect(await detect('hello', 'main.png', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('accepts a name from the editable filenames list', async function () {
      expect(await detect('hello', 'dir/Makefile', null)).to.have.property(
        'kind',
        'text'
      )
    })

    it('skips the name check for a file that is already a doc', async function () {
      expect(await detect('hello', 'main.png', 'doc')).to.have.property(
        'kind',
        'text'
      )
    })

    it('still applies the name check for a file that is not a doc', async function () {
      expect(await detect('hello', 'main.png', 'file')).to.deep.equal({
        kind: 'binary',
      })
    })

    it('keeps a binary file binary at a text pathname', async function () {
      expect(await detect('hello', 'main.tex', 'file')).to.deep.equal({
        kind: 'binary',
      })
    })
  })

  describe('the content', function () {
    it('rejects a file that is too large to be worth reading', async function () {
      const bytes = 'a'.repeat(3 * MAX_DOC_LENGTH + 1)
      expect(await detect(bytes, 'main.tex', 'doc')).to.deep.equal({
        kind: 'binary',
      })
    })

    it('rejects content at the character limit', async function () {
      const bytes = 'a'.repeat(MAX_DOC_LENGTH)
      expect(await detect(bytes, 'main.tex', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('accepts content just below the character limit', async function () {
      const bytes = 'a'.repeat(MAX_DOC_LENGTH - 1)
      expect(await detect(bytes, 'main.tex', null)).to.have.property(
        'kind',
        'text'
      )
    })

    it('rejects content with a NUL byte', async function () {
      const bytes = Buffer.from('ab\u0000cd', 'utf8')
      expect(await detect(bytes, 'main.tex', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('rejects bytes that encode a lone surrogate', async function () {
      // U+D800, an unpaired high surrogate, in the three-byte form a UTF-8
      // encoder would use for it.
      const bytes = Buffer.from([0xed, 0xa0, 0x80])
      expect(await detect(bytes, 'main.tex', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('rejects a character outside the basic multilingual plane', async function () {
      // Valid UTF-8 can only ever produce surrogates in pairs, so this row is
      // caught whether the rule tests high surrogates or both halves. The wider
      // range matters for content decoded as UTF-16, which web does and this
      // module does not — see the note in the module header.
      const bytes = Buffer.from('a\u{1F600}b', 'utf8')
      expect(await detect(bytes, 'main.tex', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('rejects little-endian utf-16 announced by a byte order mark', async function () {
      // A byte order mark followed by "hi": text a reader can make sense of,
      // which still cannot be stored as text without losing the bytes.
      const bytes = Buffer.from([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00])
      expect(await detect(bytes, 'main.tex', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('rejects bytes that are not valid utf-8', async function () {
      // Every byte here stands for a printable latin1 character, so the encoding
      // is the only thing that makes this a binary file.
      const bytes = Buffer.from([0x68, 0xe9, 0x69])
      expect(await detect(bytes, 'main.tex', null)).to.deep.equal({
        kind: 'binary',
      })
    })

    it('accepts multi-byte utf-8', async function () {
      expect(
        await detect(Buffer.from('héi', 'utf8'), 'main.tex', null)
      ).to.deep.equal({ kind: 'text', content: 'héi' })
    })

    it('accepts an empty file', async function () {
      expect(await detect('', 'main.tex', null)).to.deep.equal({
        kind: 'text',
        content: '',
      })
    })
  })

  describe('needsContent', function () {
    it('is false for an existing binary file', function () {
      expect(needsContent('main.tex', 10, 'file', CONFIG)).to.equal(false)
    })

    it('is false for a name that cannot hold text', function () {
      expect(needsContent('main.png', 10, null, CONFIG)).to.equal(false)
    })

    it('is true for a name that cannot hold text but is already a doc', function () {
      expect(needsContent('main.png', 10, 'doc', CONFIG)).to.equal(true)
    })

    it('is false above three times the character limit', function () {
      expect(
        needsContent('main.tex', 3 * MAX_DOC_LENGTH + 1, null, CONFIG)
      ).to.equal(false)
    })

    it('is true at three times the character limit', function () {
      expect(
        needsContent('main.tex', 3 * MAX_DOC_LENGTH, null, CONFIG)
      ).to.equal(true)
    })

    it('skips the size gate when the size is not known', function () {
      expect(needsContent('main.tex', null, null, CONFIG)).to.equal(true)
    })
  })

  describe('the config', function () {
    it('rejects a config without a document length', function () {
      // Every length comparison against undefined is false, which reads as "no
      // limit" rather than as a misconfiguration.
      expect(() =>
        needsContent(
          'main.tex',
          10,
          null,
          // @ts-expect-error deliberately bad input
          { textExtensions: [], editableFilenames: [] }
        )
      ).to.throw(TypeError)
    })

    it('rejects a config without the extension lists', function () {
      expect(() =>
        needsContent(
          'main.tex',
          10,
          null,
          // @ts-expect-error deliberately bad input
          { maxDocLength: MAX_DOC_LENGTH }
        )
      ).to.throw(TypeError)
    })
  })
})
