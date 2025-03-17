import sinon from 'sinon'
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
        findOneAndUpdate: sinon
          .stub()
          .resolves({ value: { failure: 'record' } }),
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
    beforeEach(async function () {
      this.error = new Error('something bad')
      await this.ErrorRecorder.promises.record(
        this.project_id,
        this.queueSize,
        this.error
      )
    })

    it('should record the error to mongo', function () {
      this.db.projectHistoryFailures.findOneAndUpdate
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

  describe('clearError', function () {
    beforeEach(async function () {
      this.result = await this.ErrorRecorder.promises.clearError(
        this.project_id
      )
    })

    it('should remove any error from mongo', function () {
      this.db.projectHistoryFailures.deleteOne
        .calledWithMatch({ project_id: this.project_id })
        .should.equal(true)
    })
  })
})
