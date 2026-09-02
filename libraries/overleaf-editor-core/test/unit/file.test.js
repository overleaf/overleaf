'use strict'

const { expect } = require('chai')
const FakeBlobStore = require('./support/fake_blob_store')
const ot = require('../..')
const File = ot.File
const Blob = ot.Blob

describe('File', function () {
  it('can have attached metadata', function () {
    // no metadata
    let file = File.fromString('foo')
    expect(file.getMetadata()).to.eql({})

    // metadata passed in at construction time (the main-file marker written
    // by the v1 history import)
    file = File.fromString('foo', { main: true })
    expect(file.getMetadata()).to.eql({ main: true })

    // metadata set at runtime
    /** @type {import('../../lib/types').FileMetadata} */
    const linkedFileMetadata = {
      provider: 'project_file',
      source_project_id: '507f1f77bcf86cd799439011',
      source_entity_path: '/foo.bib',
      importedAt: '2024-08-05T11:53:34.532Z',
    }
    file.setMetadata(linkedFileMetadata)
    expect(file.getMetadata()).to.eql(linkedFileMetadata)
  })

  describe('toRaw', function () {
    it('returns non-empty metadata', function () {
      const metadata = { main: true }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      expect(file.toRaw()).to.eql({
        hash: File.EMPTY_FILE_HASH,
        metadata,
      })

      file.setMetadata({})
      expect(file.toRaw()).to.eql({ hash: File.EMPTY_FILE_HASH })
    })

    it('returns a deep clone of metadata', function () {
      /** @type {import('../../lib/types').FileMetadata} */
      const metadata = {
        provider: 'url',
        url: 'https://example.com/foo.bib',
        importedAt: '2024-08-05T11:53:34.532Z',
      }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      const raw = file.toRaw()
      const fileMetadata = file.getMetadata()
      const rawMetadata = raw.metadata
      expect(rawMetadata).not.to.equal(fileMetadata)
      expect(rawMetadata).to.deep.equal(fileMetadata)
    })
  })

  describe('store', function () {
    it('does not return empty metadata', async function () {
      const file = File.fromHash(File.EMPTY_FILE_HASH)
      const fakeBlobStore = new FakeBlobStore()
      const raw = await file.store(fakeBlobStore)
      expect(raw).to.eql({ hash: File.EMPTY_FILE_HASH })
    })

    it('returns non-empty metadata', async function () {
      const metadata = { main: true }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      const fakeBlobStore = new FakeBlobStore()
      const raw = await file.store(fakeBlobStore)
      expect(raw).to.eql({
        hash: File.EMPTY_FILE_HASH,
        metadata,
      })
    })

    it('returns a deep clone of metadata', async function () {
      const metadata = { externalFile: { id: 123 } }
      const file = File.fromHash(File.EMPTY_FILE_HASH, undefined, metadata)
      const fakeBlobStore = new FakeBlobStore()
      const raw = await file.store(fakeBlobStore)
      raw.metadata.externalFile.id = 456
      expect(file.getMetadata().externalFile.id).to.equal(123)
    })
  })

  describe('with string data', function () {
    it('can be created from a string', function () {
      const file = File.fromString('foo')
      expect(file.getContent()).to.equal('foo')
    })
  })

  describe('loadEager', function () {
    const HASH = 'a'.repeat(40)

    /**
     * A store of blobs named by what they hold. A blob with no string length is
     * what history stores content it cannot hold as a doc under.
     *
     * @param {Record<string, {content: string, stringLength?: number}>} blobs
     */
    function blobStoreOf(blobs) {
      return {
        async getBlob(hash) {
          const blob = blobs[hash]
          if (blob == null) return null
          return new Blob(
            hash,
            Buffer.byteLength(blob.content),
            blob.stringLength
          )
        },
        async getString(hash) {
          const blob = blobs[hash]
          if (blob == null) throw new Error(`no blob: ${hash}`)
          return blob.content
        },
        async getObject(hash) {
          return JSON.parse(await this.getString(hash))
        },
      }
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
        return err
      }
      throw new Error('expected the promise to reject')
    }

    it('answers with the data holding the content', async function () {
      // What the caller gets is the kind of data that has content, rather than
      // the file it has to ask again and handle a null from.
      const file = File.fromHash(HASH, undefined, undefined, 'hello'.length)

      const data = await file.loadEager(
        blobStoreOf({ [HASH]: { content: 'hello', stringLength: 5 } })
      )

      expect(data.getContent()).to.equal('hello')
      expect(file.getContent()).to.equal('hello')
    })

    it('answers with the data of a file that already has its content', async function () {
      const file = File.fromString('foo')

      const data = await file.loadEager(new FakeBlobStore())

      expect(data.getContent()).to.equal('foo')
    })

    it('refuses a file that is not an editable doc', async function () {
      // Bytes history addresses by hash: there is no content to answer with.
      const file = File.fromHash(HASH)

      const err = await rejection(
        file.loadEager(blobStoreOf({ [HASH]: { content: 'hello' } }))
      )

      expect(err).to.be.an.instanceof(File.NotEditableError)
    })
  })

  describe('with hollow string data', function () {
    it('can be cloned', function () {
      const file = File.createHollow(null, 0)
      expect(file.getStringLength()).to.equal(0)
      const clone = file.clone()
      expect(clone.getStringLength()).to.equal(0)
    })
  })

  it('getComments() returns an empty comment list', function () {
    const file = File.fromString('foo')
    expect(file.getComments().toRaw()).to.eql([])
  })
})
