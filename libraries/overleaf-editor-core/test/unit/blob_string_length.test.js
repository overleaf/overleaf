// @ts-check
'use strict'

const { expect } = require('chai')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const {
  getStringLengthOfBuffer,
  getStringLengthOfFile,
} = require('../../lib/blob_string_length')
const Blob = require('../../lib/blob')
const TextOperation = require('../../lib/operation/text_operation')

describe('blob string length', function () {
  /** @type {string} */
  let tmpDir

  beforeEach(async function () {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'blob-string-length-')
    )
  })

  afterEach(async function () {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  /**
   * @param {Buffer} content
   * @return {Promise<string>}
   */
  async function writeFile(content) {
    const pathname = path.join(tmpDir, 'blob')
    await fs.promises.writeFile(pathname, content)
    return pathname
  }

  describe('getStringLengthOfBuffer', function () {
    it('counts the characters of plain ASCII', function () {
      expect(getStringLengthOfBuffer(Buffer.from('hello'))).to.equal(5)
    })

    it('counts characters rather than bytes for multi-byte UTF-8', function () {
      // 'é' is two bytes, 'ᚠ' is three.
      const buffer = Buffer.from('héllᚠ')
      expect(buffer.byteLength).to.equal(8)
      expect(getStringLengthOfBuffer(buffer)).to.equal(5)
    })

    it('rejects bytes that are not valid UTF-8', function () {
      // 0x80 is a continuation byte with nothing to continue.
      expect(getStringLengthOfBuffer(Buffer.from([0x61, 0x80, 0x62]))).to.be
        .null
    })

    it('rejects a NUL character', function () {
      expect(getStringLengthOfBuffer(Buffer.from('a\0b'))).to.be.null
    })

    it('rejects non-BMP characters', function () {
      expect(getStringLengthOfBuffer(Buffer.from('a 🙂 face'))).to.be.null
    })

    it('rejects content longer than a text operation can hold', function () {
      const content = 'a'.repeat(TextOperation.MAX_STRING_LENGTH + 1)
      expect(getStringLengthOfBuffer(Buffer.from(content))).to.be.null
    })

    it('accepts content at the maximum length', function () {
      const content = 'a'.repeat(TextOperation.MAX_STRING_LENGTH)
      expect(getStringLengthOfBuffer(Buffer.from(content))).to.equal(
        TextOperation.MAX_STRING_LENGTH
      )
    })
  })

  describe('getStringLengthOfFile', function () {
    it('counts the characters of an editable file', async function () {
      const content = Buffer.from('héllᚠ')
      const pathname = await writeFile(content)
      expect(
        await getStringLengthOfFile(content.byteLength, pathname)
      ).to.equal(5)
    })

    it('rejects a file that is not editable text', async function () {
      const content = Buffer.from([0x61, 0x00, 0x62])
      const pathname = await writeFile(content)
      expect(await getStringLengthOfFile(content.byteLength, pathname)).to.be
        .null
    })

    it('does not read a file too large to be editable', async function () {
      // A pathname that cannot be read at all: reaching the read would throw.
      const result = await getStringLengthOfFile(
        Blob.MAX_EDITABLE_BYTE_LENGTH_BOUND + 1,
        path.join(tmpDir, 'does-not-exist')
      )
      expect(result).to.be.null
    })
  })
})
