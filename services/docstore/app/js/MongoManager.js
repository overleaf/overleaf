const { db, ObjectId } = require('./mongodb')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const Errors = require('./Errors')
const { promisify } = require('util')

const ARCHIVING_LOCK_DURATION_MS = Settings.archivingLockDurationMs

function findDoc(projectId, docId, filter, callback) {
  db.docs.findOne(
    {
      _id: ObjectId(docId.toString()),
      project_id: ObjectId(projectId.toString()),
    },
    {
      projection: filter,
    },
    callback
  )
}

function getProjectsDeletedDocs(projectId, filter, callback) {
  db.docs
    .find(
      {
        project_id: ObjectId(projectId.toString()),
        deleted: true,
      },
      {
        projection: filter,
        sort: { deletedAt: -1 },
        limit: Settings.max_deleted_docs,
      }
    )
    .toArray(callback)
}

function getProjectsDocs(projectId, options, filter, callback) {
  const query = { project_id: ObjectId(projectId.toString()) }
  if (!options.include_deleted) {
    query.deleted = { $ne: true }
  }
  const queryOptions = {
    projection: filter,
  }
  if (options.limit) {
    queryOptions.limit = options.limit
  }
  db.docs.find(query, queryOptions).toArray(callback)
}

function getArchivedProjectDocs(projectId, maxResults, callback) {
  const query = {
    project_id: ObjectId(projectId.toString()),
    inS3: true,
  }
  db.docs
    .find(query, { projection: { _id: 1 }, limit: maxResults })
    .toArray(callback)
}

function getNonArchivedProjectDocIds(projectId, callback) {
  db.docs
    .find(
      {
        project_id: ObjectId(projectId),
        inS3: { $ne: true },
      },
      { projection: { _id: 1 } }
    )
    .map(doc => doc._id)
    .toArray(callback)
}

function getNonDeletedArchivedProjectDocs(projectId, maxResults, callback) {
  const query = {
    project_id: ObjectId(projectId.toString()),
    deleted: { $ne: true },
    inS3: true,
  }
  db.docs
    .find(query, { projection: { _id: 1 }, limit: maxResults })
    .toArray(callback)
}

function upsertIntoDocCollection(
  projectId,
  docId,
  previousRev,
  updates,
  callback
) {
  if (previousRev) {
    db.docs.updateOne(
      {
        _id: ObjectId(docId),
        project_id: ObjectId(projectId),
        rev: previousRev,
      },
      {
        $set: updates,
        $inc: {
          rev: 1,
        },
        $unset: {
          inS3: true,
        },
      },
      (err, result) => {
        if (err) return callback(err)
        if (result.matchedCount !== 1) {
          return callback(new Errors.DocRevValueError())
        }
        callback()
      }
    )
  } else {
    db.docs.insertOne(
      {
        _id: ObjectId(docId),
        project_id: ObjectId(projectId),
        rev: 1,
        ...updates,
      },
      err => {
        if (err) {
          if (err.code === 11000) {
            // duplicate doc _id
            return callback(new Errors.DocRevValueError())
          }
          return callback(err)
        }
        callback()
      }
    )
  }
}

function patchDoc(projectId, docId, meta, callback) {
  db.docs.updateOne(
    {
      _id: ObjectId(docId),
      project_id: ObjectId(projectId),
    },
    { $set: meta },
    callback
  )
}

/**
 * Fetch a doc and lock it for archiving
 *
 * This will return null if the doc is not found, if it's already archived or
 * if the lock can't be acquired.
 */
function getDocForArchiving(projectId, docId, callback) {
  const archivingUntil = new Date(Date.now() + ARCHIVING_LOCK_DURATION_MS)
  db.docs.findOneAndUpdate(
    {
      _id: ObjectId(docId),
      project_id: ObjectId(projectId),
      inS3: { $ne: true },
      $or: [{ archivingUntil: null }, { archivingUntil: { $lt: new Date() } }],
    },
    { $set: { archivingUntil } },
    { projection: { lines: 1, ranges: 1, rev: 1 } },
    (err, result) => {
      if (err) {
        return callback(err)
      }
      callback(null, result.value)
    }
  )
}

/**
 * Clear the doc contents from Mongo and release the archiving lock
 */
