// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ASpellWorker = require('./ASpellWorker')
const _ = require('underscore')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

class ASpellWorkerPool {
  static initClass() {
    this.prototype.MAX_REQUESTS = 100 * 1024
    this.prototype.MAX_WORKERS = 32
    this.prototype.MAX_IDLE_TIME = 1000
    this.prototype.MAX_REQUEST_TIME = 60 * 1000
  }

  constructor(options) {
    this.options = options
    this.PROCESS_POOL = []
  }

  create(language) {
    if (this.PROCESS_POOL.length >= this.MAX_WORKERS) {
      logger.log(
        { maxworkers: this.MAX_WORKERS },
        'maximum number of workers already running'
      )
      return null
    }
    const worker = new ASpellWorker(language, this.options)
    worker.pipe.on('exit', () => {
      if (worker.killTimer != null) {
        clearTimeout(worker.killTimer)
        worker.killTimer = null
      }
      if (worker.idleTimer != null) {
        clearTimeout(worker.idleTimer)
        worker.idleTimer = null
      }
      logger.info(
        { process: worker.pipe.pid, lang: language },
        'removing aspell worker from pool'
      )
      return this.cleanup()
    })
    this.PROCESS_POOL.push(worker)
    metrics.gauge('aspellWorkerPool-size', this.PROCESS_POOL.length)
    return worker
  }

  cleanup() {
    const active = this.PROCESS_POOL.filter(worker => worker.state !== 'killed')
    this.PROCESS_POOL = active
    return metrics.gauge('aspellWorkerPool-size', this.PROCESS_POOL.length)
  }

  check(language, words, timeout, callback) {
    // look for an existing process in the pool
    let worker
    const availableWorker = _.find(
      this.PROCESS_POOL,
      cached => cached.language === language && cached.isReady()
    )
    if (availableWorker == null) {
      worker = this.create(language)
    } else {
      worker = availableWorker
    }

    if (worker == null) {
      // return error if too many workers
      callback(new Error('no worker available'))
      return
    }

    if (worker.idleTimer != null) {
      clearTimeout(worker.idleTimer)
      worker.idleTimer = null
    }

    worker.killTimer = setTimeout(
      () => worker.kill('spell check timed out'),
      timeout || this.MAX_REQUEST_TIME
    )

    return worker.check(words, (err, output) => {
      if (worker.killTimer != null) {
        clearTimeout(worker.killTimer)
        worker.killTimer = null
      }
      callback(err, output)
      if (err != null) {
        return
      } // process has shut down
      if (worker.count > this.MAX_REQUESTS) {
        return worker.shutdown(`reached limit of ${this.MAX_REQUESTS} requests`)
      } else {
        // queue a shutdown if worker is idle
        return (worker.idleTimer = setTimeout(function() {
          worker.shutdown('idle worker')
          return (worker.idleTimer = null)
        }, this.MAX_IDLE_TIME))
      }
    })
  }
}
ASpellWorkerPool.initClass()

module.exports = ASpellWorkerPool
