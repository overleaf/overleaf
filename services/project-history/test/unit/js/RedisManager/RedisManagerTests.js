import { expect } from 'chai'
import sinon from 'sinon'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/RedisManager.js'

describe('RedisManager', function () {
  beforeEach(async function () {
    this.rclient = {
      auth: sinon.stub(),
      exec: sinon.stub().resolves(),
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
            projectHistoryOps({ project_id: projectId }) {
              return `Project:HistoryOps:{${projectId}}`
            },
            projectHistoryFirstOpTimestamp({ project_id: projectId }) {
              return `ProjectHistory:FirstOpTimestamp:{${projectId}}`
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
    this.batchSize = 100
    this.historyOpsKey = `Project:HistoryOps:{${this.project_id}}`
    this.firstOpTimestampKey = `ProjectHistory:FirstOpTimestamp:{${this.project_id}}`

    this.updates = [
      { v: 42, op: ['a', 'b', 'c', 'd'] },
      { v: 45, op: ['e', 'f', 'g', 'h'] },
    ]
    this.extraUpdates = [{ v: 100, op: ['i', 'j', 'k'] }]
    this.rawUpdates = this.updates.map(update => JSON.stringify(update))
    this.extraRawUpdates = this.extraUpdates.map(update =>
      JSON.stringify(update)
    )
  })

  describe('getOldestDocUpdates', function () {
    beforeEach(async function () {
      this.rclient.lrange.resolves(this.rawUpdates)
      this.batchSize = 3
      this.result = await this.RedisManager.promises.getOldestDocUpdates(
        this.project_id,
        this.batchSize
      )
    })

    it('should read the updates from redis', function () {
      this.rclient.lrange
        .calledWith(this.historyOpsKey, 0, this.batchSize - 1)
        .should.equal(true)
    })

    it('should call the callback with the unparsed ops', function () {
      this.result.should.equal(this.rawUpdates)
    })
  })

  describe('parseDocUpdates', function () {
    it('should return the parsed ops', function () {
      this.RedisManager.parseDocUpdates(this.rawUpdates).should.deep.equal(
        this.updates
      )
    })
  })

  describe('getUpdatesInBatches', function () {
    beforeEach(function () {
      this.runner = sinon.stub().resolves()
    })

    describe('single batch smaller than batch size', function () {
      beforeEach(async function () {
        this.rclient.lrange.resolves(this.rawUpdates)
        this.batchSize = 3
        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          this.batchSize,
          this.runner
        )
      })

      it('requests a single batch of updates', function () {
        this.rclient.lrange.should.have.been.calledOnce
        this.rclient.lrange.should.have.been.calledWith(
          this.historyOpsKey,
          0,
          this.batchSize - 1
        )
      })

      it('calls the runner once', function () {
        this.runner.callCount.should.equal(1)
      })

      it('calls the runner with the updates', function () {
        this.runner.calledWith(this.updates).should.equal(true)
      })

      it('deletes the applied updates', function () {
        for (const update of this.rawUpdates) {
          expect(this.rclient.lrem).to.have.been.calledWith(
            this.historyOpsKey,
            1,
            update
          )
        }
      })

      it('deletes the first op timestamp', function () {
        expect(this.rclient.del).to.have.been.calledWith(
          this.firstOpTimestampKey
        )
      })
    })

    describe('single batch at batch size', function () {
      beforeEach(async function () {
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves([])
        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner once', function () {
        this.runner.callCount.should.equal(1)
      })

      it('calls the runner with the updates', function () {
        this.runner.calledWith(this.updates).should.equal(true)
      })

      it('deletes the applied updates', function () {
        for (const update of this.rawUpdates) {
          expect(this.rclient.lrem).to.have.been.calledWith(
            this.historyOpsKey,
            1,
            update
          )
        }
      })

      it('deletes the first op timestamp', function () {
        expect(this.rclient.del).to.have.been.calledWith(
          this.firstOpTimestampKey
        )
      })
    })

    describe('single batch exceeding size limit on updates', function () {
      beforeEach(async function () {
        // set the threshold below the size of the first update
        this.RedisManager.setRawUpdateSizeThreshold(
          this.rawUpdates[0].length - 1
        )
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves(this.rawUpdates.slice(1))

        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('deletes the first update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[0]
        )
      })

      it('calls the runner with the second update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the second set of applied updates', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[1]
        )
      })
    })

    describe('two batches with first update below and second update above the size limit on updates', function () {
      beforeEach(async function () {
        // set the threshold above the size of the first update, but below the total size
        this.RedisManager.setRawUpdateSizeThreshold(
          this.rawUpdates[0].length + 1
        )
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves(this.rawUpdates.slice(1))
        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner.calledWith(this.updates.slice(0, 1)).should.equal(true)
      })

      it('deletes the first set applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[0]
        )
      })

      it('calls the runner with the second update', function () {
        this.runner.calledWith(this.updates.slice(1)).should.equal(true)
      })

      it('deletes the second applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[1]
        )
      })
    })

    describe('single batch exceeding op count limit on updates', function () {
      beforeEach(async function () {
        // set the threshold below the size of the first update
        this.RedisManager.setMaxUpdateOpLength(this.updates[0].op.length - 1)
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves(this.rawUpdates.slice(1))

        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first updates', function () {
        this.runner.calledWith(this.updates.slice(0, 1)).should.equal(true)
      })

      it('deletes the first applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[0]
        )
      })

      it('calls the runner with the second updates', function () {
        this.runner.calledWith(this.updates.slice(1)).should.equal(true)
      })

      it('deletes the second applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[1]
        )
      })
    })

    describe('single batch exceeding doc content count', function () {
      beforeEach(async function () {
        this.updates = [{ resyncDocContent: 123 }, { resyncDocContent: 456 }]
        this.rawUpdates = this.updates.map(update => JSON.stringify(update))
        // set the threshold below the size of the first update
        this.RedisManager.setMaxNewDocContentCount(this.updates.length - 1)
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves(this.rawUpdates.slice(1))

        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('deletes the first applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[0]
        )
      })

      it('calls the runner with the second update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the second set of applied updates', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[1]
        )
      })
    })

    describe('two batches with first update below and second update above the ops length limit on updates', function () {
      beforeEach(async function () {
        // set the threshold below the size of the first update
        this.RedisManager.setMaxUpdateOpLength(this.updates[0].op.length + 1)
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves(this.rawUpdates.slice(1))

        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('deletes the first applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[0]
        )
      })

      it('calls the runner with the second update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the second applied update', function () {
        expect(this.rclient.lrem).to.have.been.calledWith(
          this.historyOpsKey,
          1,
          this.rawUpdates[1]
        )
      })
    })

    describe('two batches', function () {
      beforeEach(async function () {
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).resolves(this.extraRawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.project_id,
          2,
          this.runner
        )
      })

      it('requests a second batch of updates', function () {
        this.rclient.lrange.should.have.been.calledTwice
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the updates', function () {
        this.runner.should.have.been.calledWith(this.updates)
        this.runner.should.have.been.calledWith(this.extraUpdates)
      })

      it('deletes the first set of applied updates', function () {
        for (const update of this.rawUpdates) {
          expect(this.rclient.lrem).to.have.been.calledWith(
            this.historyOpsKey,
            1,
            update
          )
        }
      })

      it('deletes the second set of applied updates', function () {
        for (const update of this.extraRawUpdates) {
          expect(this.rclient.lrem).to.have.been.calledWith(
            this.historyOpsKey,
            1,
            update
          )
        }
      })
    })

    describe('error when first reading updates', function () {
      beforeEach(async function () {
        this.error = new Error('error')
        this.rclient.lrange.rejects(this.error)
        await expect(
          this.RedisManager.promises.getUpdatesInBatches(
            this.project_id,
            2,
            this.runner
          )
        ).to.be.rejected
      })

      it('does not delete any updates', function () {
        expect(this.rclient.lrem).not.to.have.been.called
      })
    })

    describe('error when reading updates for a second batch', function () {
      beforeEach(async function () {
        this.error = new Error('error')
        this.rclient.lrange.onCall(0).resolves(this.rawUpdates)
        this.rclient.lrange.onCall(1).rejects(this.error)

        await expect(
          this.RedisManager.promises.getUpdatesInBatches(
            this.project_id,
            2,
            this.runner
          )
        ).to.be.rejected
      })

      it('deletes the first set of applied updates', function () {
        for (const update of this.rawUpdates) {
          expect(this.rclient.lrem).to.have.been.calledWith(
            this.historyOpsKey,
            1,
            update
          )
        }
      })

      it('deletes applied updates only once', function () {
        expect(this.rclient.lrem.callCount).to.equal(this.rawUpdates.length)
      })
    })
  })
})
