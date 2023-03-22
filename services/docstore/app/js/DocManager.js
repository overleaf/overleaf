/* eslint-disable
    no-dupe-keys,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocManager
const MongoManager = require('./MongoManager')
const Errors = require('./Errors')
const logger = require('@overleaf/logger')
const _ = require('lodash')
const DocArchive = require('./DocArchiveManager')
const RangeManager = require('./RangeManager')
const Settings = require('@overleaf/settings')

module.exports = DocManager = {
  // TODO: For historical reasons, the doc version is currently stored in the docOps
  // collection (which is all that this collection contains). In future, we should
  // migrate this version property to be part of the docs collection, to guarantee
  // consitency between lines and version when writing/reading, and for a simpler schema.
  _getDoc(projectId, docId, filter, callback) {
    if (filter == null) {
      filter = {}
    }
    if (callback == null) {
      callback = function () {}
    }
    if (filter.inS3 !== true) {
      return callback(new Error('must include inS3 when getting doc'))
    }

    return MongoManager.findDoc(projectId, docId, filter, function (err, doc) {
      if (err != null) {
        return callback(err)
      } else if (doc == null) {
        return callback(
          new Errors.NotFoundError(
            `No such doc: ${docId} in project ${projectId}`
          )
        )
      } else if (doc != null ? doc.inS3 : undefined) {
        return DocArchive.unarchiveDoc(projectId, docId, function (err) {
          if (err != null) {
            logger.err({ err, projectId, docId }, 'error unarchiving doc')
            return callback(err)
          }
          return DocManager._getDoc(projectId, docId, filter, callback)
        })
      } else {
        if (filter.version) {
          return MongoManager.getDocVersion(docId, function (error, version) {
            if (error != null) {
              return callback(error)
            }
            doc.version = version
            return callback(err, doc)
          })
        } else {
          return callback(err, doc)
        }
      }
    })
  },

  isDocDeleted(projectId, docId, callback) {
    MongoManager.findDoc(
      projectId,
      docId,
      { deleted: true },
      function (err, doc) {
        if (err) {
          return callback(err)
        }
        if (!doc) {
          return callback(
            new Errors.NotFoundError(
              `No such project/doc: ${projectId}/${docId}`
            )
          )
        }
        // `doc.deleted` is `undefined` for non deleted docs
        callback(null, Boolean(doc.deleted))
      }
    )
  },

  getFullDoc(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return DocManager._getDoc(
      projectId,
      docId,
      {
        lines: true,
        rev: true,
        deleted: true,
        version: true,
        ranges: true,
        inS3: true,
      },
      function (err, doc) {
        if (err != null) {
          return callback(err)
        }
        return callback(err, doc)
      }
    )
  },

  // returns the doc without any version information
  _peekRawDoc(projectId, docId, callback) {
    MongoManager.findDoc(
      projectId,
      docId,
      {
        lines: true,
        rev: true,
        deleted: true,
        version: true,
        ranges: true,
        inS3: true,
      },
      (err, doc) => {
        if (err) return callback(err)
        if (doc == null) {
          return callback(
            new Errors.NotFoundError(
              `No such doc: ${docId} in project ${projectId}`
            )
          )
        }
        if (doc && !doc.inS3) {
          return callback(null, doc)
        }
        // skip the unarchiving to mongo when getting a doc
        DocArchive.getDoc(projectId, docId, function (err, archivedDoc) {
          if (err != null) {
            logger.err(
              { err, projectId, docId },
              'error getting doc from archive'
            )
            return callback(err)
          }
          Object.assign(doc, archivedDoc)
          callback(null, doc)
        })
      }
    )
  },

  // get the doc from mongo if possible, or from the persistent store otherwise,
  // without unarchiving it (avoids unnecessary writes to mongo)
  peekDoc(projectId, docId, callback) {
    DocManager._peekRawDoc(projectId, docId, (err, doc) => {
      if (err) {
        return callback(err)
      }
      MongoManager.withRevCheck(
        doc,
        MongoManager.getDocVersion,
        function (error, version) {
          // If the doc has been modified while we were retrieving it, we
          // will get a DocModified error
          if (error != null) {
            return callback(error)
          }
          doc.version = version
          return callback(err, doc)
        }
      )
    })
  },

  getDocLines(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return DocManager._getDoc(
      projectId,
      docId,
      { lines: true, inS3: true },
      function (err, doc) {
        if (err != null) {
          return callback(err)
        }
        return callback(err, doc)
      }
    )
  },

  getAllDeletedDocs(projectId, filter, callback) {
    MongoManager.getProjectsDeletedDocs(projectId, filter, callback)
  },

  getAllNonDeletedDocs(projectId, filter, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return DocArchive.unArchiveAllDocs(projectId, function (error) {
      if (error != null) {
        return callback(error)
      }
      return MongoManager.getProjectsDocs(
        projectId,
        { include_deleted: false },
        filter,
        function (error, docs) {
          if (typeof err !== 'undefined' && err !== null) {
            return callback(error)
          } else if (docs == null) {
            return callback(
              new Errors.NotFoundError(`No docs for project ${projectId}`)
            )
          } else {
            return callback(null, docs)
          }
        }
      )
    })
  },

  updateDoc(projectId, docId, lines, version, ranges, callback) {
    DocManager._tryUpdateDoc(
      projectId,
      docId,
      lines,
      version,
      ranges,
      (err, modified, rev) => {
        if (err && err instanceof Errors.DocRevValueError) {
          // Another updateDoc call was racing with ours.
          // Retry once in a bit.
          logger.warn(
            { projectId, docId, err },
            'detected concurrent updateDoc call'
          )
          setTimeout(() => {
            DocManager._tryUpdateDoc(
              projectId,
              docId,
              lines,
              version,
              ranges,
              callback
            )
          }, 100 + Math.random() * 100)
        } else {
          callback(err, modified, rev)
        }
      }
    )
  },

  _tryUpdateDoc(projectId, docId, lines, version, ranges, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (lines == null || version == null || ranges == null) {
      return callback(new Error('no lines, version or ranges provided'))
    }

    return DocManager._getDoc(
      projectId,
      docId,
      {
        version: true,
        rev: true,
        lines: true,
        version: true,
        ranges: true,
        inS3: true,
      },
      function (err, doc) {
        let updateLines, updateRanges, updateVersion
        if (err != null && !(err instanceof Errors.NotFoundError)) {
          logger.err(
            { projectId, docId, err },
            'error getting document for update'
          )
          return callback(err)
        }

        ranges = RangeManager.jsonRangesToMongo(ranges)

        if (doc == null) {
          // If the document doesn't exist, we'll make sure to create/update all parts of it.
          updateLines = true
          updateVersion = true
          updateRanges = true
        } else {
          if (doc.version > version) {
            // Reject update when the version was decremented.
            // Potential reasons: racing flush, broken history.
            return callback(
              new Errors.DocVersionDecrementedError('rejecting stale update', {
                updateVersion: version,
                flushedVersion: doc.version,
              })
            )
          }
          updateLines = !_.isEqual(doc.lines, lines)
          updateVersion = doc.version !== version
          updateRanges = RangeManager.shouldUpdateRanges(doc.ranges, ranges)
        }

        let modified = false
        let rev = (doc != null ? doc.rev : undefined) || 0

        const updateLinesAndRangesIfNeeded = function (cb) {
          if (updateLines || updateRanges) {
            const update = {}
            if (updateLines) {
              update.lines = lines
            }
            if (updateRanges) {
              update.ranges = ranges
            }
            logger.debug({ projectId, docId }, 'updating doc lines and ranges')

            modified = true
            rev += 1 // rev will be incremented in mongo by MongoManager.upsertIntoDocCollection
            return MongoManager.upsertIntoDocCollection(
              projectId,
              docId,
              doc?.rev,
              update,
              cb
            )
          } else {
            logger.debug(
              { projectId, docId },
              'doc lines have not changed - not updating'
            )
            return cb()
          }
        }

        const updateVersionIfNeeded = function (cb) {
          if (updateVersion) {
            logger.debug(
              {
                projectId,
                docId,
                oldVersion: doc != null ? doc.version : undefined,
                newVersion: version,
              },
              'updating doc version'
            )
            modified = true
            return MongoManager.setDocVersion(docId, version, cb)
          } else {
            logger.debug(
              { projectId, docId, version },
              'doc version has not changed - not updating'
            )
            return cb()
          }
        }

        return updateLinesAndRangesIfNeeded(function (error) {
          if (error != null) {
            return callback(error)
          }
          return updateVersionIfNeeded(function (error) {
            if (error != null) {
              return callback(error)
            }
            return callback(null, modified, rev)
          })
        })
      }
    )
  },

  patchDoc(projectId, docId, meta, callback) {
    const projection = { _id: 1, deleted: true }
    MongoManager.findDoc(projectId, docId, projection, (error, doc) => {
      if (error != null) {
        return callback(error)
      }
      if (!doc) {
        return callback(
          new Errors.NotFoundError(
            `No such project/doc to delete: ${projectId}/${docId}`
          )
        )
      }

      if (meta.deleted && Settings.docstore.archiveOnSoftDelete) {
        // The user will not read this doc anytime soon. Flush it out of mongo.
        DocArchive.archiveDoc(projectId, docId, err => {
          if (err) {
            logger.warn(
              { projectId, docId, err },
              'archiving a single doc in the background failed'
            )
          }
        })
      }

      MongoManager.patchDoc(projectId, docId, meta, callback)
    })
  },
}
