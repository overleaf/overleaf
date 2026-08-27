// @ts-check
'use strict'

const { expect } = require('chai')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Readable } = require('node:stream')

const {
  blobHashFromString,
  blobHashFromBuffer,
  blobHashFromStream,
  blobHashFromFile,
  getStringLengthOfBuffer,
  getStringLengthOfFile,
  blobForFile,
} = require('../../lib/blob_utils')
const Blob = require('../../lib/blob')
const File = require('../../lib/file')
const TextOperation = require('../../lib/operation/text_operation')

// `git hash-object` output for the same content.
const HELLO_WORLD = 'hello world\n'
const HELLO_WORLD_HASH = '3b18e512dba79e4c8300dd08aeb37f8e728b8dad'
const EMPTY_HASH = 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'

describe('blob utils', function () {
  /** @type {string} */
  let tmpDir

  beforeEach(async function () {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'blob-hash-'))
  })

  afterEach(async function () {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  /**
   * @param {string | Buffer} content
   * @return {Promise<string>}
   */
  async function writeFile(content) {
    const pathname = path.join(tmpDir, 'file')
    await fs.promises.writeFile(pathname, content)
    return pathname
  }

  /**
   * chai 3 has no chai-as-promised here.
   *
   * @param {Promise<unknown>} promise
   * @return {Promise<Error>}
   */
  async function rejection(promise) {
    try {
      await promise
    } catch (err) {
      return /** @type {Error} */ (err)
    }
    throw new Error('expected the promise to reject')
  }

  describe('blobHashFromString', function () {
    it('produces the git blob hash of the string', function () {
      expect(blobHashFromString(HELLO_WORLD)).to.equal(HELLO_WORLD_HASH)
    })

    it('produces the empty file hash for the empty string', function () {
      expect(blobHashFromString('')).to.equal(EMPTY_HASH)
      expect(blobHashFromString('')).to.equal(File.EMPTY_FILE_HASH)
    })

    it('hashes the utf8 bytes of the string', function () {
      // 'héllo\n' is 7 bytes in utf8 and 6 characters, so a hash over the
      // string length would not match git.
      expect(blobHashFromString('héllo\n')).to.equal(
        '5fb50d3c93474f139362304b663fe44e9d17a26e'
      )
    })

    // The shas real GitHub reported for these strings, recorded in
    // services/github-sync/test/acceptance/js/ExportingAProject.test.js. They are
    // the whole premise of pushing a history snapshot to GitHub without
    // re-uploading blobs: the hash history stores is the sha GitHub has.
    it('agrees with the shas GitHub reported for an exported project', function () {
      expect(blobHashFromString('Hello world')).to.equal(
        '70c379b63ffa0795fdbfbc128e5a2818397b7ef8'
      )
      expect(blobHashFromString('Chapter 1 content')).to.equal(
        'ae3a11ab13155c7d114fa05590a1c1e23b1c0913'
      )
      expect(blobHashFromString('Chapter 2 content')).to.equal(
        '6986b1ac5bf8e4aa890b57b71c1d215f8f9a27e5'
      )
      expect(blobHashFromString('')).to.equal(
        'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391'
      )
    })
  })

  describe('blobHashFromBuffer', function () {
    it('produces the git blob hash of the content', function () {
      expect(blobHashFromBuffer(Buffer.from(HELLO_WORLD))).to.equal(
        HELLO_WORLD_HASH
      )
    })

    it('produces the empty file hash for an empty buffer', function () {
      expect(blobHashFromBuffer(Buffer.alloc(0))).to.equal(EMPTY_HASH)
    })

    it('agrees with blobHashFromString for multi-byte characters', function () {
      const content = 'héllo wörld\n'
      expect(blobHashFromBuffer(Buffer.from(content))).to.equal(
        blobHashFromString(content)
      )
    })

    it('hashes bytes that are not text', function () {
      expect(
        blobHashFromBuffer(Buffer.from([0x00, 0x01, 0xff, 0xfe]))
      ).to.equal('ad2f38543fc2bba3468a77f36137c23378420463')
    })
  })

  describe('blobHashFromStream', function () {
    it('produces the git blob hash of the content', async function () {
      const content = Buffer.from(HELLO_WORLD)
      expect(
        await blobHashFromStream(content.byteLength, Readable.from([content]))
      ).to.equal(HELLO_WORLD_HASH)
    })

    it('agrees with blobHashFromString across chunk boundaries', async function () {
      const content = 'x'.repeat(128 * 1024) + 'end\n'
      expect(
        await blobHashFromStream(
          Buffer.byteLength(content),
          Readable.from([Buffer.from(content)])
        )
      ).to.equal(blobHashFromString(content))
    })

    it('rejects a byte length that is not an integer', async function () {
      // The header would read "blob NaN\0" and the digest would look like a
      // hash rather than like a failure.
      const err = await rejection(
        blobHashFromStream(
          // @ts-expect-error deliberately bad input
          undefined,
          Readable.from([Buffer.from(HELLO_WORLD)])
        )
      )
      expect(err).to.be.an.instanceof(TypeError)
    })
  })

  describe('blobHashFromFile', function () {
    it('produces the git blob hash of the file content', async function () {
      const pathname = await writeFile(HELLO_WORLD)
      expect(await blobHashFromFile(pathname)).to.equal(HELLO_WORLD_HASH)
    })

    it('produces the empty file hash for an empty file', async function () {
      const pathname = await writeFile('')
      expect(await blobHashFromFile(pathname)).to.equal(EMPTY_HASH)
    })

    it('agrees with blobHashFromString for multi-byte characters', async function () {
      const content = 'héllo wörld\n'
      const pathname = await writeFile(content)
      expect(await blobHashFromFile(pathname)).to.equal(
        blobHashFromString(content)
      )
    })

    it('agrees with blobHashFromString for content larger than one chunk', async function () {
      const content = 'x'.repeat(128 * 1024) + 'end\n'
      const pathname = await writeFile(content)
      expect(await blobHashFromFile(pathname)).to.equal(
        blobHashFromString(content)
      )
    })

    it('hashes binary content', async function () {
      const pathname = await writeFile(Buffer.from([0x00, 0x01, 0xff, 0xfe]))
      expect(await blobHashFromFile(pathname)).to.equal(
        'ad2f38543fc2bba3468a77f36137c23378420463'
      )
    })

    it('rejects when the file is missing', async function () {
      const err = await rejection(
        blobHashFromFile(path.join(tmpDir, 'does-not-exist'))
      )
      expect(err).to.have.property('code', 'ENOENT')
    })
  })
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
  describe('blobForFile', function () {
    it('describes an editable file', async function () {
      const pathname = await writeFile(HELLO_WORLD)

      const blob = await blobForFile(pathname)

      expect(blob.getHash()).to.equal(HELLO_WORLD_HASH)
      expect(blob.getByteLength()).to.equal(HELLO_WORLD.length)
      expect(blob.getStringLength()).to.equal(HELLO_WORLD.length)
    })

    it('counts characters rather than bytes for multi-byte UTF-8', async function () {
      const content = 'ol\u00e9\n'
      const pathname = await writeFile(content)

      const blob = await blobForFile(pathname)

      expect(blob.getByteLength()).to.equal(5)
      expect(blob.getStringLength()).to.equal(4)
    })

    it('leaves the string length off a file that is not editable text', async function () {
      // What tells history to hold the content as a file rather than as a doc.
      const pathname = await writeFile(Buffer.from([0xff, 0xfe, 0x00]))

      const blob = await blobForFile(pathname)

      expect(blob.getStringLength()).to.be.undefined
      expect(blob.getByteLength()).to.equal(3)
    })

    it('describes an empty file', async function () {
      const pathname = await writeFile('')

      const blob = await blobForFile(pathname)

      expect(blob.getHash()).to.equal(File.EMPTY_FILE_HASH)
      expect(blob.getByteLength()).to.equal(0)
      expect(blob.getStringLength()).to.equal(0)
    })

    it('rejects when the file is missing', async function () {
      const err = await rejection(
        blobForFile(path.join(tmpDir, 'does-not-exist'))
      )
      expect(err).to.have.property('code', 'ENOENT')
    })
  })
})
