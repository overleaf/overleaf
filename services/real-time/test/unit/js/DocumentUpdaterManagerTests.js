/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const path = require('node:path')
const modulePath = '../../../app/js/DocumentUpdaterManager'
const _ = require('lodash')

describe('DocumentUpdaterManager', function () {
  beforeEach(function () {
    let Timer
    this.project_id = 'project-id-923'
    this.doc_id = 'doc-id-394'
    this.lines = ['one', 'two', 'three']
    this.version = 42
    this.settings = {
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
    this.rclient = { auth() {} }

    return (this.DocumentUpdaterManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        request: (this.request = {}),
        '@overleaf/redis-wrapper': { createClient: () => this.rclient },
        '@overleaf/metrics': (this.Metrics = {
          summary: sinon.stub(),
          Timer: (Timer = class Timer {
            done() {}
          }),
        }),
      },
    }))
  }) // avoid modifying JSON object directly

  describe('getDocument', function () {
    beforeEach(function () {
      return (this.callback = sinon.stub())
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.body = JSON.stringify({
          lines: this.lines,
          version: this.version,
          ops: (this.ops = ['mock-op-1', 'mock-op-2']),
          ranges: (this.ranges = { mock: 'ranges' }),
        })
        this.fromVersion = 2
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 200 }, this.body)
        return this.DocumentUpdaterManager.getDocument(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      it('should get the document from the document updater', function () {
        const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}/doc/${this.doc_id}?fromVersion=${this.fromVersion}`
        return this.request.get.calledWith(url).should.equal(true)
      })

      return it('should call the callback with the lines, version, ranges and ops', function () {
        return this.callback
          .calledWith(null, this.lines, this.version, this.ranges, this.ops)
          .should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(
            1,
            (this.error = new Error('something went wrong')),
            null,
            null
          )
        return this.DocumentUpdaterManager.getDocument(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })
    ;[404, 422].forEach(statusCode =>
      describe(`when the document updater returns a ${statusCode} status code`, function () {
        beforeEach(function () {
          this.request.get = sinon
            .stub()
            .callsArgWith(1, null, { statusCode }, '')
          return this.DocumentUpdaterManager.getDocument(
            this.project_id,
            this.doc_id,
            this.fromVersion,
            this.callback
          )
        })

        return it('should return the callback with an error', function () {
          this.callback.called.should.equal(true)
          this.callback
            .calledWith(
              sinon.match({
                message: 'doc updater could not load requested ops',
                info: { statusCode },
              })
            )
            .should.equal(true)
          this.logger.error.called.should.equal(false)
          this.logger.warn.called.should.equal(false)
        })
      })
    )

    return describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.get = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocumentUpdaterManager.getDocument(
          this.project_id,
          this.doc_id,
          this.fromVersion,
          this.callback
        )
      })

      return it('should return the callback with an error', function () {
        this.callback.called.should.equal(true)
        this.callback
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
        this.logger.error.called.should.equal(false)
      })
    })
  })

  describe('flushProjectToMongoAndDelete', function () {
    beforeEach(function () {
      return (this.callback = sinon.stub())
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 }, '')
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete(
          this.project_id,
          this.callback
        )
      })

      it('should delete the project from the document updater', function () {
        const url = `${this.settings.apis.documentupdater.url}/project/${this.project_id}?background=true`
        return this.request.del.calledWith(url).should.equal(true)
      })

      return it('should call the callback with no error', function () {
        return this.callback.calledWith(null).should.equal(true)
      })
    })

    describe('when the document updater API returns an error', function () {
      beforeEach(function () {
        this.request.del = sinon
          .stub()
          .callsArgWith(
            1,
            (this.error = new Error('something went wrong')),
            null,
            null
          )
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete(
          this.project_id,
          this.callback
        )
      })

      return it('should return an error to the callback', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('when the document updater returns a failure error code', function () {
      beforeEach(function () {
        this.request.del = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 500 }, '')
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete(
          this.project_id,
          this.callback
        )
      })

      return it('should return the callback with an error', function () {
        this.callback.called.should.equal(true)
        this.callback
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
    beforeEach(function () {
      this.change = {
        doc: '1234567890',
        op: [{ d: 'test', p: 345 }],
        v: 789,
      }
      this.rclient.rpush = sinon.stub().yields()
      return (this.callback = sinon.stub())
    })

    describe('successfully', function () {
      beforeEach(function () {
        this.pendingUpdateListKey = `pending-updates-list-key-${Math.random()}`

        this.DocumentUpdaterManager._getPendingUpdateListKey = sinon
          .stub()
          .returns(this.pendingUpdateListKey)
        this.DocumentUpdaterManager.queueChange(
          this.project_id,
          this.doc_id,
          this.change,
          this.callback
        )
      })

      it('should push the change', function () {
        this.rclient.rpush
          .calledWith(
            `PendingUpdates:${this.doc_id}`,
            JSON.stringify(this.change)
          )
          .should.equal(true)
      })

      it('should notify the doc updater of the change via the pending-updates-list queue', function () {
        this.rclient.rpush
          .calledWith(
            this.pendingUpdateListKey,
            `${this.project_id}:${this.doc_id}`
          )
          .should.equal(true)
      })
    })

    describe('with error talking to redis during rpush', function () {
      beforeEach(function () {
        this.rclient.rpush = sinon
          .stub()
          .yields(new Error('something went wrong'))
        return this.DocumentUpdaterManager.queueChange(
          this.project_id,
          this.doc_id,
          this.change,
          this.callback
        )
      })

      return it('should return an error', function () {
        return this.callback
          .calledWithExactly(sinon.match(Error))
          .should.equal(true)
      })
    })

    describe('with null byte corruption', function () {
      beforeEach(function () {
        this.stringifyStub = sinon
          .stub(JSON, 'stringify')
          .callsFake(() => '["bad bytes! \u0000 <- here"]')
        return this.DocumentUpdaterManager.queueChange(
          this.project_id,
          this.doc_id,
          this.change,
          this.callback
        )
      })

      afterEach(function () {
        this.stringifyStub.restore()
      })

      it('should return an error', function () {
        return this.callback
          .calledWithExactly(sinon.match(Error))
          .should.equal(true)
      })

      return it('should not push the change onto the pending-updates-list queue', function () {
        return this.rclient.rpush.called.should.equal(false)
      })
    })

    describe('when the update is too large', function () {
      beforeEach(function () {
        this.change = {
          op: { p: 12, t: 'update is too large'.repeat(1024 * 400) },
        }
        return this.DocumentUpdaterManager.queueChange(
          this.project_id,
          this.doc_id,
          this.change,
          this.callback
        )
      })

      it('should return an error', function () {
        return this.callback
          .calledWithExactly(sinon.match(Error))
          .should.equal(true)
      })

      it('should add the size to the error', function () {
        return this.callback.args[0][0].info.updateSize.should.equal(7782422)
      })

      return it('should not push the change onto the pending-updates-list queue', function () {
        return this.rclient.rpush.called.should.equal(false)
      })
    })

    describe('with invalid keys', function () {
      beforeEach(function () {
        this.change = {
          op: [{ d: 'test', p: 345 }],
          version: 789, // not a valid key
        }
        return this.DocumentUpdaterManager.queueChange(
          this.project_id,
          this.doc_id,
          this.change,
          this.callback
        )
      })

      it('should remove the invalid keys from the change', function () {
        return this.rclient.rpush
          .calledWith(
            `PendingUpdates:${this.doc_id}`,
            JSON.stringify({ op: this.change.op })
          )
          .should.equal(true)
      })
    })
  })

  describe('_getPendingUpdateListKey', function () {
    beforeEach(function () {
      const keys = _.times(
        10000,
        this.DocumentUpdaterManager._getPendingUpdateListKey
      )
      this.keys = _.uniq(keys)
    })
    it('should return normal pending updates key', function () {
      _.includes(this.keys, 'pending-updates-list').should.equal(true)
    })

    it('should return pending-updates-list-n keys', function () {
      _.includes(this.keys, 'pending-updates-list-1').should.equal(true)
      _.includes(this.keys, 'pending-updates-list-3').should.equal(true)
      _.includes(this.keys, 'pending-updates-list-9').should.equal(true)
    })

    it('should not include pending-updates-list-0 key', function () {
      _.includes(this.keys, 'pending-updates-list-0').should.equal(false)
    })

    it('should not include maximum as pendingUpdateListShardCount value', function () {
      _.includes(this.keys, 'pending-updates-list-10').should.equal(false)
    })
  })
})
