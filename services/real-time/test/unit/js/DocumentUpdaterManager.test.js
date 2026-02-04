// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { expect, vi, describe, beforeEach, it, afterEach } from 'vitest'
import _ from 'lodash'
const modulePath = '../../../app/js/DocumentUpdaterManager'

describe('DocumentUpdaterManager', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-923'
    ctx.doc_id = 'doc-id-394'
    ctx.lines = ['one', 'two', 'three']
    ctx.version = 42
    ctx.settings = {
      apis: { documentupdater: { url: 'http://doc-updater.example.com' } },
      redis: {
        documentupdater: {
          key_schema: {
            pendingUpdates({ doc_id: docId }) {
              return `PendingUpdates:${docId}`
            },
          },
        },
      },
      maxUpdateSize: 7 * 1024 * 1024,
      pendingUpdateListShardCount: 10,
    }
    ctx.rclient = { auth() {} }
    ctx.fetchJson = sinon.stub()
    ctx.fetchNothing = sinon.stub()
    ctx.RequestFailedError = class RequestFailedError extends Error {
      constructor(message, url, options, response, body) {
        super(message)
        this.url = url
        this.options = options
        this.response = response
        this.body = body
      }
    }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ({
      fetchJson: ctx.fetchJson,
      fetchNothing: ctx.fetchNothing,
      RequestFailedError: ctx.RequestFailedError,
    }))

    vi.doMock('@overleaf/redis-wrapper', () => ({
      default: { createClient: () => ctx.rclient },
    }))

    class Timer {
      done() {}
    }

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = {
        summary: sinon.stub(),
        Timer,
      }),
    }))

    ctx.DocumentUpdaterManager = (await import(modulePath)).default
  }) // avoid modifying JSON object directly

  describe('getDocument', function () {
    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.body = {
          lines: ctx.lines,
          version: ctx.version,
          ops: (ctx.ops = ['mock-op-1', 'mock-op-2']),
          ranges: (ctx.ranges = { mock: 'ranges' }),
        }
        ctx.fromVersion = 2
        ctx.fetchJson.resolves(ctx.body)
        ctx.result = await ctx.DocumentUpdaterManager.promises.getDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.fromVersion
        )
      })

      it('should get the document from the document updater', function (ctx) {
        const url = `${ctx.settings.apis.documentupdater.url}/project/${ctx.project_id}/doc/${ctx.doc_id}?fromVersion=${ctx.fromVersion}&historyOTSupport=true`
        ctx.fetchJson.calledWith(url).should.equal(true)
      })

      it('should return the lines, version, ranges and ops', function (ctx) {
        ctx.result.lines.should.deep.equal(ctx.lines)
        ctx.result.version.should.equal(ctx.version)
        ctx.result.ranges.should.deep.equal(ctx.ranges)
        ctx.result.ops.should.deep.equal(ctx.ops)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.error = new Error('something went wrong')
        ctx.fetchJson.rejects(ctx.error)
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.getDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.fromVersion
          )
        ).to.be.rejectedWith(ctx.error)
      })
    })
    ;[404, 422].forEach(statusCode =>
      describe(`when the document updater returns a ${statusCode} status code`, function () {
        beforeEach(function (ctx) {
          const error = new ctx.RequestFailedError(
            'error',
            'url',
            {},
            { status: statusCode },
            null
          )
          ctx.fetchJson.rejects(error)
        })

        it('should throw an error with the status code', async function (ctx) {
          const error = await expect(
            ctx.DocumentUpdaterManager.promises.getDocument(
              ctx.project_id,
              ctx.doc_id,
              ctx.fromVersion
            )
          ).to.be.rejected
          error.message.should.equal('doc updater could not load requested ops')
          error.info.statusCode.should.equal(statusCode)
          ctx.logger.error.called.should.equal(false)
          ctx.logger.warn.called.should.equal(false)
        })
      })
    )

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        const error = new ctx.RequestFailedError(
          'error',
          'url',
          {},
          { status: 500 },
          null
        )
        ctx.fetchJson.rejects(error)
      })

      it('should throw an error', async function (ctx) {
        const error = await expect(
          ctx.DocumentUpdaterManager.promises.getDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.fromVersion
          )
        ).to.be.rejected
        error.message.should.equal(
          'doc updater returned a non-success status code'
        )
        error.info.action.should.equal('getDocument')
        error.info.statusCode.should.equal(500)
        ctx.logger.error.called.should.equal(false)
      })
    })
  })

  describe('flushProjectToMongoAndDelete', function () {
    describe('successfully', function () {
      beforeEach(async function (ctx) {
        ctx.fetchNothing.resolves()
        await ctx.DocumentUpdaterManager.promises.flushProjectToMongoAndDelete(
          ctx.project_id
        )
      })

      it('should delete the project from the document updater', function (ctx) {
        const url = `${ctx.settings.apis.documentupdater.url}/project/${ctx.project_id}?background=true`
        ctx.fetchNothing
          .calledWith(url, { method: 'DELETE' })
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.error = new Error('something went wrong')
        ctx.fetchNothing.rejects(ctx.error)
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.flushProjectToMongoAndDelete(
            ctx.project_id
          )
        ).to.be.rejectedWith(ctx.error)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        const error = new ctx.RequestFailedError(
          'error',
          'url',
          {},
          { status: 500 },
          null
        )
        ctx.fetchNothing.rejects(error)
      })

      it('should throw an error', async function (ctx) {
        const error = await expect(
          ctx.DocumentUpdaterManager.promises.flushProjectToMongoAndDelete(
            ctx.project_id
          )
        ).to.be.rejected
        error.message.should.equal(
          'doc updater returned a non-success status code'
        )
        error.info.action.should.equal('flushProjectToMongoAndDelete')
        error.info.statusCode.should.equal(500)
      })
    })
  })

  describe('queueChange', function () {
    beforeEach(function (ctx) {
      ctx.change = {
        doc: '1234567890',
        op: [{ d: 'test', p: 345 }],
        v: 789,
      }
      ctx.rclient.rpush = sinon.stub().resolves()
    })

    describe('successfully', function () {
      beforeEach(async function (ctx) {
        await ctx.DocumentUpdaterManager.promises.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change
        )
      })

      it('should push the change', function (ctx) {
        ctx.rclient.rpush
          .calledWith(
            `PendingUpdates:${ctx.doc_id}`,
            JSON.stringify(ctx.change)
          )
          .should.equal(true)
      })

      it('should notify the doc updater of the change via the pending-updates-list queue', function (ctx) {
        // The second call should be to a pending-updates-list key (either base or sharded)
        const secondCall = ctx.rclient.rpush.secondCall
        secondCall.should.exist
        const queueKey = secondCall.args[0]
        queueKey.should.match(/^pending-updates-list(-\d+)?$/)
        secondCall.args[1].should.equal(`${ctx.project_id}:${ctx.doc_id}`)
      })
    })

    describe('with error talking to redis during rpush', function () {
      beforeEach(function (ctx) {
        ctx.rclient.rpush = sinon
          .stub()
          .rejects(new Error('something went wrong'))
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.queueChange(
            ctx.project_id,
            ctx.doc_id,
            ctx.change
          )
        ).to.be.rejected
      })
    })

    describe('with null byte corruption', function () {
      beforeEach(function (ctx) {
        ctx.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
      })

      afterEach(function (ctx) {
        ctx.stringifyStub.restore()
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.queueChange(
            ctx.project_id,
            ctx.doc_id,
            ctx.change
          )
        ).to.be.rejected
      })

      it('should not push the change onto the pending-updates-list queue', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.queueChange(
            ctx.project_id,
            ctx.doc_id,
            ctx.change
          )
        ).to.be.rejected
        ctx.rclient.rpush.called.should.equal(false)
      })
    })

    describe('when the update is too large', function () {
      beforeEach(function (ctx) {
        ctx.change = {
          op: { p: 12, t: 'update is too large'.repeat(1024 * 400) },
        }
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.queueChange(
            ctx.project_id,
            ctx.doc_id,
            ctx.change
          )
        ).to.be.rejected
      })

      it('should add the size to the error', async function (ctx) {
        const error = await expect(
          ctx.DocumentUpdaterManager.promises.queueChange(
            ctx.project_id,
            ctx.doc_id,
            ctx.change
          )
        ).to.be.rejected
        error.info.updateSize.should.equal(7782422)
      })

      it('should not push the change onto the pending-updates-list queue', async function (ctx) {
        await expect(
          ctx.DocumentUpdaterManager.promises.queueChange(
            ctx.project_id,
            ctx.doc_id,
            ctx.change
          )
        ).to.be.rejected
        ctx.rclient.rpush.called.should.equal(false)
      })
    })

    describe('with invalid keys', function () {
      beforeEach(async function (ctx) {
        ctx.change = {
          op: [{ d: 'test', p: 345 }],
          version: 789, // not a valid key
        }
        await ctx.DocumentUpdaterManager.promises.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change
        )
      })

      it('should remove the invalid keys from the change', function (ctx) {
        ctx.rclient.rpush
          .calledWith(
            `PendingUpdates:${ctx.doc_id}`,
            JSON.stringify({ op: ctx.change.op })
          )
          .should.equal(true)
      })
    })
  })

  describe('_getPendingUpdateListKey', function () {
    beforeEach(function (ctx) {
      const keys = _.times(
        10000,
        ctx.DocumentUpdaterManager._getPendingUpdateListKey
      )
      ctx.keys = _.uniq(keys)
    })
    it('should return normal pending updates key', function (ctx) {
      _.includes(ctx.keys, 'pending-updates-list').should.equal(true)
    })

    it('should return pending-updates-list-n keys', function (ctx) {
      _.includes(ctx.keys, 'pending-updates-list-1').should.equal(true)
      _.includes(ctx.keys, 'pending-updates-list-3').should.equal(true)
      _.includes(ctx.keys, 'pending-updates-list-9').should.equal(true)
    })

    it('should not include pending-updates-list-0 key', function (ctx) {
      _.includes(ctx.keys, 'pending-updates-list-0').should.equal(false)
    })

    it('should not include maximum as pendingUpdateListShardCount value', function (ctx) {
      _.includes(ctx.keys, 'pending-updates-list-10').should.equal(false)
    })
  })
})
