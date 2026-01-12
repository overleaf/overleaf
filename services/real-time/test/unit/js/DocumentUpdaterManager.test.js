// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { vi, describe, beforeEach, it, afterEach } from 'vitest'
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

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('request', () => ({
      default: (ctx.request = {}),
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
    beforeEach(function (ctx) {
      ctx.callback = sinon.stub()
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.body = JSON.stringify({
          lines: ctx.lines,
          version: ctx.version,
          ops: (ctx.ops = ['mock-op-1', 'mock-op-2']),
          ranges: (ctx.ranges = { mock: 'ranges' }),
        })
        ctx.fromVersion = 2
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, ctx.body)
        ctx.DocumentUpdaterManager.getDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.fromVersion,
          ctx.callback
        )
      })

      it('should get the document from the document updater', function (ctx) {
        const url = `${ctx.settings.apis.documentupdater.url}/project/${ctx.project_id}/doc/${ctx.doc_id}?fromVersion=${ctx.fromVersion}&historyOTSupport=true`
        ctx.request.get.calledWith(url).should.equal(true)
      })

      it('should call the callback with the lines, version, ranges and ops', function (ctx) {
        ctx.callback
          .calledWith(null, ctx.lines, ctx.version, ctx.ranges, ctx.ops)
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            (ctx.error = new Error('something went wrong')),
            null,
            null
          )
        ctx.DocumentUpdaterManager.getDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.fromVersion,
          ctx.callback
        )
      })

      it('should return an error to the callback', function (ctx) {
        ctx.callback.calledWith(ctx.error).should.equal(true)
      })
    })
    ;[404, 422].forEach(statusCode =>
      describe(`when the document updater returns a ${statusCode} status code`, function () {
        beforeEach(function (ctx) {
          ctx.request.get = sinon
            .stub()
            .callsArgWith(1, null, { statusCode }, '')
          ctx.DocumentUpdaterManager.getDocument(
            ctx.project_id,
            ctx.doc_id,
            ctx.fromVersion,
            ctx.callback
          )
        })

        it('should return the callback with an error', function (ctx) {
          ctx.callback.called.should.equal(true)
          ctx.callback
            .calledWith(
              sinon.match({
                message: 'doc updater could not load requested ops',
                info: { statusCode },
              })
            )
            .should.equal(true)
          ctx.logger.error.called.should.equal(false)
          ctx.logger.warn.called.should.equal(false)
        })
      })
    )

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        ctx.DocumentUpdaterManager.getDocument(
          ctx.project_id,
          ctx.doc_id,
          ctx.fromVersion,
          ctx.callback
        )
      })

      it('should return the callback with an error', function (ctx) {
        ctx.callback.called.should.equal(true)
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'doc updater returned a non-success status code',
              info: {
                action: 'getDocument',
                statusCode: 500,
              },
            })
          )
          .should.equal(true)
        ctx.logger.error.called.should.equal(false)
      })
    })
  })

  describe('flushProjectToMongoAndDelete', function () {
    beforeEach(function (ctx) {
      ctx.callback = sinon.stub()
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should delete the project from the document updater', function (ctx) {
        const url = `${ctx.settings.apis.documentupdater.url}/project/${ctx.project_id}?background=true`
        ctx.request.del.calledWith(url).should.equal(true)
      })

      it('should call the callback with no error', function (ctx) {
        ctx.callback.calledWith(null).should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function (ctx) {
        ctx.request.del = sinon
          .stub()
          .callsArgWith(
            1,
            (ctx.error = new Error('something went wrong')),
            null,
            null
          )
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should return an error to the callback', function (ctx) {
        ctx.callback.calledWith(ctx.error).should.equal(true)
      })
    })

    describe('when the document updater returns a failure error code', function () {
      beforeEach(function (ctx) {
        ctx.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should return the callback with an error', function (ctx) {
        ctx.callback.called.should.equal(true)
        ctx.callback
          .calledWith(
            sinon.match({
              message: 'doc updater returned a non-success status code',
              info: {
                action: 'flushProjectToMongoAndDelete',
                statusCode: 500,
              },
            })
          )
          .should.equal(true)
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
      ctx.rclient.rpush = sinon.stub().yields()
      ctx.callback = sinon.stub()
    })

    describe('successfully', function () {
      beforeEach(function (ctx) {
        ctx.pendingUpdateListKey = `pending-updates-list-key-${Math.random()}`

        ctx.DocumentUpdaterManager._getPendingUpdateListKey = sinon
          .stub()
          .returns(ctx.pendingUpdateListKey)
        ctx.DocumentUpdaterManager.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change,
          ctx.callback
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
        ctx.rclient.rpush
          .calledWith(
            ctx.pendingUpdateListKey,
            `${ctx.project_id}:${ctx.doc_id}`
          )
          .should.equal(true)
      })
    })

    describe('with error talking to redis during rpush', function () {
      beforeEach(function (ctx) {
        ctx.rclient.rpush = sinon
          .stub()
          .yields(new Error('something went wrong'))
        ctx.DocumentUpdaterManager.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change,
          ctx.callback
        )
      })

      it('should return an error', function (ctx) {
        ctx.callback.calledWithExactly(sinon.match(Error)).should.equal(true)
      })
    })

    describe('with null byte corruption', function () {
      beforeEach(function (ctx) {
        ctx.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
        ctx.DocumentUpdaterManager.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change,
          ctx.callback
        )
      })

      afterEach(function (ctx) {
        ctx.stringifyStub.restore()
      })

      it('should return an error', function (ctx) {
        ctx.callback.calledWithExactly(sinon.match(Error)).should.equal(true)
      })

      it('should not push the change onto the pending-updates-list queue', function (ctx) {
        ctx.rclient.rpush.called.should.equal(false)
      })
    })

    describe('when the update is too large', function () {
      beforeEach(function (ctx) {
        ctx.change = {
          op: { p: 12, t: 'update is too large'.repeat(1024 * 400) },
        }
        ctx.DocumentUpdaterManager.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change,
          ctx.callback
        )
      })

      it('should return an error', function (ctx) {
        ctx.callback.calledWithExactly(sinon.match(Error)).should.equal(true)
      })

      it('should add the size to the error', function (ctx) {
        ctx.callback.args[0][0].info.updateSize.should.equal(7782422)
      })

      it('should not push the change onto the pending-updates-list queue', function (ctx) {
        ctx.rclient.rpush.called.should.equal(false)
      })
    })

    describe('with invalid keys', function () {
      beforeEach(function (ctx) {
        ctx.change = {
          op: [{ d: 'test', p: 345 }],
          version: 789, // not a valid key
        }
        ctx.DocumentUpdaterManager.queueChange(
          ctx.project_id,
          ctx.doc_id,
          ctx.change,
          ctx.callback
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
