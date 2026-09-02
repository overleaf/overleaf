import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { Readable } from 'node:stream'
import { Blob } from 'overleaf-editor-core'

const modulePath = '../../../../app/src/Features/History/HistoryBlobStore.mjs'

const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

describe('HistoryBlobStore', function () {
  beforeEach(async function (ctx) {
    ctx.HistoryManager = {
      promises: { requestBlob: sinon.stub() },
    }
    vi.doMock(
      '../../../../app/src/Features/History/HistoryManager.mjs',
      () => ({
        default: ctx.HistoryManager,
      })
    )

    const HistoryBlobStore = (await import(modulePath)).default
    ctx.blobStore = new HistoryBlobStore('history-id')
  })

  describe('getString', function () {
    it('reads the blob of the given hash', async function (ctx) {
      ctx.HistoryManager.promises.requestBlob.resolves({
        stream: Readable.from(['hello ', 'world']),
      })

      expect(await ctx.blobStore.getString(HASH)).to.equal('hello world')
      expect(ctx.HistoryManager.promises.requestBlob).to.have.been.calledWith(
        'history-id',
        HASH
      )
    })

    it('passes on errors from history', async function (ctx) {
      ctx.HistoryManager.promises.requestBlob.rejects(new Error('boom'))

      await expect(ctx.blobStore.getString(HASH)).to.be.rejectedWith('boom')
    })

    it('answers the hash of empty content without asking history', async function (ctx) {
      // Nothing is stored under it, so history-v1 answers it without a lookup of its
      // own: the round-trip to ask can only be slow or fail.
      ctx.HistoryManager.promises.requestBlob.resolves({
        stream: Readable.from(['fetched from history-v1']),
      })

      expect(await ctx.blobStore.getString(Blob.EMPTY_HASH)).to.equal('')
    })

    it('answers the hash of empty content when history is down', async function (ctx) {
      ctx.HistoryManager.promises.requestBlob.rejects(new Error('boom'))

      expect(await ctx.blobStore.getString(Blob.EMPTY_HASH)).to.equal('')
    })
  })

  describe('getObject', function () {
    it('parses the blob of the given hash as JSON', async function (ctx) {
      ctx.HistoryManager.promises.requestBlob.resolves({
        stream: Readable.from(['{"comments":[]}']),
      })

      expect(await ctx.blobStore.getObject(HASH)).to.deep.equal({
        comments: [],
      })
    })
  })
})
