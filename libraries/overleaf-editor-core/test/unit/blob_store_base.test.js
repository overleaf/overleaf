'use strict'

const { expect } = require('chai')

const { Blob, BlobStoreBase } = require('../..')

class TestBlobStore extends BlobStoreBase {
  constructor(contentByHash = {}) {
    super()
    this.contentByHash = contentByHash
    this.fetched = []
  }

  async fetchString(hash) {
    this.fetched.push(hash)
    if (!(hash in this.contentByHash)) {
      throw new Error(`nothing stored under ${hash}`)
    }
    return this.contentByHash[hash]
  }
}

const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

describe('BlobStoreBase', function () {
  describe('getString', function () {
    it('fetches the content of a hash something stored', async function () {
      const blobStore = new TestBlobStore({ [HASH]: 'hello world' })

      expect(await blobStore.getString(HASH)).to.equal('hello world')
      expect(blobStore.fetched).to.deep.equal([HASH])
    })

    it('answers the hash of empty content without fetching', async function () {
      // The store below has nothing stored under it and throws when asked, which is
      // the point: the hash says what the content is, so no store has to be asked.
      const blobStore = new TestBlobStore()

      expect(await blobStore.getString(Blob.EMPTY_HASH)).to.equal('')
      expect(blobStore.fetched).to.have.length(0)
    })

    it('passes on what the implementation throws', async function () {
      const blobStore = new TestBlobStore()

      try {
        await blobStore.getString(HASH)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.equal(`nothing stored under ${HASH}`)
      }
    })
  })

  describe('getObject', function () {
    it('deserializes the content of the hash', async function () {
      const blobStore = new TestBlobStore({
        [HASH]: '{"comments":[],"trackedChanges":[]}',
      })

      expect(await blobStore.getObject(HASH)).to.deep.equal({
        comments: [],
        trackedChanges: [],
      })
    })

    it('fails on the hash of empty content, which is not JSON', async function () {
      // Nothing writes an empty ranges blob -- JSON.stringify never yields empty
      // content -- so a hash reaching here is one something stored.
      const blobStore = new TestBlobStore()

      try {
        await blobStore.getObject(Blob.EMPTY_HASH)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).to.be.an.instanceof(SyntaxError)
      }
    })
  })

  describe('fetchString', function () {
    it('names the store that has not implemented it', async function () {
      class IncompleteBlobStore extends BlobStoreBase {}

      try {
        await new IncompleteBlobStore().getString(HASH)
        expect.fail('should have thrown')
      } catch (err) {
        expect(err.message).to.equal(
          'IncompleteBlobStore does not implement fetchString(hash)'
        )
      }
    })
  })
})
