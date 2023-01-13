/* eslint-disable
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import { strict as esmock } from 'esmock'
import tk from 'timekeeper'

const MODULE_PATH = '../../../../app/js/ErrorRecorder.js'

describe('ErrorRecorder', function () {
  beforeEach(async function () {
    this.now = new Date()
    tk.freeze(this.now)
    this.callback = sinon.stub()
    this.db = {
      projectHistoryFailures: {
        deleteOne: sinon.stub().yields(),
        updateOne: sinon.stub().yields(),
      },
    }
    this.mongodb = { db: this.db }
    this.metrics = { gauge: sinon.stub() }
    this.ErrorRecorder = await esmock(MODULE_PATH, {
      '../../../../app/js/mongodb.js': this.mongodb,
      '@overleaf/metrics': this.metrics,
    })

    this.project_id = 'project-id-123'
    return (this.queueSize = 445)
  })

  afterEach(function () {
    return tk.reset()
  })

  return describe('record', function () {
    describe('with an error', function () {
      beforeEach(function () {
        this.error = new Error('something bad')
        return this.ErrorRecorder.record(
          this.project_id,
          this.queueSize,
          this.error,
          this.callback
        )
      })

      it('should record the error to mongo', function () {
        return this.db.projectHistoryFailures.updateOne
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

      return it('should call the callback', function () {
        return this.callback
          .calledWith(this.error, this.queueSize)
          .should.equal(true)
      })
    })

    return describe('without an error', function () {
      beforeEach(function () {
        return this.ErrorRecorder.record(
          this.project_id,
          this.queueSize,
          this.error,
          this.callback
        )
      })

      it('should remove any error from mongo', function () {
        return this.db.projectHistoryFailures.deleteOne
          .calledWithMatch({ project_id: this.project_id })
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.calledWith(null, this.queueSize).should.equal(true)
      })
    })
  })
})
