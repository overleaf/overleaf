/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RateLimiter
const Settings = require('@overleaf/settings')
const logger = require('logger-sharelatex')
const Metrics = require('./Metrics')

module.exports = RateLimiter = class RateLimiter {
  constructor(number) {
    if (number == null) {
      number = 10
    }
    this.ActiveWorkerCount = 0
    this.CurrentWorkerLimit = number
    this.BaseWorkerCount = number
  }

  _adjustLimitUp() {
    this.CurrentWorkerLimit += 0.1 // allow target worker limit to increase gradually
    return Metrics.gauge('currentLimit', Math.ceil(this.CurrentWorkerLimit))
  }

  _adjustLimitDown() {
    this.CurrentWorkerLimit = Math.max(
      this.BaseWorkerCount,
      this.CurrentWorkerLimit * 0.9
    )
    logger.log(
      { currentLimit: Math.ceil(this.CurrentWorkerLimit) },
      'reducing rate limit'
    )
    return Metrics.gauge('currentLimit', Math.ceil(this.CurrentWorkerLimit))
  }

  _trackAndRun(task, callback) {
    if (callback == null) {
      callback = function () {}
    }
    this.ActiveWorkerCount++
    Metrics.gauge('processingUpdates', this.ActiveWorkerCount)
    return task(err => {
      this.ActiveWorkerCount--
      Metrics.gauge('processingUpdates', this.ActiveWorkerCount)
      return callback(err)
    })
  }

  run(task, callback) {
    if (this.ActiveWorkerCount < this.CurrentWorkerLimit) {
      this._trackAndRun(task) // below the limit, just put the task in the background
      callback() // return immediately
      if (this.CurrentWorkerLimit > this.BaseWorkerCount) {
        return this._adjustLimitDown()
      }
    } else {
      logger.log(
        {
          active: this.ActiveWorkerCount,
          currentLimit: Math.ceil(this.CurrentWorkerLimit),
        },
        'hit rate limit'
      )
      return this._trackAndRun(task, err => {
        if (err == null) {
          this._adjustLimitUp()
        } // don't increment rate limit if there was an error
        return callback(err)
      }) // only return after task completes
    }
  }
}
