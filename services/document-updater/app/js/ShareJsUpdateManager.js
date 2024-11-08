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
const ShareJsModel = require('./sharejs/server/model')
const ShareJsDB = require('./ShareJsDB')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const { promisifyAll } = require('@overleaf/promise-utils')
const Keys = require('./UpdateKeys')
const { EventEmitter } = require('node:events')
const util = require('node:util')
const RealTimeRedisManager = require('./RealTimeRedisManager')
const crypto = require('node:crypto')
const metrics = require('./Metrics')
const Errors = require('./Errors')

ShareJsModel.prototype = {}
util.inherits(ShareJsModel, EventEmitter)

const MAX_AGE_OF_OP = 80

const ShareJsUpdateManager = {
  getNewShareJsModel(projectId, docId, lines, version) {
    const db = new ShareJsDB(projectId, docId, lines, version)
    const model = new ShareJsModel(db, {
      maxDocLength: Settings.max_doc_length,
      maximumAge: MAX_AGE_OF_OP,
    })
    model.db = db
    return model
  },

  applyUpdate(projectId, docId, update, lines, version, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug({ projectId, docId, update }, 'applying sharejs updates')
    const jobs = []
    // record the update version before it is modified
    const incomingUpdateVersion = update.v
    // We could use a global model for all docs, but we're hitting issues with the
    // internal state of ShareJS not being accessible for clearing caches, and
    // getting stuck due to queued callbacks (line 260 of sharejs/server/model.coffee)
    // This adds a small but hopefully acceptable overhead (~12ms per 1000 updates on
    // my 2009 MBP).
    const model = this.getNewShareJsModel(projectId, docId, lines, version)
    this._listenForOps(model)
    const docKey = Keys.combineProjectIdAndDocId(projectId, docId)
    return model.applyOp(docKey, update, function (error) {
      if (error != null) {
        if (error === 'Op already submitted') {
          metrics.inc('sharejs.already-submitted')
          logger.debug(
            { projectId, docId, update },
            'op has already been submitted'
          )
          update.dup = true
          ShareJsUpdateManager._sendOp(projectId, docId, update)
        } else if (/^Delete component/.test(error)) {
          metrics.inc('sharejs.delete-mismatch')
          logger.debug(
            { projectId, docId, update, shareJsErr: error },
            'sharejs delete does not match'
          )
          error = new Errors.DeleteMismatchError(
            'Delete component does not match'
          )
          return callback(error)
        } else {
          metrics.inc('sharejs.other-error')
          return callback(error)
        }
      }
      logger.debug({ projectId, docId, error }, 'applied update')
      return model.getSnapshot(docKey, (error, data) => {
        if (error != null) {
          return callback(error)
        }
        const docSizeAfter = data.snapshot.length
        if (docSizeAfter > Settings.max_doc_length) {
          const docSizeBefore = lines.join('\n').length
          const err = new Error(
            'blocking persistence of ShareJs update: doc size exceeds limits'
          )
          logger.error(
            { projectId, docId, err, docSizeBefore, docSizeAfter },
            err.message
          )
          metrics.inc('sharejs.other-error')
          const publicError = 'Update takes doc over max doc size'
          return callback(publicError)
        }
        // only check hash when present and no other updates have been applied
        if (update.hash != null && incomingUpdateVersion === version) {
          const ourHash = ShareJsUpdateManager._computeHash(data.snapshot)
          if (ourHash !== update.hash) {
            metrics.inc('sharejs.hash-fail')
            return callback(new Error('Invalid hash'))
          } else {
            metrics.inc('sharejs.hash-pass', 0.001)
          }
        }
        const docLines = data.snapshot.split(/\r\n|\n|\r/)
        return callback(
          null,
          docLines,
          data.v,
          model.db.appliedOps[docKey] || []
        )
      })
    })
  },

  _listenForOps(model) {
    return model.on('applyOp', function (docKey, opData) {
      const [projectId, docId] = Array.from(Keys.splitProjectIdAndDocId(docKey))
      return ShareJsUpdateManager._sendOp(projectId, docId, opData)
    })
  },

  _sendOp(projectId, docId, op) {
    RealTimeRedisManager.sendData({
      project_id: projectId,
      doc_id: docId,
      op,
    })
    RealTimeRedisManager.sendCanaryAppliedOp({
      projectId,
      docId,
      op,
    })
  },

  _computeHash(content) {
    return crypto
      .createHash('sha1')
      .update('blob ' + content.length + '\x00')
      .update(content, 'utf8')
      .digest('hex')
  },
}

module.exports = ShareJsUpdateManager
module.exports.promises = promisifyAll(ShareJsUpdateManager, {
  without: ['getNewShareJsModel', '_listenForOps', '_sendOp', '_computeHash'],
  multiResult: {
    applyUpdate: ['updatedDocLines', 'version', 'appliedOps'],
  },
})
