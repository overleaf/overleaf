/* eslint-disable
    camelcase,
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
const Keys = require('./UpdateKeys')
const RedisManager = require('./RedisManager')
const Errors = require('./Errors')

module.exports = ShareJsDB = class ShareJsDB {
  constructor(project_id, doc_id, lines, version) {
    this.project_id = project_id
    this.doc_id = doc_id
    this.lines = lines
    this.version = version
    this.appliedOps = {}
    // ShareJS calls this detacted from the instance, so we need
    // bind it to keep our context that can access @appliedOps
    this.writeOp = this._writeOp.bind(this)
  }

  getOps(doc_key, start, end, callback) {
    if (start === end) {
      return callback(null, [])
    }

    // In redis, lrange values are inclusive.
    if (end != null) {
      end--
    } else {
      end = -1
    }

    const [project_id, doc_id] = Array.from(
      Keys.splitProjectIdAndDocId(doc_key)
    )
    return RedisManager.getPreviousDocOps(doc_id, start, end, callback)
  }

  _writeOp(doc_key, opData, callback) {
    if (this.appliedOps[doc_key] == null) {
      this.appliedOps[doc_key] = []
    }
    this.appliedOps[doc_key].push(opData)
    return callback()
  }

  getSnapshot(doc_key, callback) {
    if (
      doc_key !== Keys.combineProjectIdAndDocId(this.project_id, this.doc_id)
    ) {
      return callback(
        new Errors.NotFoundError(
          `unexpected doc_key ${doc_key}, expected ${Keys.combineProjectIdAndDocId(
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
