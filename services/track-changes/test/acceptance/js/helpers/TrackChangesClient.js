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
let TrackChangesClient
const async = require('async')
const zlib = require('zlib')
const request = require('request')
const Settings = require('@overleaf/settings')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.history
) // Only works locally for now
const Keys = Settings.redis.history.key_schema
const { db, ObjectId } = require('../../../../app/js/mongodb')

const aws = require('aws-sdk')
const s3 = new aws.S3({
  accessKeyId: Settings.trackchanges.s3.key,
  secretAccessKey: Settings.trackchanges.s3.secret,
  endpoint: Settings.trackchanges.s3.endpoint,
  s3ForcePathStyle: Settings.trackchanges.s3.pathStyle,
})
const S3_BUCKET = Settings.trackchanges.stores.doc_history

module.exports = TrackChangesClient = {
  flushAndGetCompressedUpdates(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return TrackChangesClient.flushDoc(projectId, docId, error => {
      if (error != null) {
        return callback(error)
      }
      return TrackChangesClient.getCompressedUpdates(docId, callback)
    })
  },

  flushDoc(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${projectId}/doc/${docId}/flush`,
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  flushProject(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${projectId}/flush`,
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  getCompressedUpdates(docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.docHistory
      .find({ doc_id: ObjectId(docId) })
      .sort({ 'meta.end_ts': 1 })
      .toArray(callback)
  },

  getProjectMetaData(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.projectHistoryMetaData.findOne(
      {
        project_id: ObjectId(projectId),
      },
      callback
    )
  },

  setPreserveHistoryForProject(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return db.projectHistoryMetaData.updateOne(
      {
        project_id: ObjectId(projectId),
      },
      {
        $set: { preserveHistory: true },
      },
      {
        upsert: true,
      },
      callback
    )
  },

  pushRawUpdates(projectId, docId, updates, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return rclient.sadd(
      Keys.docsWithHistoryOps({ project_id: projectId }),
      docId,
      error => {
        if (error != null) {
          return callback(error)
        }
        return rclient.rpush(
          Keys.uncompressedHistoryOps({ doc_id: docId }),
          ...Array.from(Array.from(updates).map(u => JSON.stringify(u))),
          callback
        )
      }
    )
  },

  getDiff(projectId, docId, from, to, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `http://localhost:3015/project/${projectId}/doc/${docId}/diff?from=${from}&to=${to}`,
      },
      (error, response, body) => {
        if (error) return callback(error)
        response.statusCode.should.equal(200)
        return callback(null, JSON.parse(body))
      }
    )
  },

  getUpdates(projectId, options, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `http://localhost:3015/project/${projectId}/updates?before=${options.before}&min_count=${options.min_count}`,
      },
      (error, response, body) => {
        if (error) return callback(error)
        response.statusCode.should.equal(200)
        return callback(null, JSON.parse(body))
      }
    )
  },

  exportProject(projectId, callback) {
    request.get(
      { url: `http://localhost:3015/project/${projectId}/export`, json: true },
      (error, response, updates) => {
        if (error) return callback(error)
        response.statusCode.should.equal(200)
        callback(null, updates, JSON.parse(response.trailers['x-user-ids']))
      }
    )
  },

  restoreDoc(projectId, docId, version, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${projectId}/doc/${docId}/version/${version}/restore`,
        headers: {
          'X-User-Id': userId,
        },
      },
      (error, response, body) => {
        if (error) return callback(error)
        response.statusCode.should.equal(204)
        return callback(null)
      }
    )
  },

  pushDocHistory(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${projectId}/doc/${docId}/push`,
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  pullDocHistory(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${projectId}/doc/${docId}/pull`,
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  waitForS3(done, retries) {
    if (retries == null) {
      retries = 42
    }
    if (!Settings.trackchanges.s3.endpoint) {
      return done()
    }

    return request.get(`${Settings.trackchanges.s3.endpoint}/`, (err, res) => {
      if (res && res.statusCode < 500) {
        return done()
      }

      if (retries === 0) {
        return done(err || new Error(`s3 returned ${res.statusCode}`))
      }

      return setTimeout(
        () => TrackChangesClient.waitForS3(done, --retries),
        1000
      )
    })
  },

  getS3Doc(projectId, docId, packId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const params = {
      Bucket: S3_BUCKET,
      Key: `${projectId}/changes-${docId}/pack-${packId}`,
    }

    return s3.getObject(params, (error, data) => {
      if (error != null) {
        return callback(error)
      }
      const body = data.Body
      if (body == null) {
        return callback(new Error('empty response from s3'))
      }
      return zlib.gunzip(body, (err, result) => {
        if (err != null) {
          return callback(err)
        }
        return callback(null, JSON.parse(result.toString()))
      })
    })
  },

  removeS3Doc(projectId, docId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    let params = {
      Bucket: S3_BUCKET,
      Prefix: `${projectId}/changes-${docId}`,
    }

    return s3.listObjects(params, (error, data) => {
      if (error != null) {
        return callback(error)
      }

      params = {
        Bucket: S3_BUCKET,
        Delete: {
          Objects: data.Contents.map(s3object => ({ Key: s3object.Key })),
        },
      }

      return s3.deleteObjects(params, callback)
    })
  },
}
