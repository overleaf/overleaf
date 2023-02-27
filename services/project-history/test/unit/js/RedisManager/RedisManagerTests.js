import { expect } from 'chai'
import sinon from 'sinon'
import { strict as esmock } from 'esmock'

const MODULE_PATH = '../../../../app/js/RedisManager.js'

describe('RedisManager', function () {
  beforeEach(async function () {
    this.rclient = new FakeRedis()
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

    this.projectId = 'project-id-123'
    this.batchSize = 100
    this.historyOpsKey = `Project:HistoryOps:{${this.projectId}}`
    this.firstOpTimestampKey = `ProjectHistory:FirstOpTimestamp:{${this.projectId}}`

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

  describe('getRawUpdatesBatch', function () {
    it('gets a small number of updates in one batch', async function () {
      const updates = makeUpdates(2)
      const rawUpdates = makeRawUpdates(updates)
      this.rclient.setList(this.historyOpsKey, rawUpdates)
      const result = await this.RedisManager.promises.getRawUpdatesBatch(
        this.projectId,
        100
      )
      expect(result).to.deep.equal({ rawUpdates, hasMore: false })
    })

    it('gets a larger number of updates in several batches', async function () {
      const updates = makeUpdates(
        this.RedisManager.RAW_UPDATES_BATCH_SIZE * 2 + 12
      )
      const rawUpdates = makeRawUpdates(updates)
      this.rclient.setList(this.historyOpsKey, rawUpdates)
      const result = await this.RedisManager.promises.getRawUpdatesBatch(
        this.projectId,
        5000
      )
      expect(result).to.deep.equal({ rawUpdates, hasMore: false })
    })

    it("doesn't return more than the number of updates requested", async function () {
      const updates = makeUpdates(100)
      const rawUpdates = makeRawUpdates(updates)
      this.rclient.setList(this.historyOpsKey, rawUpdates)
      const result = await this.RedisManager.promises.getRawUpdatesBatch(
        this.projectId,
        75
      )
      expect(result).to.deep.equal({
        rawUpdates: rawUpdates.slice(0, 75),
        hasMore: true,
      })
    })
  })

  describe('parseDocUpdates', function () {
    it('should return the parsed ops', function () {
      const updates = makeUpdates(12)
      const rawUpdates = makeRawUpdates(updates)
      this.RedisManager.parseDocUpdates(rawUpdates).should.deep.equal(updates)
    })
  })

  describe('getUpdatesInBatches', function () {
    beforeEach(function () {
      this.runner = sinon.stub().resolves()
    })

    describe('single batch smaller than batch size', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(2)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          3,
          this.runner
        )
      })

      it('calls the runner once', function () {
        this.runner.callCount.should.equal(1)
      })

      it('calls the runner with the updates', function () {
        this.runner.should.have.been.calledWith(this.updates)
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })

      it('deletes the first op timestamp', function () {
        expect(this.rclient.del).to.have.been.calledWith(
          this.firstOpTimestampKey
        )
      })
    })

    describe('single batch at batch size', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(123)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          123,
          this.runner
        )
      })

      it('calls the runner once', function () {
        this.runner.callCount.should.equal(1)
      })

      it('calls the runner with the updates', function () {
        this.runner.should.have.been.calledWith(this.updates)
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })

      it('deletes the first op timestamp', function () {
        expect(this.rclient.del).to.have.been.calledWith(
          this.firstOpTimestampKey
        )
      })
    })

    describe('single batch exceeding size limit on updates', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(2, [
          'x'.repeat(this.RedisManager.RAW_UPDATE_SIZE_THRESHOLD),
        ])
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          123,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('calls the runner with the second update', function () {
        this.runner
          .getCall(1)
          .should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('two batches with first update below and second update above the size limit on updates', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(2, [
          'x'.repeat(this.RedisManager.RAW_UPDATE_SIZE_THRESHOLD / 2),
        ])
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          123,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('calls the runner with the second update', function () {
        this.runner
          .getCall(1)
          .should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('single batch exceeding op count limit on updates', function () {
      beforeEach(async function () {
        const ops = Array(this.RedisManager.MAX_UPDATE_OP_LENGTH + 1).fill('op')
        this.updates = makeUpdates(2, { op: ops })
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          123,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('calls the runner with the second update', function () {
        this.runner
          .getCall(1)
          .should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('single batch exceeding doc content count', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(
          this.RedisManager.MAX_NEW_DOC_CONTENT_COUNT + 3,
          { resyncDocContent: 123 }
        )
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          123,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first batch of updates', function () {
        this.runner.should.have.been.calledWith(
          this.updates.slice(0, this.RedisManager.MAX_NEW_DOC_CONTENT_COUNT)
        )
      })

      it('calls the runner with the second batch of updates', function () {
        this.runner.should.have.been.calledWith(
          this.updates.slice(this.RedisManager.MAX_NEW_DOC_CONTENT_COUNT)
        )
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('two batches with first update below and second update above the ops length limit on updates', function () {
      beforeEach(async function () {
        // set the threshold below the size of the first update
        this.updates = makeUpdates(2, { op: ['op1', 'op2'] })
        this.updates[1].op = Array(
          this.RedisManager.MAX_UPDATE_OP_LENGTH + 2
        ).fill('op')
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          123,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the first update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(0, 1))
      })

      it('calls the runner with the second update', function () {
        this.runner.should.have.been.calledWith(this.updates.slice(1))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('two batches, one partial', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(15)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          10,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the updates', function () {
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, 10))
        this.runner
          .getCall(1)
          .should.have.been.calledWith(this.updates.slice(10))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('two full batches', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(20)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          10,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(2)
      })

      it('calls the runner with the updates', function () {
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, 10))
        this.runner
          .getCall(1)
          .should.have.been.calledWith(this.updates.slice(10))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('three full bathches, bigger than the Redis read batch size', function () {
      beforeEach(async function () {
        this.batchSize = this.RedisManager.RAW_UPDATES_BATCH_SIZE * 2
        this.updates = makeUpdates(this.batchSize * 3)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        await this.RedisManager.promises.getUpdatesInBatches(
          this.projectId,
          this.batchSize,
          this.runner
        )
      })

      it('calls the runner twice', function () {
        this.runner.callCount.should.equal(3)
      })

      it('calls the runner with the updates', function () {
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, this.batchSize))
        this.runner
          .getCall(1)
          .should.have.been.calledWith(
            this.updates.slice(this.batchSize, this.batchSize * 2)
          )
        this.runner
          .getCall(2)
          .should.have.been.calledWith(this.updates.slice(this.batchSize * 2))
      })

      it('deletes the applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal([])
      })
    })

    describe('error when first reading updates', function () {
      beforeEach(async function () {
        this.updates = makeUpdates(10)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        this.rclient.throwErrorOnLrangeCall(0)
        await expect(
          this.RedisManager.promises.getUpdatesInBatches(
            this.projectId,
            2,
            this.runner
          )
        ).to.be.rejected
      })

      it('does not delete any updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal(
          this.rawUpdates
        )
      })
    })

    describe('error when reading updates for a second batch', function () {
      beforeEach(async function () {
        this.batchSize = this.RedisManager.RAW_UPDATES_BATCH_SIZE - 1
        this.updates = makeUpdates(this.RedisManager.RAW_UPDATES_BATCH_SIZE * 2)
        this.rawUpdates = makeRawUpdates(this.updates)
        this.rclient.setList(this.historyOpsKey, this.rawUpdates)
        this.rclient.throwErrorOnLrangeCall(1)
        await expect(
          this.RedisManager.promises.getUpdatesInBatches(
            this.projectId,
            this.batchSize,
            this.runner
          )
        ).to.be.rejected
      })

      it('calls the runner with the first batch of updates', function () {
        this.runner.should.have.been.calledOnce
        this.runner
          .getCall(0)
          .should.have.been.calledWith(this.updates.slice(0, this.batchSize))
      })

      it('deletes only the first batch of applied updates', function () {
        expect(this.rclient.getList(this.historyOpsKey)).to.deep.equal(
          this.rawUpdates.slice(this.batchSize)
        )
      })
    })
  })
})

class FakeRedis {
  constructor() {
    this.data = new Map()
    this.del = sinon.stub()
    this.lrangeCallCount = -1
  }

  setList(key, list) {
    this.data.set(key, list)
  }

  getList(key) {
    return this.data.get(key)
  }

  throwErrorOnLrangeCall(callNum) {
    this.lrangeCallThrowingError = callNum
  }

  async lrange(key, start, stop) {
    this.lrangeCallCount += 1
    if (
      this.lrangeCallThrowingError != null &&
      this.lrangeCallThrowingError === this.lrangeCallCount
    ) {
      throw new Error('LRANGE failed!')
    }
    const list = this.data.get(key) ?? []
    return list.slice(start, stop + 1)
  }

  async lrem(key, count, elementToRemove) {
    expect(count).to.be.greaterThan(0)
    const original = this.data.get(key) ?? []
    const filtered = original.filter(element => {
      if (count > 0 && element === elementToRemove) {
        count--
        return false
      }
      return true
    })
    this.data.set(key, filtered)
  }

  async exec() {
    // Nothing to do
  }

  multi() {
    return this
  }
}

function makeUpdates(updateCount, extraFields = {}) {
  const updates = []
  for (let i = 0; i < updateCount; i++) {
    updates.push({ v: i, ...extraFields })
  }
  return updates
}

function makeRawUpdates(updates) {
  return updates.map(JSON.stringify)
}
