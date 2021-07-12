/* eslint-disable
    camelcase,
    handle-callback-err,
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
const logger = require('logger-sharelatex')
const AWS = require('aws-sdk')
const S3S = require('s3-streams')
const { db, ObjectId } = require('./mongodb')
const JSONStream = require('JSONStream')
const ReadlineStream = require('byline')
const zlib = require('zlib')
const Metrics = require('@overleaf/metrics')

const DAYS = 24 * 3600 * 1000 // one day in milliseconds

const createStream = function (streamConstructor, project_id, doc_id, pack_id) {
  const AWS_CONFIG = {
    accessKeyId: settings.trackchanges.s3.key,
    secretAccessKey: settings.trackchanges.s3.secret,
    endpoint: settings.trackchanges.s3.endpoint,
    s3ForcePathStyle: settings.trackchanges.s3.pathStyle
  }

  return streamConstructor(new AWS.S3(AWS_CONFIG), {
    Bucket: settings.trackchanges.stores.doc_history,
    Key: project_id + '/changes-' + doc_id + '/pack-' + pack_id
  })
}

module.exports = MongoAWS = {
  archivePack(project_id, doc_id, pack_id, _callback) {
    if (_callback == null) {
      _callback = function (error) {}
    }
    const callback = function (...args) {
      _callback(...Array.from(args || []))
      return (_callback = function () {})
    }

    const query = {
      _id: ObjectId(pack_id),
      doc_id: ObjectId(doc_id)
    }

    if (project_id == null) {
      return callback(new Error('invalid project id'))
    }
    if (doc_id == null) {
      return callback(new Error('invalid doc id'))
    }
    if (pack_id == null) {
      return callback(new Error('invalid pack id'))
    }

    logger.log({ project_id, doc_id, pack_id }, 'uploading data to s3')

    const upload = createStream(S3S.WriteStream, project_id, doc_id, pack_id)

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
        logger.error({ err: error, project_id, doc_id, pack_id }, error.message)
        return callback(error)
      }
      return zlib.gzip(uncompressedData, function (err, buf) {
        logger.log(
          {
            project_id,
            doc_id,
            pack_id,
            origSize: uncompressedData.length,
            newSize: buf.length
          },
          'compressed pack'
        )
        if (err != null) {
          return callback(err)
        }
        upload.on('error', (err) => callback(err))
        upload.on('finish', function () {
          Metrics.inc('archive-pack')
          logger.log({ project_id, doc_id, pack_id }, 'upload to s3 completed')
          return callback(null)
        })
        upload.write(buf)
        return upload.end()
      })
    })
  },

  readArchivedPack(project_id, doc_id, pack_id, _callback) {
    if (_callback == null) {
      _callback = function (error, result) {}
    }
    const callback = function (...args) {
      _callback(...Array.from(args || []))
      return (_callback = function () {})
    }

    if (project_id == null) {
      return callback(new Error('invalid project id'))
    }
    if (doc_id == null) {
      return callback(new Error('invalid doc id'))
    }
    if (pack_id == null) {
      return callback(new Error('invalid pack id'))
    }

    logger.log({ project_id, doc_id, pack_id }, 'downloading data from s3')

    const download = createStream(S3S.ReadStream, project_id, doc_id, pack_id)

    const inputStream = download
      .on('open', (obj) => 1)
      .on('error', (err) => callback(err))

    const gunzip = zlib.createGunzip()
    gunzip.setEncoding('utf8')
    gunzip.on('error', function (err) {
      logger.log(
        { project_id, doc_id, pack_id, err },
        'error uncompressing gzip stream'
      )
      return callback(err)
    })

    const outputStream = inputStream.pipe(gunzip)
    const parts = []
    outputStream.on('error', (err) => callback(err))
    outputStream.on('end', function () {
      let object
      logger.log({ project_id, doc_id, pack_id }, 'download from s3 completed')
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
    return outputStream.on('data', (data) => parts.push(data))
  },

  unArchivePack(project_id, doc_id, pack_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return MongoAWS.readArchivedPack(project_id, doc_id, pack_id, function (
      err,
      object
    ) {
      if (err != null) {
        return callback(err)
      }
      Metrics.inc('unarchive-pack')
      // allow the object to expire, we can always retrieve it again
      object.expiresAt = new Date(Date.now() + 7 * DAYS)
      logger.log({ project_id, doc_id, pack_id }, 'inserting object from s3')
      return db.docHistory.insertOne(object, (err, confirmation) => {
        if (err) return callback(err)
        object._id = confirmation.insertedId
        callback(null, object)
      })
    })
  }
}