function markDocAsArchived(projectId, docId, rev, callback) {
  db.docs.updateOne(
    { _id: ObjectId(docId), rev },
    {
      $set: { inS3: true },
      $unset: { lines: 1, ranges: 1, archivingUntil: 1 },
    },
    callback
  )
}

/**
 * Restore an archived doc
 *
 * This checks that the archived doc's rev matches.
 */
function restoreArchivedDoc(projectId, docId, archivedDoc, callback) {
  const query = {
    _id: ObjectId(docId),
    project_id: ObjectId(projectId),
    rev: archivedDoc.rev,
  }
  const update = {
    $set: {
      lines: archivedDoc.lines,
      ranges: archivedDoc.ranges || {},
    },
    $unset: {
      inS3: true,
    },
  }
  db.docs.updateOne(query, update, (err, result) => {
    if (err) {
      OError.tag(err, 'failed to unarchive doc', {
        docId,
        rev: archivedDoc.rev,
      })
      return callback(err)
    }
    if (result.matchedCount === 0) {
      return callback(
        new Errors.DocRevValueError('failed to unarchive doc', {
          docId,
          rev: archivedDoc.rev,
        })
      )
    }
    callback()
  })
}

function getDocVersion(docId, callback) {
  db.docOps.findOne(
    {
      doc_id: ObjectId(docId),
    },
    {
      projection: {
        version: 1,
      },
    },
    function (error, doc) {
      if (error) {
        return callback(error)
      }
      callback(null, (doc && doc.version) || 0)
    }
  )
}

function setDocVersion(docId, version, callback) {
  db.docOps.updateOne(
    {
      doc_id: ObjectId(docId),
    },
    {
      $set: { version },
    },
    {
      upsert: true,
    },
    callback
  )
}

function getDocRev(docId, callback) {
  db.docs.findOne(
    {
      _id: ObjectId(docId.toString()),
    },
    {
      projection: { rev: 1 },
    },
    function (err, doc) {
      if (err) {
        return callback(err)
      }
      callback(null, doc && doc.rev)
    }
  )
}

// Helper method  to support optimistic locking. Call the provided method for
// an existing doc and return the result if the rev in mongo is unchanged when
// checked afterwards. If the rev has changed, return a DocModifiedError.
function withRevCheck(doc, method, callback) {
  method(doc._id, function (err, result) {
    if (err) return callback(err)
    getDocRev(doc._id, function (err, currentRev) {
      if (err) return callback(err)
      if (isNaN(currentRev) || isNaN(doc.rev)) {
        return callback(
          new Errors.DocRevValueError('doc rev is NaN', {
            doc_id: doc._id,
            rev: doc.rev,
            currentRev,
          })
        )
      }
      if (doc.rev !== currentRev) {
        return callback(
          new Errors.DocModifiedError('doc rev has changed', {
            doc_id: doc._id,
            rev: doc.rev,
            currentRev,
          })
        )
      }
      callback(null, result)
    })
  })
}

function destroyProject(projectId, callback) {
  db.docs
    .find({ project_id: ObjectId(projectId) }, { projection: { _id: 1 } })
    .toArray((err, records) => {
      const docIds = records.map(r => r._id)
      if (err) {
        return callback(err)
      }
      db.docOps.deleteMany({ doc_id: { $in: docIds } }, err => {
        if (err) {
          return callback(err)
        }
        db.docs.deleteMany({ project_id: ObjectId(projectId) }, callback)
      })
    })
}

module.exports = {
  findDoc,
  getProjectsDeletedDocs,
  getProjectsDocs,
  getArchivedProjectDocs,
  getNonArchivedProjectDocIds,
  getNonDeletedArchivedProjectDocs,
  upsertIntoDocCollection,
  restoreArchivedDoc,
  patchDoc,
  getDocForArchiving,
  markDocAsArchived,
  getDocVersion,
  setDocVersion,
  withRevCheck,
  destroyProject,
}

const methods = Object.getOwnPropertyNames(module.exports)
module.exports.promises = {}
for (const method of methods) {
  metrics.timeAsyncMethod(module.exports, method, 'mongo.MongoManager', logger)
  module.exports.promises[method] = promisify(module.exports[method])
}
