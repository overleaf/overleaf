/* eslint-disable
    no-return-assign,
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
let MongoAWS
const settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const AWS = require('aws-sdk')
const S3S = require('s3-streams')
const { db, ObjectId } = require('./mongodb')
const JSONStream = require('JSONStream')
const ReadlineStream = require('byline')
const zlib = require('zlib')
const Metrics = require('@overleaf/metrics')

const DAYS = 24 * 3600 * 1000 // one day in milliseconds

const createStream = function (streamConstructor, projectId, docId, packId) {
  const AWS_CONFIG = {
    accessKeyId: settings.trackchanges.s3.key,
    secretAccessKey: settings.trackchanges.s3.secret,
    endpoint: settings.trackchanges.s3.endpoint,
    s3ForcePathStyle: settings.trackchanges.s3.pathStyle,
  }

  return streamConstructor(new AWS.S3(AWS_CONFIG), {
    Bucket: settings.trackchanges.stores.doc_history,
    Key: projectId + '/changes-' + docId + '/pack-' + packId,
  })
}

module.exports = MongoAWS = {
  archivePack(projectId, docId, packId, _callback) {
    if (_callback == null) {
      _callback = function () {}
    }
    const callback = function (...args) {
      _callback(...Array.from(args || []))
      return (_callback = function () {})
    }

    const query = {
      _id: ObjectId(packId),
      doc_id: ObjectId(docId),
    }

    if (projectId == null) {
      return callback(new Error('invalid project id'))
    }
    if (docId == null) {
      return callback(new Error('invalid doc id'))
    }
    if (packId == null) {
      return callback(new Error('invalid pack id'))
    }

    logger.debug({ projectId, docId, packId }, 'uploading data to s3')

    const upload = createStream(S3S.WriteStream, projectId, docId, packId)

    return db.docHistory.findOne(query, function (err, result) {
      if (err != null) {
        return callback(err)
      }
      if (result == null) {
        return callback(new Error('cannot find pack to send to s3'))
      }
      if (result.expiresAt != null) {
        return callback(new Error('refusing to send pack with TTL to s3'))
      }
      const uncompressedData = JSON.stringify(result)
      if (uncompressedData.indexOf('\u0000') !== -1) {
        const error = new Error('null bytes found in upload')
        logger.error({ err: error, projectId, docId, packId }, error.message)
        return callback(error)
      }
      return zlib.gzip(uncompressedData, function (err, buf) {
        logger.debug(
          {
            projectId,
            docId,
            packId,
            origSize: uncompressedData.length,
            newSize: buf.length,
          },
          'compressed pack'
        )
        if (err != null) {
          return callback(err)
        }
        upload.on('error', err => callback(err))
        upload.on('finish', function () {
          Metrics.inc('archive-pack')
          logger.debug({ projectId, docId, packId }, 'upload to s3 completed')
          return callback(null)
        })
        upload.write(buf)
        return upload.end()
      })
    })
  },

  readArchivedPack(projectId, docId, packId, _callback) {
    if (_callback == null) {
      _callback = function () {}
    }
    const callback = function (...args) {
      _callback(...Array.from(args || []))
      return (_callback = function () {})
    }

    if (projectId == null) {
      return callback(new Error('invalid project id'))
    }
    if (docId == null) {
      return callback(new Error('invalid doc id'))
    }
    if (packId == null) {
      return callback(new Error('invalid pack id'))
    }

    logger.debug({ projectId, docId, packId }, 'downloading data from s3')

    const download = createStream(S3S.ReadStream, projectId, docId, packId)

    const inputStream = download
      .on('open', obj => 1)
      .on('error', err => callback(err))

    const gunzip = zlib.createGunzip()
    gunzip.setEncoding('utf8')
    gunzip.on('error', function (err) {
      logger.debug(
        { projectId, docId, packId, err },
        'error uncompressing gzip stream'
      )
      return callback(err)
    })

    const outputStream = inputStream.pipe(gunzip)
    const parts = []
    outputStream.on('error', err => callback(err))
    outputStream.on('end', function () {
      let object
      logger.debug({ projectId, docId, packId }, 'download from s3 completed')
      try {
        object = JSON.parse(parts.join(''))
      } catch (e) {
        return callback(e)
      }
      object._id = ObjectId(object._id)
      object.doc_id = ObjectId(object.doc_id)
      object.project_id = ObjectId(object.project_id)
      for (const op of Array.from(object.pack)) {
        if (op._id != null) {
          op._id = ObjectId(op._id)
        }
      }
      return callback(null, object)
    })
    return outputStream.on('data', data => parts.push(data))
  },

  unArchivePack(projectId, docId, packId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return MongoAWS.readArchivedPack(
      projectId,
      docId,
      packId,
      function (err, object) {
        if (err != null) {
          return callback(err)
        }
        Metrics.inc('unarchive-pack')
        // allow the object to expire, we can always retrieve it again
        object.expiresAt = new Date(Date.now() + 7 * DAYS)
        logger.debug({ projectId, docId, packId }, 'inserting object from s3')
        return db.docHistory.insertOne(object, (err, confirmation) => {
          if (err) return callback(err)
          object._id = confirmation.insertedId
          callback(null, object)
        })
      }
    )
  },
}
