/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/js/RedisManager.js'
const SandboxedModule = require('sandboxed-module')

describe('RedisManager', function () {
  beforeEach(function () {
    this.RedisManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/redis-wrapper': {
          createClient: () => {
            return (this.rclient = {
              auth: sinon.stub(),
              multi: () => this.rclient,
            })
          },
        },
        '@overleaf/settings': {
          redis: {
            history: {
              key_schema: {
                uncompressedHistoryOps({ doc_id: docId }) {
                  return `UncompressedHistoryOps:${docId}`
                },
                docsWithHistoryOps({ project_id: projectId }) {
                  return `DocsWithHistoryOps:${projectId}`
                },
              },
            },
          },
        },
      },
    })
    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.batchSize = 100
    return (this.callback = sinon.stub())
  })

  describe('getOldestDocUpdates', function () {
    beforeEach(function () {
      this.rawUpdates = [
        { v: 42, op: 'mock-op-42' },
        { v: 45, op: 'mock-op-45' },
      ]
      this.jsonUpdates = Array.from(this.rawUpdates).map(update =>
        JSON.stringify(update)
      )
      this.rclient.lrange = sinon.stub().callsArgWith(3, null, this.jsonUpdates)
      return this.RedisManager.getOldestDocUpdates(
        this.doc_id,
        this.batchSize,
        this.callback
      )
    })

    it('should read the updates from redis', function () {
      return this.rclient.lrange
        .calledWith(
          `UncompressedHistoryOps:${this.doc_id}`,
          0,
          this.batchSize - 1
        )
        .should.equal(true)
    })

    it('should call the callback with the unparsed ops', function () {
      return this.callback.calledWith(null, this.jsonUpdates).should.equal(true)
    })

    describe('expandDocUpdates', function () {
      beforeEach(function () {
        return this.RedisManager.expandDocUpdates(
          this.jsonUpdates,
          this.callback
        )
      })

      return it('should call the callback with the parsed ops', function () {
        return this.callback
          .calledWith(null, this.rawUpdates)
          .should.equal(true)
      })
    })

    return describe('deleteAppliedDocUpdates', function () {
      beforeEach(function () {
        this.rclient.lrem = sinon.stub()
        this.rclient.srem = sinon.stub()
        this.rclient.exec = sinon.stub().callsArgWith(0)
        return this.RedisManager.deleteAppliedDocUpdates(
          this.project_id,
          this.doc_id,
          this.jsonUpdates,
          this.callback
        )
      })

      it('should delete the first update from redis', function () {
        return this.rclient.lrem
          .calledWith(
            `UncompressedHistoryOps:${this.doc_id}`,
            1,
            this.jsonUpdates[0]
          )
          .should.equal(true)
      })

      it('should delete the second update from redis', function () {
        return this.rclient.lrem
          .calledWith(
            `UncompressedHistoryOps:${this.doc_id}`,
            1,
            this.jsonUpdates[1]
          )
          .should.equal(true)
      })

      it('should delete the doc from the set of docs with history ops', function () {
        return this.rclient.srem
          .calledWith(`DocsWithHistoryOps:${this.project_id}`, this.doc_id)
          .should.equal(true)
      })

      return it('should call the callback ', function () {
        return this.callback.called.should.equal(true)
      })
    })
  })

  return describe('getDocIdsWithHistoryOps', function () {
    beforeEach(function () {
      this.doc_ids = ['mock-id-1', 'mock-id-2']
      this.rclient.smembers = sinon.stub().callsArgWith(1, null, this.doc_ids)
      return this.RedisManager.getDocIdsWithHistoryOps(
        this.project_id,
        this.callback
      )
    })

    it('should read the doc_ids from redis', function () {
      return this.rclient.smembers
        .calledWith(`DocsWithHistoryOps:${this.project_id}`)
        .should.equal(true)
    })

    return it('should call the callback with the doc_ids', function () {
      return this.callback.calledWith(null, this.doc_ids).should.equal(true)
    })
  })
})
