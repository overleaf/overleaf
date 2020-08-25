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
const { getCollection, ObjectId } = require('./mongodb')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { promisify } = require('util')

const docsCollectionPromise = getCollection('docs')
const docOpsCollectionPromise = getCollection('docOps')

module.exports = MongoManager = {
  findDoc(project_id, doc_id, filter, callback) {
    if (callback == null) {
      callback = function (error, doc) {}
    }
    docsCollectionPromise.then((docs) =>
      docs.findOne(
        {
          _id: ObjectId(doc_id.toString()),
          project_id: ObjectId(project_id.toString())
        },
        filter,
        callback
      )
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
    docsCollectionPromise.then((docs) =>
      docs.find(query, filter).toArray(callback)
    )
  },

  getArchivedProjectDocs(project_id, callback) {
    const query = {
      project_id: ObjectId(project_id.toString()),
      inS3: true
    }
    docsCollectionPromise.then((docs) => docs.find(query).toArray(callback))
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
    docsCollectionPromise.then((docs) =>
      docs.updateOne(
        { _id: ObjectId(doc_id) },
        update,
        { upsert: true },
        callback
      )
    )
  },

  markDocAsDeleted(project_id, doc_id, callback) {
    docsCollectionPromise.then((docs) =>
      docs.updateOne(
        {
          _id: ObjectId(doc_id),
          project_id: ObjectId(project_id)
        },
        {
          $set: { deleted: true }
        },
        callback
      )
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
    docsCollectionPromise.then((docs) =>
      docs.updateOne(query, update, callback)
    )
  },

  getDocVersion(doc_id, callback) {
    if (callback == null) {
      callback = function (error, version) {}
    }
    docOpsCollectionPromise.then((docOps) =>
      docOps.findOne(
        {
          doc_id: ObjectId(doc_id)
        },
        {
          version: 1
        },
        function (error, doc) {
          if (error != null) {
            return callback(error)
          }
          callback(null, (doc && doc.version) || 0)
        }
      )
    )
  },

  setDocVersion(doc_id, version, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    docOpsCollectionPromise.then((docOps) =>
      docOps.updateOne(
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
    )
  },

  destroyDoc(doc_id, callback) {
    docsCollectionPromise.then((docs) =>
      docs.deleteOne(
        {
          _id: ObjectId(doc_id)
        },
        function (err) {
          if (err != null) {
            return callback(err)
          }
          docOpsCollectionPromise.then((docOps) =>
            docOps.deleteOne(
              {
                doc_id: ObjectId(doc_id)
              },
              callback
            )
          )
        }
      )
    )
  }
}

const methods = Object.getOwnPropertyNames(MongoManager)

module.exports.promises = {}
for (const method of methods) {
  metrics.timeAsyncMethod(MongoManager, method, 'mongo.MongoManager', logger)
  module.exports.promises[method] = promisify(module.exports[method])
}
