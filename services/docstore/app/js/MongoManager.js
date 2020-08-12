/* eslint-disable
    camelcase,
    handle-callback-err,
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
const { db, ObjectId } = require('./mongojs')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { promisify } = require('util')

module.exports = MongoManager = {
  findDoc(project_id, doc_id, filter, callback) {
    if (callback == null) {
      callback = function (error, doc) {}
    }
    return db.docs.find(
      {
        _id: ObjectId(doc_id.toString()),
        project_id: ObjectId(project_id.toString())
      },
      filter,
      function (error, docs) {
        if (docs == null) {
          docs = []
        }
        return callback(error, docs[0])
      }
    )
  },

  getProjectsDocs(project_id, options, filter, callback) {
    if (options == null) {
      options = { include_deleted: true }
    }
    const query = { project_id: ObjectId(project_id.toString()) }
    if (!options.include_deleted) {
      query.deleted = { $ne: true }
    }
    return db.docs.find(query, filter, callback)
  },

  getArchivedProjectDocs(project_id, callback) {
    const query = {
      project_id: ObjectId(project_id.toString()),
      inS3: true
    }
    return db.docs.find(query, {}, callback)
  },

  upsertIntoDocCollection(project_id, doc_id, updates, callback) {
    const update = {
      $set: updates,
      $inc: {
        rev: 1
      },
      $unset: {
        inS3: true
      }
    }
    update.$set.project_id = ObjectId(project_id)
    return db.docs.update(
      { _id: ObjectId(doc_id) },
      update,
      { upsert: true },
      callback
    )
  },

  markDocAsDeleted(project_id, doc_id, callback) {
    return db.docs.update(
      {
        _id: ObjectId(doc_id),
        project_id: ObjectId(project_id)
      },
      {
        $set: { deleted: true }
      },
      callback
    )
  },

  markDocAsArchived(doc_id, rev, callback) {
    const update = {
      $set: {},
      $unset: {}
    }
    update.$set.inS3 = true
    update.$unset.lines = true
    update.$unset.ranges = true
    const query = {
      _id: doc_id,
      rev
    }
    return db.docs.update(query, update, (err) => callback(err))
  },

  getDocVersion(doc_id, callback) {
    if (callback == null) {
      callback = function (error, version) {}
    }
    return db.docOps.find(
      {
        doc_id: ObjectId(doc_id)
      },
      {
        version: 1
      },
      function (error, docs) {
        if (error != null) {
          return callback(error)
        }
        if (docs.length < 1 || docs[0].version == null) {
          return callback(null, 0)
        } else {
          return callback(null, docs[0].version)
        }
      }
    )
  },

  setDocVersion(doc_id, version, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return db.docOps.update(
      {
        doc_id: ObjectId(doc_id)
      },
      {
        $set: { version }
      },
      {
        upsert: true
      },
      callback
    )
  },

  destroyDoc(doc_id, callback) {
    return db.docs.remove(
      {
        _id: ObjectId(doc_id)
      },
      function (err) {
        if (err != null) {
          return callback(err)
        }
        return db.docOps.remove(
          {
            doc_id: ObjectId(doc_id)
          },
          callback
        )
      }
    )
  }
}

const methods = Object.getOwnPropertyNames(MongoManager)

module.exports.promises = {}
for (const method of methods) {
  metrics.timeAsyncMethod(MongoManager, method, 'mongo.MongoManager', logger)
  module.exports.promises[method] = promisify(module.exports[method])
}
