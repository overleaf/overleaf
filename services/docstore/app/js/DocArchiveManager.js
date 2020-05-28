/* eslint-disable
    camelcase,
    handle-callback-err,
    no-useless-escape,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocArchive
const MongoManager = require('./MongoManager')
const Errors = require('./Errors')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const async = require('async')
const settings = require('settings-sharelatex')
const request = require('request')
const crypto = require('crypto')
const RangeManager = require('./RangeManager')
const thirtySeconds = 30 * 1000

module.exports = DocArchive = {
  archiveAllDocs(project_id, callback) {
    if (callback == null) {
      callback = function (err, docs) {}
    }
    return MongoManager.getProjectsDocs(
      project_id,
      { include_deleted: true },
      { lines: true, ranges: true, rev: true, inS3: true },
      function (err, docs) {
        if (err != null) {
          return callback(err)
        } else if (docs == null) {
          return callback(
            new Errors.NotFoundError(`No docs for project ${project_id}`)
          )
        }
        docs = _.filter(docs, (doc) => doc.inS3 !== true)
        const jobs = _.map(docs, (doc) => (cb) =>
          DocArchive.archiveDoc(project_id, doc, cb)
        )
        return async.parallelLimit(jobs, 5, callback)
      }
    )
  },

  archiveDoc(project_id, doc, callback) {
    let options
    logger.log({ project_id, doc_id: doc._id }, 'sending doc to s3')
    try {
      options = DocArchive.buildS3Options(project_id + '/' + doc._id)
    } catch (e) {
      return callback(e)
    }
    return DocArchive._mongoDocToS3Doc(doc, function (error, json_doc) {
      if (error != null) {
        return callback(error)
      }
      options.body = json_doc
      options.headers = { 'Content-Type': 'application/json' }
      return request.put(options, function (err, res) {
        if (err != null || res.statusCode !== 200) {
          logger.err(
            {
              err,
              res,
              project_id,
              doc_id: doc._id,
              statusCode: res != null ? res.statusCode : undefined
            },
            'something went wrong archiving doc in aws'
          )
          return callback(new Error('Error in S3 request'))
        }
        const md5lines = crypto
          .createHash('md5')
          .update(json_doc, 'utf8')
          .digest('hex')
        const md5response = res.headers.etag.toString().replace(/\"/g, '')
        if (md5lines !== md5response) {
          logger.err(
            {
              responseMD5: md5response,
              linesMD5: md5lines,
              project_id,
              doc_id: doc != null ? doc._id : undefined
            },
            'err in response md5 from s3'
          )
          return callback(new Error('Error in S3 md5 response'))
        }
        return MongoManager.markDocAsArchived(doc._id, doc.rev, function (err) {
          if (err != null) {
            return callback(err)
          }
          return callback()
        })
      })
    })
  },

  unArchiveAllDocs(project_id, callback) {
    if (callback == null) {
      callback = function (err) {}
    }
    return MongoManager.getArchivedProjectDocs(project_id, function (
      err,
      docs
    ) {
      if (err != null) {
        logger.err({ err, project_id }, 'error unarchiving all docs')
        return callback(err)
      } else if (docs == null) {
        return callback(
          new Errors.NotFoundError(`No docs for project ${project_id}`)
        )
      }
      const jobs = _.map(
        docs,
        (doc) =>
          function (cb) {
            if (doc.inS3 == null) {
              return cb()
            } else {
              return DocArchive.unarchiveDoc(project_id, doc._id, cb)
            }
          }
      )
      return async.parallelLimit(jobs, 5, callback)
    })
  },

  unarchiveDoc(project_id, doc_id, callback) {
    let options
    logger.log({ project_id, doc_id }, 'getting doc from s3')
    try {
      options = DocArchive.buildS3Options(project_id + '/' + doc_id)
    } catch (e) {
      return callback(e)
    }
    options.json = true
    return request.get(options, function (err, res, doc) {
      if (err != null || res.statusCode !== 200) {
        logger.err(
          { err, res, project_id, doc_id },
          'something went wrong unarchiving doc from aws'
        )
        return callback(new Errors.NotFoundError('Error in S3 request'))
      }
      return DocArchive._s3DocToMongoDoc(doc, function (error, mongo_doc) {
        if (error != null) {
          return callback(error)
        }
        return MongoManager.upsertIntoDocCollection(
          project_id,
          doc_id.toString(),
          mongo_doc,
          function (err) {
            if (err != null) {
              return callback(err)
            }
            logger.log({ project_id, doc_id }, 'deleting doc from s3')
            return DocArchive._deleteDocFromS3(project_id, doc_id, callback)
          }
        )
      })
    })
  },

  destroyAllDocs(project_id, callback) {
    if (callback == null) {
      callback = function (err) {}
    }
    return MongoManager.getProjectsDocs(
      project_id,
      { include_deleted: true },
      { _id: 1 },
      function (err, docs) {
        if (err != null) {
          logger.err({ err, project_id }, "error getting project's docs")
          return callback(err)
        } else if (docs == null) {
          return callback()
        }
        const jobs = _.map(docs, (doc) => (cb) =>
          DocArchive.destroyDoc(project_id, doc._id, cb)
        )
        return async.parallelLimit(jobs, 5, callback)
      }
    )
  },

  destroyDoc(project_id, doc_id, callback) {
    logger.log({ project_id, doc_id }, 'removing doc from mongo and s3')
    return MongoManager.findDoc(project_id, doc_id, { inS3: 1 }, function (
      error,
      doc
    ) {
      if (error != null) {
        return callback(error)
      }
      if (doc == null) {
        return callback(new Errors.NotFoundError('Doc not found in Mongo'))
      }
      if (doc.inS3 === true) {
        return DocArchive._deleteDocFromS3(project_id, doc_id, function (err) {
          if (err != null) {
            return err
          }
          return MongoManager.destroyDoc(doc_id, callback)
        })
      } else {
        return MongoManager.destroyDoc(doc_id, callback)
      }
    })
  },

  _deleteDocFromS3(project_id, doc_id, callback) {
    let options
    try {
      options = DocArchive.buildS3Options(project_id + '/' + doc_id)
    } catch (e) {
      return callback(e)
    }
    options.json = true
    return request.del(options, function (err, res, body) {
      if (err != null || res.statusCode !== 204) {
        logger.err(
          { err, res, project_id, doc_id },
          'something went wrong deleting doc from aws'
        )
        return callback(new Error('Error in S3 request'))
      }
      return callback()
    })
  },

  _s3DocToMongoDoc(doc, callback) {
    if (callback == null) {
      callback = function (error, mongo_doc) {}
    }
    const mongo_doc = {}
    if (doc.schema_v === 1 && doc.lines != null) {
      mongo_doc.lines = doc.lines
      if (doc.ranges != null) {
        mongo_doc.ranges = RangeManager.jsonRangesToMongo(doc.ranges)
      }
    } else if (doc instanceof Array) {
      mongo_doc.lines = doc
    } else {
      return callback(new Error("I don't understand the doc format in s3"))
    }
    return callback(null, mongo_doc)
  },

  _mongoDocToS3Doc(doc, callback) {
    if (callback == null) {
      callback = function (error, s3_doc) {}
    }
    if (doc.lines == null) {
      return callback(new Error('doc has no lines'))
    }
    const json = JSON.stringify({
      lines: doc.lines,
      ranges: doc.ranges,
      schema_v: 1
    })
    if (json.indexOf('\u0000') !== -1) {
      const error = new Error('null bytes detected')
      logger.err({ err: error, doc, json }, error.message)
      return callback(error)
    }
    return callback(null, json)
  },

  buildS3Options(key) {
    if (settings.docstore.s3 == null) {
      throw new Error('S3 settings are not configured')
    }
    return {
      aws: {
        key: settings.docstore.s3.key,
        secret: settings.docstore.s3.secret,
        bucket: settings.docstore.s3.bucket
      },
      timeout: thirtySeconds,
      uri: `https://${settings.docstore.s3.bucket}.s3.amazonaws.com/${key}`
    }
  }
}
