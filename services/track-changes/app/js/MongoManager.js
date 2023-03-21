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
let MongoManager
const { db, ObjectId } = require('./mongodb')
const PackManager = require('./PackManager')
const async = require('async')
const _ = require('underscore')
const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')

module.exports = MongoManager = {
  getLastCompressedUpdate(docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.docHistory
      .find(
        { doc_id: ObjectId(docId.toString()) },
        // only return the last entry in a pack
        { projection: { pack: { $slice: -1 } } }
      )
      .sort({ v: -1 })
      .limit(1)
      .toArray(function (error, compressedUpdates) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, compressedUpdates[0] || null)
      })
  },

  peekLastCompressedUpdate(docId, callback) {
    // under normal use we pass back the last update as
    // callback(null,update,version).
    //
    // when we have an existing last update but want to force a new one
    // to start, we pass it back as callback(null,null,version), just
    // giving the version so we can check consistency.
    if (callback == null) {
      callback = function () {}
    }
    return MongoManager.getLastCompressedUpdate(
      docId,
      function (error, update) {
        if (error != null) {
          return callback(error)
        }
        if (update != null) {
          if (update.broken) {
            // marked as broken so we will force a new op
            return callback(null, null)
          } else if (update.pack != null) {
            if (update.finalised) {
              // no more ops can be appended
              return callback(
                null,
                null,
                update.pack[0] != null ? update.pack[0].v : undefined
              )
            } else {
              return callback(
                null,
                update,
                update.pack[0] != null ? update.pack[0].v : undefined
              )
            }
          } else {
            return callback(null, update, update.v)
          }
        } else {
          return PackManager.getLastPackFromIndex(
            docId,
            function (error, pack) {
              if (error != null) {
                return callback(error)
              }
              if (
                (pack != null ? pack.inS3 : undefined) != null &&
                (pack != null ? pack.v_end : undefined) != null
              ) {
                return callback(null, null, pack.v_end)
              }
              return callback(null, null)
            }
          )
        }
      }
    )
  },

  backportProjectId(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.docHistory.updateMany(
      {
        doc_id: ObjectId(docId.toString()),
        project_id: { $exists: false },
      },
      {
        $set: { project_id: ObjectId(projectId.toString()) },
      },
      callback
    )
  },

  getProjectMetaData(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.projectHistoryMetaData.findOne(
      {
        project_id: ObjectId(projectId.toString()),
      },
      callback
    )
  },

  setProjectMetaData(projectId, metadata, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.projectHistoryMetaData.updateOne(
      {
        project_id: ObjectId(projectId),
      },
      {
        $set: metadata,
      },
      {
        upsert: true,
      },
      callback
    )
  },

  upgradeHistory(projectId, callback) {
    // preserve the project's existing history
    if (callback == null) {
      callback = function () {}
    }
    return db.docHistory.updateMany(
      {
        project_id: ObjectId(projectId),
        temporary: true,
        expiresAt: { $exists: true },
      },
      {
        $set: { temporary: false },
        $unset: { expiresAt: '' },
      },
      callback
    )
  },

  ensureIndices() {
    // For finding all updates that go into a diff for a doc
    db.docHistory.ensureIndex({ doc_id: 1, v: 1 }, { background: true })
    // For finding all updates that affect a project
    db.docHistory.ensureIndex(
      { project_id: 1, 'meta.end_ts': 1 },
      { background: true }
    )
    // For finding updates that don't yet have a project_id and need it inserting
    db.docHistory.ensureIndex(
      { doc_id: 1, project_id: 1 },
      { background: true }
    )
    // For finding project meta-data
    db.projectHistoryMetaData.ensureIndex(
      { project_id: 1 },
      { background: true }
    )
    // TTL index for auto deleting week old temporary ops
    db.docHistory.ensureIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, background: true }
    )
    // For finding packs to be checked for archiving
    db.docHistory.ensureIndex({ last_checked: 1 }, { background: true })
    // For finding archived packs
    return db.docHistoryIndex.ensureIndex(
      { project_id: 1 },
      { background: true }
    )
  },
}
;['getLastCompressedUpdate', 'getProjectMetaData', 'setProjectMetaData'].map(
  method =>
    metrics.timeAsyncMethod(MongoManager, method, 'mongo.MongoManager', logger)
)
