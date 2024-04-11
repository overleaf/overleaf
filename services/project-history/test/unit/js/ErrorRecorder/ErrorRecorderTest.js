import sinon from 'sinon'
import { expect } from 'chai'
import { strict as esmock } from 'esmock'
import tk from 'timekeeper'

const MODULE_PATH = '../../../../app/js/ErrorRecorder.js'

describe('ErrorRecorder', function () {
  beforeEach(async function () {
    this.now = new Date()
    tk.freeze(this.now)
    this.db = {
      projectHistoryFailures: {
        deleteOne: sinon.stub().resolves(),
        updateOne: sinon.stub().resolves(),
      },
    }
    this.mongodb = { db: this.db }
    this.metrics = { gauge: sinon.stub() }
    this.ErrorRecorder = await esmock(MODULE_PATH, {
      '../../../../app/js/mongodb.js': this.mongodb,
      '@overleaf/metrics': this.metrics,
    })

    this.project_id = 'project-id-123'
    this.queueSize = 445
  })

  afterEach(function () {
    tk.reset()
  })

  describe('record', function () {
    describe('with an error', function () {
      beforeEach(async function () {
        this.error = new Error('something bad')
        await expect(
          this.ErrorRecorder.promises.record(
            this.project_id,
            this.queueSize,
            this.error
          )
        ).to.be.rejected
      })

      it('should record the error to mongo', function () {
        this.db.projectHistoryFailures.updateOne
          .calledWithMatch(
            {
              project_id: this.project_id,
            },
            {
              $set: {
                queueSize: this.queueSize,
                error: this.error.toString(),
                stack: this.error.stack,
                ts: this.now,
              },
              $inc: {
                attempts: 1,
              },
              $push: {
                history: {
                  $each: [
                    {
                      queueSize: this.queueSize,
                      error: this.error.toString(),
                      stack: this.error.stack,
                      ts: this.now,
                    },
                  ],
                  $position: 0,
                  $slice: 10,
                },
              },
            },
            {
              upsert: true,
            }
          )
          .should.equal(true)
      })
    })

    describe('without an error', function () {
      beforeEach(async function () {
        this.result = await this.ErrorRecorder.promises.record(
          this.project_id,
          this.queueSize,
          this.error
        )
      })

      it('should remove any error from mongo', function () {
        this.db.projectHistoryFailures.deleteOne
          .calledWithMatch({ project_id: this.project_id })
          .should.equal(true)
      })

      it('should return the queue size', function () {
        expect(this.result).to.equal(this.queueSize)
      })
    })
  })
})
