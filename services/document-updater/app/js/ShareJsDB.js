/* eslint-disable
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
let ShareJsDB
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const Keys = require('./UpdateKeys')
const RedisManager = require('./RedisManager')
const Errors = require('./Errors')

const TRANSFORM_UPDATES_COUNT_BUCKETS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 50, 75, 100,
  // prepare buckets for full-project history/larger buffer experiments
  150, 200, 300, 400,
]

module.exports = ShareJsDB = class ShareJsDB {
  constructor(projectId, docId, lines, version) {
    this.project_id = projectId
    this.doc_id = docId
    this.lines = lines
    this.version = version
    this.appliedOps = {}
    // ShareJS calls this detacted from the instance, so we need
    // bind it to keep our context that can access @appliedOps
    this.writeOp = this._writeOp.bind(this)
    this.startTimeShareJsDB = performance.now()
  }

  getOps(docKey, start, end, callback) {
    if (start === end || (start === this.version && end === null)) {
      const status = 'is-up-to-date'
      Metrics.inc('transform-updates', 1, {
        status,
        path: 'sharejs',
      })
      Metrics.histogram(
        'transform-updates.count',
        0,
        TRANSFORM_UPDATES_COUNT_BUCKETS,
        { path: 'sharejs', status }
      )
      return callback(null, [])
    }

    // In redis, lrange values are inclusive.
    if (end != null) {
      end--
    } else {
      end = -1
    }

    const [projectId, docId] = Array.from(Keys.splitProjectIdAndDocId(docKey))
    const timer = new Metrics.Timer(
      'transform-updates.timing',
      1,
      { path: 'sharejs' },
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 50, 100, 200, 500, 1000]
    )
    RedisManager.getPreviousDocOps(docId, start, end, (err, ops) => {
      let status
      if (err) {
        if (err instanceof Errors.OpRangeNotAvailableError) {
          status = 'out-of-range'
        } else {
          status = 'error'
        }
      } else {
        if (ops.length === 0) {
          status = 'fetched-zero'

          // The sharejs processing is happening under a lock.
          // In case there are no other ops available, something bypassed the lock (or we overran it).
          logger.warn(
            {
              projectId,
              docId,
              start,
              end,
              timeSinceShareJsDBInit:
                performance.now() - this.startTimeShareJsDB,
            },
            'found zero docOps while transforming update'
          )
        } else {
          status = 'fetched'
        }
        Metrics.histogram(
          'transform-updates.count',
          ops.length,
          TRANSFORM_UPDATES_COUNT_BUCKETS,
          { path: 'sharejs', status }
        )
      }

      timer.done({ status })
      Metrics.inc('transform-updates', 1, { status, path: 'sharejs' })
      callback(err, ops)
    })
  }

  _writeOp(docKey, opData, callback) {
    if (this.appliedOps[docKey] == null) {
      this.appliedOps[docKey] = []
    }
    this.appliedOps[docKey].push(opData)
    return callback()
  }

  getSnapshot(docKey, callback) {
    if (
      docKey !== Keys.combineProjectIdAndDocId(this.project_id, this.doc_id)
    ) {
      return callback(
        new Errors.NotFoundError(
          `unexpected doc_key ${docKey}, expected ${Keys.combineProjectIdAndDocId(
            this.project_id,
            this.doc_id
          )}`
        )
      )
    } else {
      return callback(null, {
        snapshot: this.lines.join('\n'),
        v: parseInt(this.version, 10),
        type: 'text',
      })
    }
  }

  // To be able to remove a doc from the ShareJS memory
  // we need to called Model::delete, which calls this
  // method on the database. However, we will handle removing
  // it from Redis ourselves
  delete(docName, dbMeta, callback) {
    return callback()
  }
}
