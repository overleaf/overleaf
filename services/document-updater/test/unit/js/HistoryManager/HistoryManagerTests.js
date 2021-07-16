/* eslint-disable
    mocha/no-nested-tests,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/js/HistoryManager'
)

describe('HistoryManager', function () {
  beforeEach(function () {
    this.HistoryManager = SandboxedModule.require(modulePath, {
      requires: {
        request: (this.request = {}),
        '@overleaf/settings': (this.Settings = {
          apis: {
            project_history: {
              enabled: true,
              url: 'http://project_history.example.com',
            },
            trackchanges: {
              url: 'http://trackchanges.example.com',
            },
          },
        }),
        './DocumentManager': (this.DocumentManager = {}),
        './HistoryRedisManager': (this.HistoryRedisManager = {}),
        './RedisManager': (this.RedisManager = {}),
        './ProjectHistoryRedisManager': (this.ProjectHistoryRedisManager = {}),
        './Metrics': (this.metrics = { inc: sinon.stub() }),
      },
    })
    this.project_id = 'mock-project-id'
    this.doc_id = 'mock-doc-id'
    return (this.callback = sinon.stub())
  })

  describe('flushDocChangesAsync', function () {
    beforeEach(function () {
      return (this.request.post = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 204 }))
    })

    describe('when the project uses track changes', function () {
      beforeEach(function () {
        this.RedisManager.getHistoryType = sinon
          .stub()
          .yields(null, 'track-changes')
        return this.HistoryManager.flushDocChangesAsync(
          this.project_id,
          this.doc_id
        )
      })

      return it('should send a request to the track changes api', function () {
        return this.request.post
          .calledWith(
            `${this.Settings.apis.trackchanges.url}/project/${this.project_id}/doc/${this.doc_id}/flush`
          )
          .should.equal(true)
      })
    })

    describe('when the project uses project history and double flush is not disabled', function () {
      beforeEach(function () {
        this.RedisManager.getHistoryType = sinon
          .stub()
          .yields(null, 'project-history')
        return this.HistoryManager.flushDocChangesAsync(
          this.project_id,
          this.doc_id
        )
      })

      return it('should send a request to the track changes api', function () {
        return this.request.post.called.should.equal(true)
      })
    })

    return describe('when the project uses project history and double flush is disabled', function () {
      beforeEach(function () {
        this.Settings.disableDoubleFlush = true
        this.RedisManager.getHistoryType = sinon
          .stub()
          .yields(null, 'project-history')
        return this.HistoryManager.flushDocChangesAsync(
          this.project_id,
          this.doc_id
        )
      })

      return it('should not send a request to the track changes api', function () {
        return this.request.post.called.should.equal(false)
      })
    })
  })

  describe('flushProjectChangesAsync', function () {
    beforeEach(function () {
      this.request.post = sinon
        .stub()
        .callsArgWith(1, null, { statusCode: 204 })

      return this.HistoryManager.flushProjectChangesAsync(this.project_id)
    })

    return it('should send a request to the project history api', function () {
      return this.request.post
        .calledWith({
          url: `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush`,
          qs: { background: true },
        })
        .should.equal(true)
    })
  })

  describe('flushProjectChanges', function () {
    describe('in the normal case', function () {
      beforeEach(function () {
        this.request.post = sinon
          .stub()
          .callsArgWith(1, null, { statusCode: 204 })
        return this.HistoryManager.flushProjectChanges(this.project_id, {
          background: true,
        })
      })

      return it('should send a request to the project history api', function () {
        return this.request.post
          .calledWith({
            url: `${this.Settings.apis.project_history.url}/project/${this.project_id}/flush`,
            qs: { background: true },
          })
          .should.equal(true)
      })
    })

    return describe('with the skip_history_flush option', function () {
      beforeEach(function () {
        this.request.post = sinon.stub()
        return this.HistoryManager.flushProjectChanges(this.project_id, {
          skip_history_flush: true,
        })
      })

      return it('should not send a request to the project history api', function () {
        return this.request.post.called.should.equal(false)
      })
    })
  })

  describe('recordAndFlushHistoryOps', function () {
    beforeEach(function () {
      this.ops = ['mock-ops']
      this.project_ops_length = 10
      this.doc_ops_length = 5

      this.HistoryManager.flushProjectChangesAsync = sinon.stub()
      this.HistoryRedisManager.recordDocHasHistoryOps = sinon.stub().callsArg(3)
      return (this.HistoryManager.flushDocChangesAsync = sinon.stub())
    })

    describe('with no ops', function () {
      beforeEach(function () {
        return this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.doc_id,
          [],
          this.doc_ops_length,
          this.project_ops_length,
          this.callback
        )
      })

      it('should not flush project changes', function () {
        return this.HistoryManager.flushProjectChangesAsync.called.should.equal(
          false
        )
      })

      it('should not record doc has history ops', function () {
        return this.HistoryRedisManager.recordDocHasHistoryOps.called.should.equal(
          false
        )
      })

      it('should not flush doc changes', function () {
        return this.HistoryManager.flushDocChangesAsync.called.should.equal(
          false
        )
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with enough ops to flush project changes', function () {
      beforeEach(function () {
        this.HistoryManager.shouldFlushHistoryOps = sinon.stub()
        this.HistoryManager.shouldFlushHistoryOps
          .withArgs(this.project_ops_length)
          .returns(true)
        this.HistoryManager.shouldFlushHistoryOps
          .withArgs(this.doc_ops_length)
          .returns(false)

        return this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.doc_id,
          this.ops,
          this.doc_ops_length,
          this.project_ops_length,
          this.callback
        )
      })

      it('should flush project changes', function () {
        return this.HistoryManager.flushProjectChangesAsync
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should record doc has history ops', function () {
        return this.HistoryRedisManager.recordDocHasHistoryOps.calledWith(
          this.project_id,
          this.doc_id,
          this.ops
        )
      })

      it('should not flush doc changes', function () {
        return this.HistoryManager.flushDocChangesAsync.called.should.equal(
          false
        )
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('with enough ops to flush doc changes', function () {
      beforeEach(function () {
        this.HistoryManager.shouldFlushHistoryOps = sinon.stub()
        this.HistoryManager.shouldFlushHistoryOps
          .withArgs(this.project_ops_length)
          .returns(false)
        this.HistoryManager.shouldFlushHistoryOps
          .withArgs(this.doc_ops_length)
          .returns(true)

        return this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.doc_id,
          this.ops,
          this.doc_ops_length,
          this.project_ops_length,
          this.callback
        )
      })

      it('should not flush project changes', function () {
        return this.HistoryManager.flushProjectChangesAsync.called.should.equal(
          false
        )
      })

      it('should record doc has history ops', function () {
        return this.HistoryRedisManager.recordDocHasHistoryOps.calledWith(
          this.project_id,
          this.doc_id,
          this.ops
        )
      })

      it('should flush doc changes', function () {
        return this.HistoryManager.flushDocChangesAsync
          .calledWith(this.project_id, this.doc_id)
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when recording doc has history ops errors', function () {
      beforeEach(function () {
        this.error = new Error('error')
        this.HistoryRedisManager.recordDocHasHistoryOps = sinon
          .stub()
          .callsArgWith(3, this.error)

        return this.HistoryManager.recordAndFlushHistoryOps(
          this.project_id,
          this.doc_id,
          this.ops,
          this.doc_ops_length,
          this.project_ops_length,
          this.callback
        )
      })

      it('should not flush doc changes', function () {
        return this.HistoryManager.flushDocChangesAsync.called.should.equal(
          false
        )
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('shouldFlushHistoryOps', function () {
      it('should return false if the number of ops is not known', function () {
        return this.HistoryManager.shouldFlushHistoryOps(
          null,
          ['a', 'b', 'c'].length,
          1
        ).should.equal(false)
      })

      it("should return false if the updates didn't take us past the threshold", function () {
        // Currently there are 14 ops
        // Previously we were on 11 ops
        // We didn't pass over a multiple of 5
        this.HistoryManager.shouldFlushHistoryOps(
          14,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(false)

        it('should return true if the updates took to the threshold', function () {})
        // Currently there are 15 ops
        // Previously we were on 12 ops
        // We've reached a new multiple of 5
        return this.HistoryManager.shouldFlushHistoryOps(
          15,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(true)
      })

      return it('should return true if the updates took past the threshold', function () {
        // Currently there are 19 ops
        // Previously we were on 16 ops
        // We didn't pass over a multiple of 5
        return this.HistoryManager.shouldFlushHistoryOps(
          17,
          ['a', 'b', 'c'].length,
          5
        ).should.equal(true)
      })
    })
  })

  return describe('resyncProjectHistory', function () {
    beforeEach(function () {
      this.projectHistoryId = 'history-id-1234'
      this.docs = [
        {
          doc: this.doc_id,
          path: 'main.tex',
        },
      ]
      this.files = [
        {
          file: 'mock-file-id',
          path: 'universe.png',
          url: `www.filestore.test/${this.project_id}/mock-file-id`,
        },
      ]
      this.ProjectHistoryRedisManager.queueResyncProjectStructure = sinon
        .stub()
        .yields()
      this.DocumentManager.resyncDocContentsWithLock = sinon.stub().yields()
      return this.HistoryManager.resyncProjectHistory(
        this.project_id,
        this.projectHistoryId,
        this.docs,
        this.files,
        this.callback
      )
    })

    it('should queue a project structure reync', function () {
      return this.ProjectHistoryRedisManager.queueResyncProjectStructure
        .calledWith(
          this.project_id,
          this.projectHistoryId,
          this.docs,
          this.files
        )
        .should.equal(true)
    })

    it('should queue doc content reyncs', function () {
      return this.DocumentManager.resyncDocContentsWithLock
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})
