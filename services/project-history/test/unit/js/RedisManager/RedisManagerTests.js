/* eslint-disable
    camelcase,
    mocha/no-identical-title,
    no-return-assign,
    no-undef,
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
import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/RedisManager.js'

describe('RedisManager', function () {
  beforeEach(async function () {
    this.rclient = {
      auth: sinon.stub(),
      exec: sinon.stub().yields(),
      lrange: sinon.stub(),
      lrem: sinon.stub(),
      srem: sinon.stub(),
      del: sinon.stub(),
    }
    this.rclient.multi = sinon.stub().returns(this.rclient)
    this.RedisWrapper = {
      createClient: sinon.stub().returns(this.rclient),
    }
    this.Settings = {
      redis: {
        project_history: {
          key_schema: {
            projectHistoryOps({ project_id }) {
              return `Project:HistoryOps:${project_id}`
            },
            projectHistoryFirstOpTimestamp({ project_id }) {
              return `ProjectHistory:FirstOpTimestamp:{${project_id}}`
            },
          },
        },
      },
    }
    this.Metrics = {
      timing: sinon.stub(),
      summary: sinon.stub(),
      globalGauge: sinon.stub(),
    }
    this.RedisManager = await esmock(MODULE_PATH, {
      '@overleaf/redis-wrapper': this.RedisWrapper,
      '@overleaf/settings': this.Settings,
      '@overleaf/metrics': this.Metrics,
    })

    this.project_id = 'project-id-123'
    this.batch_size = 100

    this.updates = [
      { v: 42, op: 'mock-op-42' },
      { v: 45, op: 'mock-op-45' },
    ]
    this.json_updates = Array.from(this.updates).map(update =>
      JSON.stringify(update)
    )

    return (this.callback = sinon.stub())
  })

  describe('getOldestDocUpdates', function () {
    beforeEach(function () {
      this.rclient.lrange.yields(null, this.json_updates)
      return this.RedisManager.getOldestDocUpdates(
        this.project_id,
        this.batch_size,
        this.callback
      )
    })

    it('should read the updates from redis', function () {
      return this.rclient.lrange
        .calledWith(
          `Project:HistoryOps:${this.project_id}`,
          0,
          this.batch_size - 1
        )
        .should.equal(true)
    })

    return it('should call the callback with the unparsed ops', function () {
      return this.callback
        .calledWith(null, this.json_updates)
        .should.equal(true)
    })
  })

  describe('parseDocUpdates', function () {
    beforeEach(function () {
      return this.RedisManager.parseDocUpdates(this.json_updates, this.callback)
    })

    return it('should call the callback with the parsed ops', function () {
      return this.callback.calledWith(null, this.updates).should.equal(true)
    })
  })

  describe('deleteAppliedDocUpdates', function () {
    beforeEach(function () {
      return this.RedisManager.deleteAppliedDocUpdates(
        this.project_id,
        this.json_updates,
        this.callback
      )
    })

    it('should delete the first update from redis', function () {
      this.rclient.lrem.should.have.been.calledWith(
        `Project:HistoryOps:${this.project_id}`,
        1,
        this.json_updates[0]
      )
    })

    it('should delete the second update from redis', function () {
      return this.rclient.lrem
        .calledWith(
          `Project:HistoryOps:${this.project_id}`,
          1,
          this.json_updates[1]
        )
        .should.equal(true)
    })

    it('should clear the first op timestamp', function () {
      return this.rclient.del
        .calledWith(`ProjectHistory:FirstOpTimestamp:{${this.project_id}}`)
        .should.equal(true)
    })

    return it('should call the callback ', function () {
      return this.callback.called.should.equal(true)
    })
  })

  return describe('getUpdatesInBatches', function () {
    beforeEach(function () {
      this.rawUpdates = ['raw-update-1', 'raw-update-2']
      this.expandedUpdates = ['expanded-update-1', 'expanded-update-2']
      this.RedisManager._mocks.deleteAppliedDocUpdates = sinon.stub().yields()

      this.isProjectHistoryEnabled = true
      return (this.runner = sinon
        .stub()
        .yields(null, this.isProjectHistoryEnabled))
    })

    describe('single batch smaller than batch size', function () {
      beforeEach(function (done) {
        this.RedisManager._mocks.getOldestDocUpdates = sinon
          .stub()
          .yields(null, this.rawUpdates)
        this.RedisManager._mocks.parseDocUpdates = sinon
          .stub()
          .yields(null, this.expandedUpdates)
        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          3,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a single batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          1
        )
      })

      it('calls the runner once', function () {
        return this.runner.callCount.should.equal(1)
      })

      it('calls the runner with the updates', function () {
        return this.runner.calledWith(this.expandedUpdates).should.equal(true)
      })

      it('deletes the applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals(this.rawUpdates)
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('single batch at batch size', function () {
      beforeEach(function (done) {
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates)
        this.RedisManager._mocks.getOldestDocUpdates.onCall(1).yields(null, [])
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner once', function () {
        return this.runner.callCount.should.equal(1)
      })

      it('calls the runner with the updates', function () {
        return this.runner.calledWith(this.expandedUpdates).should.equal(true)
      })

      it('deletes the applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals(this.rawUpdates)
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('single batch exceeding size limit on updates', function () {
      beforeEach(function (done) {
        this.rawUpdates0 = ['raw-update-1-12345678', 'raw-update-2-12345678']
        this.rawUpdates1 = ['raw-update-2-12345678']
        this.expandedUpdates0 = ['expanded-update-1']
        this.expandedUpdates1 = ['expanded-update-2']
        // set the threshold below the size of the first update
        this.RedisManager.setRawUpdateSizeThreshold(
          this.rawUpdates0[0].length - 1
        )
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates0)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(null, this.rawUpdates1)
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates0)
        this.RedisManager._mocks.parseDocUpdates
          .onCall(1)
          .yields(null, this.expandedUpdates1)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner twice', function () {
        return this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first updates', function () {
        return this.runner.calledWith(this.expandedUpdates0).should.equal(true)
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[0]])
          )
          .should.equal(true)
      })

      it('calls the runner with the second updates', function () {
        return this.runner.calledWith(this.expandedUpdates1).should.equal(true)
      })

      it('deletes the second set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[1]])
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('two batches with first update below and second update above the size limit on updates', function () {
      beforeEach(function (done) {
        this.rawUpdates0 = ['raw-update-1', 'raw-update-2-12345678']
        this.rawUpdates1 = ['raw-update-2-12345678']
        this.expandedUpdates0 = ['expanded-update-1']
        this.expandedUpdates1 = ['expanded-update-2']
        // set the threshold above the size of the first update, but below the total size
        this.RedisManager.setRawUpdateSizeThreshold(
          this.rawUpdates0[0].length + 1
        )
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates0)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(null, this.rawUpdates1)
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates0)
        this.RedisManager._mocks.parseDocUpdates
          .onCall(1)
          .yields(null, this.expandedUpdates1)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner twice', function () {
        return this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        return this.runner.calledWith(this.expandedUpdates0).should.equal(true)
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[0]])
          )
          .should.equal(true)
      })

      it('calls the runner with the second update', function () {
        return this.runner.calledWith(this.expandedUpdates1).should.equal(true)
      })

      it('deletes the second set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[1]])
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('single batch exceeding op count limit on updates', function () {
      beforeEach(function (done) {
        this.rawUpdates0 = [
          "{op: ['a', 'b', 'c', 'd']}",
          "{op:['e', 'f', 'g', 'h']}",
        ]
        this.rawUpdates1 = ["{op:['e', 'f', 'g', 'h']}"]
        this.expandedUpdates0 = [
          { op: ['a', 'b', 'c', 'd'] },
          { op: ['e', 'f', 'g', 'h'] },
        ]
        this.expandedUpdates1 = [{ op: ['e', 'f', 'g', 'h'] }]
        // set the threshold below the size of the first update
        this.RedisManager.setMaxUpdateOpLength(
          this.expandedUpdates0[0].op.length - 1
        )
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates0)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(null, this.rawUpdates1)
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates0)
        this.RedisManager._mocks.parseDocUpdates
          .onCall(1)
          .yields(null, this.expandedUpdates1)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner twice', function () {
        return this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first updates', function () {
        return this.runner
          .calledWith([this.expandedUpdates0[0]])
          .should.equal(true)
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[0]])
          )
          .should.equal(true)
      })

      it('calls the runner with the second updates', function () {
        return this.runner.calledWith(this.expandedUpdates1).should.equal(true)
      })

      it('deletes the second set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[1]])
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('single batch exceeding doc content count', function () {
      beforeEach(function (done) {
        this.rawUpdates0 = [
          '{resyncDocContent: 123}',
          '{resyncDocContent: 456}',
        ]
        this.rawUpdates1 = ['{resyncDocContent: 456}']
        this.expandedUpdates0 = [
          { resyncDocContent: 123 },
          { resyncDocContent: 456 },
        ]
        this.expandedUpdates1 = [{ resyncDocContent: 456 }]
        // set the threshold below the size of the first update
        this.RedisManager.setMaxNewDocContentCount(
          this.expandedUpdates0.length - 1
        )
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates0)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(null, this.rawUpdates1)
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates0)
        this.RedisManager._mocks.parseDocUpdates
          .onCall(1)
          .yields(null, this.expandedUpdates1)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner twice', function () {
        return this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first updates', function () {
        return this.runner
          .calledWith([this.expandedUpdates0[0]])
          .should.equal(true)
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[0]])
          )
          .should.equal(true)
      })

      it('calls the runner with the second updates', function () {
        return this.runner.calledWith(this.expandedUpdates1).should.equal(true)
      })

      it('deletes the second set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[1]])
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('two batches with first update below and second update above the size limit on updates', function () {
      beforeEach(function (done) {
        this.rawUpdates0 = [
          "{op: ['a', 'b', 'c', 'd']}",
          "{op:['e', 'f', 'g', 'h']}",
        ]
        this.rawUpdates1 = ["{op:['e', 'f', 'g', 'h']}"]
        this.expandedUpdates0 = [
          { op: ['a', 'b', 'c', 'd'] },
          { op: ['e', 'f', 'g', 'h'] },
        ]
        this.expandedUpdates1 = [{ op: ['e', 'f', 'g', 'h'] }]
        // set the threshold below the size of the first update
        this.RedisManager.setMaxUpdateOpLength(
          this.expandedUpdates0[0].op.length + 1
        )
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates0)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(null, this.rawUpdates1)
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates0)
        this.RedisManager._mocks.parseDocUpdates
          .onCall(1)
          .yields(null, this.expandedUpdates1)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner twice', function () {
        return this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first updates', function () {
        return this.runner
          .calledWith([this.expandedUpdates0[0]])
          .should.equal(true)
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[0]])
          )
          .should.equal(true)
      })

      it('calls the runner with the second updates', function () {
        return this.runner.calledWith(this.expandedUpdates1).should.equal(true)
      })

      it('deletes the second set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals([this.rawUpdates0[1]])
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('two batches', function () {
      beforeEach(function (done) {
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(null, ['raw-update-3'])
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates)
        this.RedisManager._mocks.parseDocUpdates
          .onCall(1)
          .yields(null, ['expanded-update-3'])

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('requests a second batch of updates', function () {
        return this.RedisManager._mocks.getOldestDocUpdates.callCount.should.equal(
          2
        )
      })

      it('calls the runner twice', function () {
        return this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the updates', function () {
        return this.runner.calledWith(this.expandedUpdates).should.equal(true)
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals(this.rawUpdates)
          )
          .should.equal(true)
      })

      it('deletes the second set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals(['raw-update-3'])
          )
          .should.equal(true)
      })

      return it('calls the callback with the result of the runner', function () {
        return this.callback
          .calledWith(null, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })

    describe('error when first reading updates', function () {
      beforeEach(function (done) {
        this.error = new Error('error')
        this.RedisManager._mocks.getOldestDocUpdates = sinon
          .stub()
          .yields(this.error)
        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('does not delete any updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates.called.should.equal(
          false
        )
      })

      return it('calls the callback with the error', function () {
        return this.callback
          .calledWith(this.error, undefined)
          .should.equal(true)
      })
    })

    return describe('error when reading updates for a second batch', function () {
      beforeEach(function (done) {
        this.error = new Error('error')
        this.RedisManager._mocks.getOldestDocUpdates = sinon.stub()
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(0)
          .yields(null, this.rawUpdates)
        this.RedisManager._mocks.getOldestDocUpdates
          .onCall(1)
          .yields(this.error)
        this.RedisManager._mocks.parseDocUpdates = sinon.stub()
        this.RedisManager._mocks.parseDocUpdates
          .onCall(0)
          .yields(null, this.expandedUpdates)

        return this.RedisManager.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner,
          (error, isProjectHistoryEnabled) => {
            this.callback(error, isProjectHistoryEnabled)
            return done()
          }
        )
      })

      it('deletes the first set of applied updates', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates
          .calledWith(
            this.project_id,
            sinon.match.array.deepEquals(this.rawUpdates)
          )
          .should.equal(true)
      })

      it('deletes applied updates only once', function () {
        return this.RedisManager._mocks.deleteAppliedDocUpdates.callCount.should.equal(
          1
        )
      })

      return it('calls the callback with the error and the first result of the runner', function () {
        return this.callback
          .calledWith(this.error, this.isProjectHistoryEnabled)
          .should.equal(true)
      })
    })
  })
})
