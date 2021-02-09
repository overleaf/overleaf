/* eslint-disable
    camelcase,
    handle-callback-err,
    no-dupe-keys,
    no-undef,
    standard/no-callback-literal,
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
const logger = require('logger-sharelatex')
const _ = require('underscore')
const DocArchive = require('./DocArchiveManager')
const RangeManager = require('./RangeManager')

module.exports = DocManager = {
  // TODO: For historical reasons, the doc version is currently stored in the docOps
  // collection (which is all that this collection contains). In future, we should
  // migrate this version property to be part of the docs collection, to guarantee
  // consitency between lines and version when writing/reading, and for a simpler schema.
  _getDoc(project_id, doc_id, filter, callback) {
    if (filter == null) {
      filter = {}
    }
    if (callback == null) {
      callback = function (error, doc) {}
    }
    if (filter.inS3 !== true) {
      return callback('must include inS3 when getting doc')
    }

    return MongoManager.findDoc(project_id, doc_id, filter, function (
      err,
      doc
    ) {
      if (err != null) {
        return callback(err)
      } else if (doc == null) {
        return callback(
          new Errors.NotFoundError(
            `No such doc: ${doc_id} in project ${project_id}`
          )
        )
      } else if (doc != null ? doc.inS3 : undefined) {
        return DocArchive.unarchiveDoc(project_id, doc_id, function (err) {
          if (err != null) {
            logger.err({ err, project_id, doc_id }, 'error unarchiving doc')
            return callback(err)
          }
          return DocManager._getDoc(project_id, doc_id, filter, callback)
        })
      } else {
        if (filter.version) {
          return MongoManager.getDocVersion(doc_id, function (error, version) {
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

  checkDocExists(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (err, exists) {}
    }
    return DocManager._getDoc(
      project_id,
      doc_id,
      { _id: 1, inS3: true },
      function (err, doc) {
        if (err != null) {
          return callback(err)
        }
        return callback(err, doc != null)
      }
    )
  },

  isDocDeleted(projectId, docId, callback) {
    MongoManager.findDoc(projectId, docId, { deleted: true }, function (
      err,
      doc
    ) {
      if (err) {
        return callback(err)
      }
      if (!doc) {
        return callback(
          new Errors.NotFoundError(`No such project/doc: ${projectId}/${docId}`)
        )
      }
      // `doc.deleted` is `undefined` for non deleted docs
      callback(null, Boolean(doc.deleted))
    })
  },

  getFullDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (err, doc) {}
    }
    return DocManager._getDoc(
      project_id,
      doc_id,
      {
        lines: true,
        rev: true,
        deleted: true,
        version: true,
        ranges: true,
        inS3: true
      },
      function (err, doc) {
        if (err != null) {
          return callback(err)
        }
        return callback(err, doc)
      }
    )
  },

  getDocLines(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (err, doc) {}
    }
    return DocManager._getDoc(
      project_id,
      doc_id,
      { lines: true, inS3: true },
      function (err, doc) {
        if (err != null) {
          return callback(err)
        }
        return callback(err, doc)
      }
    )
  },

  getAllNonDeletedDocs(project_id, filter, callback) {
    if (callback == null) {
      callback = function (error, docs) {}
    }
    return DocArchive.unArchiveAllDocs(project_id, function (error) {
      if (error != null) {
        return callback(error)
      }
      return MongoManager.getProjectsDocs(
        project_id,
        { include_deleted: false },
        filter,
        function (error, docs) {
          if (typeof err !== 'undefined' && err !== null) {
            return callback(error)
          } else if (docs == null) {
            return callback(
              new Errors.NotFoundError(`No docs for project ${project_id}`)
            )
          } else {
            return callback(null, docs)
          }
        }
      )
    })
  },

  updateDoc(project_id, doc_id, lines, version, ranges, callback) {
    if (callback == null) {
      callback = function (error, modified, rev) {}
    }
    if (lines == null || version == null || ranges == null) {
      return callback(new Error('no lines, version or ranges provided'))
    }

    return DocManager._getDoc(
      project_id,
      doc_id,
      {
        version: true,
        rev: true,
        lines: true,
        version: true,
        ranges: true,
        inS3: true
      },
      function (err, doc) {
        let updateLines, updateRanges, updateVersion
        if (err != null && !(err instanceof Errors.NotFoundError)) {
          logger.err(
            { project_id, doc_id, err },
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
            logger.log({ project_id, doc_id }, 'updating doc lines and ranges')

            modified = true
            rev += 1 // rev will be incremented in mongo by MongoManager.upsertIntoDocCollection
            return MongoManager.upsertIntoDocCollection(
              project_id,
              doc_id,
              update,
              cb
            )
          } else {
            logger.log(
              { project_id, doc_id },
              'doc lines have not changed - not updating'
            )
            return cb()
          }
        }

        const updateVersionIfNeeded = function (cb) {
          if (updateVersion) {
            logger.log(
              {
                project_id,
                doc_id,
                oldVersion: doc != null ? doc.version : undefined,
                newVersion: version
              },
              'updating doc version'
            )
            modified = true
            return MongoManager.setDocVersion(doc_id, version, cb)
          } else {
            logger.log(
              { project_id, doc_id, version },
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

  deleteDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return DocManager.checkDocExists(project_id, doc_id, function (
      error,
      exists
    ) {
      if (error != null) {
        return callback(error)
      }
      if (!exists) {
        return callback(
          new Errors.NotFoundError(
            `No such project/doc to delete: ${project_id}/${doc_id}`
          )
        )
      }
      return MongoManager.markDocAsDeleted(project_id, doc_id, callback)
    })
  }
}
