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
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const modulePath = '../../../../app/js/UpdatesManager.js'
const SandboxedModule = require('sandboxed-module')

describe('UpdatesManager', function () {
  beforeEach(function () {
    this.UpdatesManager = SandboxedModule.require(modulePath, {
      singleOnly: true,
      requires: {
        './UpdateCompressor': (this.UpdateCompressor = {}),
        './MongoManager': (this.MongoManager = {}),
        './PackManager': (this.PackManager = {}),
        './RedisManager': (this.RedisManager = {}),
        './LockManager': (this.LockManager = {}),
        './WebApiManager': (this.WebApiManager = {}),
        './UpdateTrimmer': (this.UpdateTrimmer = {}),
        './DocArchiveManager': (this.DocArchiveManager = {}),
        '@overleaf/settings': {
          redis: {
            lock: {
              key_schema: {
                historyLock({ doc_id: docId }) {
                  return `HistoryLock:${docId}`
                },
              },
            },
          },
        },
      },
    })
    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.callback = sinon.stub()
    return (this.temporary = 'temp-mock')
  })

  describe('compressAndSaveRawUpdates', function () {
    describe('when there are no raw ops', function () {
      beforeEach(function () {
        this.MongoManager.peekLastCompressedUpdate = sinon.stub()
        return this.UpdatesManager.compressAndSaveRawUpdates(
          this.project_id,
          this.doc_id,
          [],
          this.temporary,
          this.callback
        )
      })

      it('should not need to access the database', function () {
        return this.MongoManager.peekLastCompressedUpdate.called.should.equal(
          false
        )
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when there is no compressed history to begin with', function () {
      beforeEach(function () {
        this.rawUpdates = [
          { v: 12, op: 'mock-op-12' },
          { v: 13, op: 'mock-op-13' },
        ]
        this.compressedUpdates = [{ v: 13, op: 'compressed-op-12' }]

        this.MongoManager.peekLastCompressedUpdate = sinon
          .stub()
          .callsArgWith(1, null, null)
        this.PackManager.insertCompressedUpdates = sinon.stub().callsArg(5)
        this.UpdateCompressor.compressRawUpdates = sinon
          .stub()
          .returns(this.compressedUpdates)
        return this.UpdatesManager.compressAndSaveRawUpdates(
          this.project_id,
          this.doc_id,
          this.rawUpdates,
          this.temporary,
          this.callback
        )
      })

      it('should look at the last compressed op', function () {
        return this.MongoManager.peekLastCompressedUpdate
          .calledWith(this.doc_id)
          .should.equal(true)
      })

      it('should save the compressed ops as a pack', function () {
        return this.PackManager.insertCompressedUpdates
          .calledWith(
            this.project_id,
            this.doc_id,
            null,
            this.compressedUpdates,
            this.temporary
          )
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    describe('when the raw ops need appending to existing history', function () {
      beforeEach(function () {
        this.lastCompressedUpdate = { v: 11, op: 'compressed-op-11' }
        this.compressedUpdates = [
          { v: 12, op: 'compressed-op-11+12' },
          { v: 13, op: 'compressed-op-12' },
        ]

        this.MongoManager.peekLastCompressedUpdate = sinon
          .stub()
          .callsArgWith(
            1,
            null,
            this.lastCompressedUpdate,
            this.lastCompressedUpdate.v
          )
        this.PackManager.insertCompressedUpdates = sinon.stub().callsArg(5)
        return (this.UpdateCompressor.compressRawUpdates = sinon
          .stub()
          .returns(this.compressedUpdates))
      })

      describe('when the raw ops start where the existing history ends', function () {
        beforeEach(function () {
          this.rawUpdates = [
            { v: 12, op: 'mock-op-12' },
            { v: 13, op: 'mock-op-13' },
          ]
          return this.UpdatesManager.compressAndSaveRawUpdates(
            this.project_id,
            this.doc_id,
            this.rawUpdates,
            this.temporary,
            this.callback
          )
        })

        it('should look at the last compressed op', function () {
          return this.MongoManager.peekLastCompressedUpdate
            .calledWith(this.doc_id)
            .should.equal(true)
        })

        it('should compress the raw ops', function () {
          return this.UpdateCompressor.compressRawUpdates
            .calledWith(null, this.rawUpdates)
            .should.equal(true)
        })

        it('should save the new compressed ops into a pack', function () {
          return this.PackManager.insertCompressedUpdates
            .calledWith(
              this.project_id,
              this.doc_id,
              this.lastCompressedUpdate,
              this.compressedUpdates,
              this.temporary
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      describe('when the raw ops start where the existing history ends and the history is in a pack', function () {
        beforeEach(function () {
          this.lastCompressedUpdate = {
            pack: [{ v: 11, op: 'compressed-op-11' }],
            v: 11,
          }
          this.rawUpdates = [
            { v: 12, op: 'mock-op-12' },
            { v: 13, op: 'mock-op-13' },
          ]
          this.MongoManager.peekLastCompressedUpdate = sinon
            .stub()
            .callsArgWith(
              1,
              null,
              this.lastCompressedUpdate,
              this.lastCompressedUpdate.v
            )
          return this.UpdatesManager.compressAndSaveRawUpdates(
            this.project_id,
            this.doc_id,
            this.rawUpdates,
            this.temporary,
            this.callback
          )
        })

        it('should look at the last compressed op', function () {
          return this.MongoManager.peekLastCompressedUpdate
            .calledWith(this.doc_id)
            .should.equal(true)
        })

        it('should compress the raw ops', function () {
          return this.UpdateCompressor.compressRawUpdates
            .calledWith(null, this.rawUpdates)
            .should.equal(true)
        })

        it('should save the new compressed ops into a pack', function () {
          return this.PackManager.insertCompressedUpdates
            .calledWith(
              this.project_id,
              this.doc_id,
              this.lastCompressedUpdate,
              this.compressedUpdates,
              this.temporary
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })

      describe('when some raw ops are passed that have already been compressed', function () {
        beforeEach(function () {
          this.rawUpdates = [
            { v: 10, op: 'mock-op-10' },
            { v: 11, op: 'mock-op-11' },
            { v: 12, op: 'mock-op-12' },
            { v: 13, op: 'mock-op-13' },
          ]

          return this.UpdatesManager.compressAndSaveRawUpdates(
            this.project_id,
            this.doc_id,
            this.rawUpdates,
            this.temporary,
            this.callback
          )
        })

        return it('should only compress the more recent raw ops', function () {
          return this.UpdateCompressor.compressRawUpdates
            .calledWith(null, this.rawUpdates.slice(-2))
            .should.equal(true)
        })
      })

      describe('when the raw ops do not follow from the last compressed op version', function () {
        beforeEach(function () {
          this.rawUpdates = [{ v: 13, op: 'mock-op-13' }]
          return this.UpdatesManager.compressAndSaveRawUpdates(
            this.project_id,
            this.doc_id,
            this.rawUpdates,
            this.temporary,
            this.callback
          )
        })

        it('should call the callback with an error', function () {
          return this.callback
            .calledWith(
              sinon.match.has(
                'message',
                'Tried to apply raw op at version 13 to last compressed update with version 11 from unknown time'
              )
            )
            .should.equal(true)
        })

        return it('should not insert any update into mongo', function () {
          return this.PackManager.insertCompressedUpdates.called.should.equal(
            false
          )
        })
      })

      return describe('when the raw ops are out of order', function () {
        beforeEach(function () {
          this.rawUpdates = [
            { v: 13, op: 'mock-op-13' },
            { v: 12, op: 'mock-op-12' },
          ]
          return this.UpdatesManager.compressAndSaveRawUpdates(
            this.project_id,
            this.doc_id,
            this.rawUpdates,
            this.temporary,
            this.callback
          )
        })

        it('should call the callback with an error', function () {
          return this.callback
            .calledWith(sinon.match.has('message'))
            .should.equal(true)
        })

        return it('should not insert any update into mongo', function () {
          return this.PackManager.insertCompressedUpdates.called.should.equal(
            false
          )
        })
      })
    })

    return describe('when the raw ops need appending to existing history which is in S3', function () {
      beforeEach(function () {
        this.lastCompressedUpdate = null
        this.lastVersion = 11
        this.compressedUpdates = [{ v: 13, op: 'compressed-op-12' }]

        this.MongoManager.peekLastCompressedUpdate = sinon
          .stub()
          .callsArgWith(1, null, null, this.lastVersion)
        this.PackManager.insertCompressedUpdates = sinon.stub().callsArg(5)
        return (this.UpdateCompressor.compressRawUpdates = sinon
          .stub()
          .returns(this.compressedUpdates))
      })

      return describe('when the raw ops start where the existing history ends', function () {
        beforeEach(function () {
          this.rawUpdates = [
            { v: 12, op: 'mock-op-12' },
            { v: 13, op: 'mock-op-13' },
          ]
          return this.UpdatesManager.compressAndSaveRawUpdates(
            this.project_id,
            this.doc_id,
            this.rawUpdates,
            this.temporary,
            this.callback
          )
        })

        it('should try to look at the last compressed op', function () {
          return this.MongoManager.peekLastCompressedUpdate
            .calledWith(this.doc_id)
            .should.equal(true)
        })

        it('should compress the last compressed op and the raw ops', function () {
          return this.UpdateCompressor.compressRawUpdates
            .calledWith(this.lastCompressedUpdate, this.rawUpdates)
            .should.equal(true)
        })

        it('should save the compressed ops', function () {
          return this.PackManager.insertCompressedUpdates
            .calledWith(
              this.project_id,
              this.doc_id,
              null,
              this.compressedUpdates,
              this.temporary
            )
            .should.equal(true)
        })

        return it('should call the callback', function () {
          return this.callback.called.should.equal(true)
        })
      })
    })
  })

  describe('processUncompressedUpdates', function () {
    beforeEach(function () {
      this.UpdatesManager.compressAndSaveRawUpdates = sinon
        .stub()
        .callsArgWith(4)
      this.RedisManager.deleteAppliedDocUpdates = sinon.stub().callsArg(3)
      this.MongoManager.backportProjectId = sinon.stub().callsArg(2)
      return (this.UpdateTrimmer.shouldTrimUpdates = sinon
        .stub()
        .callsArgWith(1, null, (this.temporary = 'temp mock')))
    })

    describe('when there is fewer than one batch to send', function () {
      beforeEach(function () {
        this.updates = ['mock-update']
        this.RedisManager.getOldestDocUpdates = sinon
          .stub()
          .callsArgWith(2, null, this.updates)
        this.RedisManager.expandDocUpdates = sinon
          .stub()
          .callsArgWith(1, null, this.updates)
        return this.UpdatesManager.processUncompressedUpdates(
          this.project_id,
          this.doc_id,
          this.temporary,
          this.callback
        )
      })

      it('should get the oldest updates', function () {
        return this.RedisManager.getOldestDocUpdates
          .calledWith(this.doc_id, this.UpdatesManager.REDIS_READ_BATCH_SIZE)
          .should.equal(true)
      })

      it('should compress and save the updates', function () {
        return this.UpdatesManager.compressAndSaveRawUpdates
          .calledWith(
            this.project_id,
            this.doc_id,
            this.updates,
            this.temporary
          )
          .should.equal(true)
      })

      it('should delete the batch of uncompressed updates that was just processed', function () {
        return this.RedisManager.deleteAppliedDocUpdates
          .calledWith(this.project_id, this.doc_id, this.updates)
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    return describe('when there are multiple batches to send', function () {
      beforeEach(function (done) {
        this.UpdatesManager.REDIS_READ_BATCH_SIZE = 2
        this.updates = [
          'mock-update-0',
          'mock-update-1',
          'mock-update-2',
          'mock-update-3',
          'mock-update-4',
        ]
        this.redisArray = this.updates.slice()
        this.RedisManager.getOldestDocUpdates = (
          docId,
          batchSize,
          callback
        ) => {
          if (callback == null) {
            callback = function () {}
          }
          const updates = this.redisArray.slice(0, batchSize)
          this.redisArray = this.redisArray.slice(batchSize)
          return callback(null, updates)
        }
        sinon.spy(this.RedisManager, 'getOldestDocUpdates')
        this.RedisManager.expandDocUpdates = (jsonUpdates, callback) => {
          return callback(null, jsonUpdates)
        }
        sinon.spy(this.RedisManager, 'expandDocUpdates')
        return this.UpdatesManager.processUncompressedUpdates(
          this.project_id,
          this.doc_id,
          this.temporary,
          (...args) => {
            this.callback(...Array.from(args || []))
            return done()
          }
        )
      })

      it('should get the oldest updates in three batches ', function () {
        return this.RedisManager.getOldestDocUpdates.callCount.should.equal(3)
      })

      it('should compress and save the updates in batches', function () {
        this.UpdatesManager.compressAndSaveRawUpdates
          .calledWith(
            this.project_id,
            this.doc_id,
            this.updates.slice(0, 2),
            this.temporary
          )
          .should.equal(true)
        this.UpdatesManager.compressAndSaveRawUpdates
          .calledWith(
            this.project_id,
            this.doc_id,
            this.updates.slice(2, 4),
            this.temporary
          )
          .should.equal(true)
        return this.UpdatesManager.compressAndSaveRawUpdates
          .calledWith(
            this.project_id,
            this.doc_id,
            this.updates.slice(4, 5),
            this.temporary
          )
          .should.equal(true)
      })

      it('should delete the batches of uncompressed updates', function () {
        return this.RedisManager.deleteAppliedDocUpdates.callCount.should.equal(
          3
        )
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })
  })

  describe('processCompressedUpdatesWithLock', function () {
    beforeEach(function () {
      this.UpdateTrimmer.shouldTrimUpdates = sinon
        .stub()
        .callsArgWith(1, null, (this.temporary = 'temp mock'))
      this.MongoManager.backportProjectId = sinon.stub().callsArg(2)
      this.UpdatesManager._processUncompressedUpdates = sinon.stub().callsArg(3)
      this.LockManager.runWithLock = sinon.stub().callsArg(2)
      return this.UpdatesManager.processUncompressedUpdatesWithLock(
        this.project_id,
        this.doc_id,
        this.callback
      )
    })

    it('should check if the updates are temporary', function () {
      return this.UpdateTrimmer.shouldTrimUpdates
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should backport the project id', function () {
      return this.MongoManager.backportProjectId
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should run processUncompressedUpdates with the lock', function () {
      return this.LockManager.runWithLock
        .calledWith(`HistoryLock:${this.doc_id}`)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('getDocUpdates', function () {
    beforeEach(function () {
      this.updates = ['mock-updates']
      this.options = { to: 'mock-to', limit: 'mock-limit' }
      this.PackManager.getOpsByVersionRange = sinon
        .stub()
        .callsArgWith(4, null, this.updates)
      this.UpdatesManager.processUncompressedUpdatesWithLock = sinon
        .stub()
        .callsArg(2)
      return this.UpdatesManager.getDocUpdates(
        this.project_id,
        this.doc_id,
        this.options,
        this.callback
      )
    })

    it('should process outstanding updates', function () {
      return this.UpdatesManager.processUncompressedUpdatesWithLock
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    it('should get the updates from the database', function () {
      return this.PackManager.getOpsByVersionRange
        .calledWith(
          this.project_id,
          this.doc_id,
          this.options.from,
          this.options.to
        )
        .should.equal(true)
    })

    return it('should return the updates', function () {
      return this.callback.calledWith(null, this.updates).should.equal(true)
    })
  })

  describe('getDocUpdatesWithUserInfo', function () {
    beforeEach(function () {
      this.updates = ['mock-updates']
      this.options = { to: 'mock-to', limit: 'mock-limit' }
      this.updatesWithUserInfo = ['updates-with-user-info']
      this.UpdatesManager.getDocUpdates = sinon
        .stub()
        .callsArgWith(3, null, this.updates)
      this.UpdatesManager.fillUserInfo = sinon
        .stub()
        .callsArgWith(1, null, this.updatesWithUserInfo)
      return this.UpdatesManager.getDocUpdatesWithUserInfo(
        this.project_id,
        this.doc_id,
        this.options,
        this.callback
      )
    })

    it('should get the updates', function () {
      return this.UpdatesManager.getDocUpdates
        .calledWith(this.project_id, this.doc_id, this.options)
        .should.equal(true)
    })

    it('should file the updates with the user info', function () {
      return this.UpdatesManager.fillUserInfo
        .calledWith(this.updates)
        .should.equal(true)
    })

    return it('should return the updates with the filled details', function () {
      return this.callback
        .calledWith(null, this.updatesWithUserInfo)
        .should.equal(true)
    })
  })

  describe('processUncompressedUpdatesForProject', function () {
    beforeEach(function (done) {
      this.doc_ids = ['mock-id-1', 'mock-id-2']
      this.UpdateTrimmer.shouldTrimUpdates = sinon
        .stub()
        .callsArgWith(1, null, (this.temporary = 'temp mock'))
      this.MongoManager.backportProjectId = sinon.stub().callsArg(2)
      this.UpdatesManager._processUncompressedUpdatesForDocWithLock = sinon
        .stub()
        .callsArg(3)
      this.RedisManager.getDocIdsWithHistoryOps = sinon
        .stub()
        .callsArgWith(1, null, this.doc_ids)
      return this.UpdatesManager.processUncompressedUpdatesForProject(
        this.project_id,
        () => {
          this.callback()
          return done()
        }
      )
    })

    it('should get all the docs with history ops', function () {
      return this.RedisManager.getDocIdsWithHistoryOps
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should process the doc ops for the each doc_id', function () {
      return Array.from(this.doc_ids).map(docId =>
        this.UpdatesManager._processUncompressedUpdatesForDocWithLock
          .calledWith(this.project_id, docId, this.temporary)
          .should.equal(true)
      )
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('getSummarizedProjectUpdates', function () {
    beforeEach(function () {
      this.updates = [
        {
          doc_id: 123,
          v: 456,
          op: 'mock-updates',
          meta: { user_id: 123, start_ts: 1233, end_ts: 1234 },
        },
      ]
      this.options = { before: 'mock-before', limit: 'mock-limit' }
      this.summarizedUpdates = [
        {
          meta: { user_ids: [123], start_ts: 1233, end_ts: 1234 },
          docs: { 123: { fromV: 456, toV: 456 } },
        },
      ]
      this.updatesWithUserInfo = ['updates-with-user-info']
      this.done_state = false
      this.iterator = {
        next: cb => {
          this.done_state = true
          return cb(null, this.updates)
        },
        done: () => {
          return this.done_state
        },
      }
      this.PackManager.makeProjectIterator = sinon
        .stub()
        .callsArgWith(2, null, this.iterator)
      this.UpdatesManager.processUncompressedUpdatesForProject = sinon
        .stub()
        .callsArg(1)
      this.UpdatesManager.fillSummarizedUserInfo = sinon
        .stub()
        .callsArgWith(1, null, this.updatesWithUserInfo)
      return this.UpdatesManager.getSummarizedProjectUpdates(
        this.project_id,
        this.options,
        this.callback
      )
    })

    it('should process any outstanding updates', function () {
      return this.UpdatesManager.processUncompressedUpdatesForProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should get the updates', function () {
      return this.PackManager.makeProjectIterator
        .calledWith(this.project_id, this.options.before)
        .should.equal(true)
    })

    it('should fill the updates with the user info', function () {
      return this.UpdatesManager.fillSummarizedUserInfo
        .calledWith(this.summarizedUpdates)
        .should.equal(true)
    })

    return it('should return the updates with the filled details', function () {
      return this.callback
        .calledWith(null, this.updatesWithUserInfo)
        .should.equal(true)
    })
  })

  // describe "_extendBatchOfSummarizedUpdates", ->
  // 	beforeEach ->
  // 		@before = Date.now()
  // 		@min_count = 2
  // 		@existingSummarizedUpdates = ["summarized-updates-3"]
  // 		@summarizedUpdates = ["summarized-updates-3", "summarized-update-2", "summarized-update-1"]

  // 	describe "when there are updates to get", ->
  // 		beforeEach ->
  // 			@updates = [
  // 				{op: "mock-op-1", meta: end_ts: @before - 10},
  // 				{op: "mock-op-1", meta: end_ts: @nextBeforeTimestamp = @before - 20}
  // 			]
  // 			@existingSummarizedUpdates = ["summarized-updates-3"]
  // 			@summarizedUpdates = ["summarized-updates-3", "summarized-update-2", "summarized-update-1"]
  // 			@UpdatesManager._summarizeUpdates = sinon.stub().returns(@summarizedUpdates)
  // 			@UpdatesManager.getProjectUpdatesWithUserInfo = sinon.stub().callsArgWith(2, null, @updates)
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates @project_id, @existingSummarizedUpdates, @before, @min_count, @callback

  // 		it "should get the updates", ->
  // 			@UpdatesManager.getProjectUpdatesWithUserInfo
  // 				.calledWith(@project_id, { before: @before, limit: 3 * @min_count })
  // 				.should.equal true

  // 		it "should summarize the updates", ->
  // 			@UpdatesManager._summarizeUpdates
  // 				.calledWith(@updates, @existingSummarizedUpdates)
  // 				.should.equal true

  // 		it "should call the callback with the summarized updates and the next before timestamp", ->
  // 			@callback.calledWith(null, @summarizedUpdates, @nextBeforeTimestamp).should.equal true

  // 	describe "when there are no more updates", ->
  // 		beforeEach ->
  // 			@updates = []
  // 			@UpdatesManager._summarizeUpdates = sinon.stub().returns(@summarizedUpdates)
  // 			@UpdatesManager.getProjectUpdatesWithUserInfo = sinon.stub().callsArgWith(2, null, @updates)
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates @project_id, @existingSummarizedUpdates, @before, @min_count, @callback

  // 		it "should call the callback with the summarized updates and null for nextBeforeTimestamp", ->
  // 			@callback.calledWith(null, @summarizedUpdates, null).should.equal true

  // describe "getSummarizedProjectUpdates", ->
  // 	describe "when one batch of updates is enough to meet the limit", ->
  // 		beforeEach ->
  // 			@before = Date.now()
  // 			@min_count = 2
  // 			@updates = ["summarized-updates-3", "summarized-updates-2"]
  // 			@nextBeforeTimestamp = @before - 100
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates = sinon.stub().callsArgWith(4, null, @updates, @nextBeforeTimestamp)
  // 			@UpdatesManager.getSummarizedProjectUpdates @project_id, { before: @before, min_count: @min_count }, @callback

  // 		it "should get the batch of summarized updates", ->
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates
  // 				.calledWith(@project_id, [], @before, @min_count)
  // 				.should.equal true

  // 		it "should call the callback with the updates", ->
  // 			@callback.calledWith(null, @updates, @nextBeforeTimestamp).should.equal true

  // 	describe "when multiple batches are needed to meet the limit", ->
  // 		beforeEach ->
  // 			@before = Date.now()
  // 			@min_count = 4
  // 			@firstBatch =  [{ toV: 6, fromV: 6 }, { toV: 5, fromV: 5 }]
  // 			@nextBeforeTimestamp = @before - 100
  // 			@secondBatch = [{ toV: 4, fromV: 4 }, { toV: 3, fromV: 3 }]
  // 			@nextNextBeforeTimestamp = @before - 200
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates = (project_id, existingUpdates, before, desiredLength, callback) =>
  // 				if existingUpdates.length == 0
  // 					callback null, @firstBatch, @nextBeforeTimestamp
  // 				else
  // 					callback null, @firstBatch.concat(@secondBatch), @nextNextBeforeTimestamp
  // 			sinon.spy @UpdatesManager, "_extendBatchOfSummarizedUpdates"
  // 			@UpdatesManager.getSummarizedProjectUpdates @project_id, { before: @before, min_count: @min_count }, @callback

  // 		it "should get the first batch of summarized updates", ->
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates
  // 				.calledWith(@project_id, [], @before, @min_count)
  // 				.should.equal true

  // 		it "should get the second batch of summarized updates", ->
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates
  // 				.calledWith(@project_id, @firstBatch, @nextBeforeTimestamp, @min_count)
  // 				.should.equal true

  // 		it "should call the callback with all the updates", ->
  // 			@callback.calledWith(null, @firstBatch.concat(@secondBatch), @nextNextBeforeTimestamp).should.equal true

  // 	describe "when the end of the database is hit", ->
  // 		beforeEach ->
  // 			@before = Date.now()
  // 			@min_count = 4
  // 			@updates =  [{ toV: 6, fromV: 6 }, { toV: 5, fromV: 5 }]
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates = sinon.stub().callsArgWith(4, null, @updates, null)
  // 			@UpdatesManager.getSummarizedProjectUpdates @project_id, { before: @before, min_count: @min_count }, @callback

  // 		it "should get the batch of summarized updates", ->
  // 			@UpdatesManager._extendBatchOfSummarizedUpdates
  // 				.calledWith(@project_id, [], @before, @min_count)
  // 				.should.equal true

  // 		it "should call the callback with the updates", ->
  // 			@callback.calledWith(null, @updates, null).should.equal true

  describe('fillUserInfo', function () {
    describe('with valid users', function () {
      beforeEach(function (done) {
        this.user_id_1 = ObjectId().toString()
        this.user_id_2 = ObjectId().toString()
        this.updates = [
          {
            meta: {
              user_id: this.user_id_1,
            },
            op: 'mock-op-1',
          },
          {
            meta: {
              user_id: this.user_id_1,
            },
            op: 'mock-op-2',
          },
          {
            meta: {
              user_id: this.user_id_2,
            },
            op: 'mock-op-3',
          },
        ]
        this.user_info = {}
        this.user_info[this.user_id_1] = { email: 'user1@sharelatex.com' }
        this.user_info[this.user_id_2] = { email: 'user2@sharelatex.com' }

        this.WebApiManager.getUserInfo = (userId, callback) => {
          if (callback == null) {
            callback = function () {}
          }
          return callback(null, this.user_info[userId])
        }
        sinon.spy(this.WebApiManager, 'getUserInfo')

        return this.UpdatesManager.fillUserInfo(
          this.updates,
          (error, results) => {
            if (error) return done(error)
            this.results = results
            return done()
          }
        )
      })

      it('should only call getUserInfo once for each user_id', function () {
        this.WebApiManager.getUserInfo.calledTwice.should.equal(true)
        this.WebApiManager.getUserInfo
          .calledWith(this.user_id_1)
          .should.equal(true)
        return this.WebApiManager.getUserInfo
          .calledWith(this.user_id_2)
          .should.equal(true)
      })

      return it('should return the updates with the user info filled', function () {
        return expect(this.results).to.deep.equal([
          {
            meta: {
              user: {
                email: 'user1@sharelatex.com',
              },
            },
            op: 'mock-op-1',
          },
          {
            meta: {
              user: {
                email: 'user1@sharelatex.com',
              },
            },
            op: 'mock-op-2',
          },
          {
            meta: {
              user: {
                email: 'user2@sharelatex.com',
              },
            },
            op: 'mock-op-3',
          },
        ])
      })
    })

    return describe('with invalid user ids', function () {
      beforeEach(function (done) {
        this.updates = [
          {
            meta: {
              user_id: null,
            },
            op: 'mock-op-1',
          },
          {
            meta: {
              user_id: 'anonymous-user',
            },
            op: 'mock-op-2',
          },
        ]
        this.WebApiManager.getUserInfo = (userId, callback) => {
          if (callback == null) {
            callback = function () {}
          }
          return callback(null, this.user_info[userId])
        }
        sinon.spy(this.WebApiManager, 'getUserInfo')

        return this.UpdatesManager.fillUserInfo(
          this.updates,
          (error, results) => {
            if (error) return done(error)
            this.results = results
            return done()
          }
        )
      })

      it('should not call getUserInfo', function () {
        return this.WebApiManager.getUserInfo.called.should.equal(false)
      })

      return it('should return the updates without the user info filled', function () {
        return expect(this.results).to.deep.equal([
          {
            meta: {},
            op: 'mock-op-1',
          },
          {
            meta: {},
            op: 'mock-op-2',
          },
        ])
      })
    })
  })

  return describe('_summarizeUpdates', function () {
    beforeEach(function () {
      this.now = Date.now()
      this.user_1 = { id: 'mock-user-1' }
      return (this.user_2 = { id: 'mock-user-2' })
    })

    it('should concat updates that are close in time', function () {
      const result = this.UpdatesManager._summarizeUpdates([
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_1.id,
            start_ts: this.now + 20,
            end_ts: this.now + 30,
          },
          v: 5,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_2.id,
            start_ts: this.now,
            end_ts: this.now + 10,
          },
          v: 4,
        },
      ])

      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              fromV: 4,
              toV: 5,
            },
          },
          meta: {
            user_ids: [this.user_1.id, this.user_2.id],
            start_ts: this.now,
            end_ts: this.now + 30,
          },
        },
      ])
    })

    it('should leave updates that are far apart in time', function () {
      const oneDay = 1000 * 60 * 60 * 24
      const result = this.UpdatesManager._summarizeUpdates([
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_2.id,
            start_ts: this.now + oneDay,
            end_ts: this.now + oneDay + 10,
          },
          v: 5,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_1.id,
            start_ts: this.now,
            end_ts: this.now + 10,
          },
          v: 4,
        },
      ])
      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              fromV: 5,
              toV: 5,
            },
          },
          meta: {
            user_ids: [this.user_2.id],
            start_ts: this.now + oneDay,
            end_ts: this.now + oneDay + 10,
          },
        },
        {
          docs: {
            'doc-id-1': {
              fromV: 4,
              toV: 4,
            },
          },
          meta: {
            user_ids: [this.user_1.id],
            start_ts: this.now,
            end_ts: this.now + 10,
          },
        },
      ])
    })

    it('should concat onto existing summarized updates', function () {
      const result = this.UpdatesManager._summarizeUpdates(
        [
          {
            doc_id: 'doc-id-2',
            meta: {
              user_id: this.user_1.id,
              start_ts: this.now + 20,
              end_ts: this.now + 30,
            },
            v: 5,
          },
          {
            doc_id: 'doc-id-2',
            meta: {
              user_id: this.user_2.id,
              start_ts: this.now,
              end_ts: this.now + 10,
            },
            v: 4,
          },
        ],
        [
          {
            docs: {
              'doc-id-1': {
                fromV: 6,
                toV: 8,
              },
            },
            meta: {
              user_ids: [this.user_1.id],
              start_ts: this.now + 40,
              end_ts: this.now + 50,
            },
          },
        ]
      )
      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              toV: 8,
              fromV: 6,
            },
            'doc-id-2': {
              toV: 5,
              fromV: 4,
            },
          },
          meta: {
            user_ids: [this.user_1.id, this.user_2.id],
            start_ts: this.now,
            end_ts: this.now + 50,
          },
        },
      ])
    })

    it('should include null user values', function () {
      const result = this.UpdatesManager._summarizeUpdates([
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_1.id,
            start_ts: this.now + 20,
            end_ts: this.now + 30,
          },
          v: 5,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: null,
            start_ts: this.now,
            end_ts: this.now + 10,
          },
          v: 4,
        },
      ])
      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              fromV: 4,
              toV: 5,
            },
          },
          meta: {
            user_ids: [this.user_1.id, null],
            start_ts: this.now,
            end_ts: this.now + 30,
          },
        },
      ])
    })

    it('should include null user values, when the null is earlier in the updates list', function () {
      const result = this.UpdatesManager._summarizeUpdates([
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: null,
            start_ts: this.now,
            end_ts: this.now + 10,
          },
          v: 4,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_1.id,
            start_ts: this.now + 20,
            end_ts: this.now + 30,
          },
          v: 5,
        },
      ])
      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              fromV: 4,
              toV: 5,
            },
          },
          meta: {
            user_ids: [null, this.user_1.id],
            start_ts: this.now,
            end_ts: this.now + 30,
          },
        },
      ])
    })

    it('should roll several null user values into one', function () {
      const result = this.UpdatesManager._summarizeUpdates([
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_1.id,
            start_ts: this.now + 20,
            end_ts: this.now + 30,
          },
          v: 5,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: null,
            start_ts: this.now,
            end_ts: this.now + 10,
          },
          v: 4,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: null,
            start_ts: this.now + 2,
            end_ts: this.now + 4,
          },
          v: 4,
        },
      ])
      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              fromV: 4,
              toV: 5,
            },
          },
          meta: {
            user_ids: [this.user_1.id, null],
            start_ts: this.now,
            end_ts: this.now + 30,
          },
        },
      ])
    })

    return it('should split updates before a big delete', function () {
      const result = this.UpdatesManager._summarizeUpdates([
        {
          doc_id: 'doc-id-1',
          op: [{ d: 'this is a long long long long long delete', p: 34 }],
          meta: {
            user_id: this.user_1.id,
            start_ts: this.now + 20,
            end_ts: this.now + 30,
          },
          v: 5,
        },
        {
          doc_id: 'doc-id-1',
          meta: {
            user_id: this.user_2.id,
            start_ts: this.now,
            end_ts: this.now + 10,
          },
          v: 4,
        },
      ])

      return expect(result).to.deep.equal([
        {
          docs: {
            'doc-id-1': {
              fromV: 5,
              toV: 5,
            },
          },
          meta: {
            user_ids: [this.user_1.id],
            start_ts: this.now + 20,
            end_ts: this.now + 30,
          },
        },
        {
          docs: {
            'doc-id-1': {
              fromV: 4,
              toV: 4,
            },
          },
          meta: {
            user_ids: [this.user_2.id],
            start_ts: this.now,
            end_ts: this.now + 10,
          },
        },
      ])
    })
  })
})
