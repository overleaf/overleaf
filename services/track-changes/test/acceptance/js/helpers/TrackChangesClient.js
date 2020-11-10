/* eslint-disable
    camelcase,
    handle-callback-err,
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
const Settings = require('settings-sharelatex')
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
  s3ForcePathStyle: Settings.trackchanges.s3.pathStyle
})
const S3_BUCKET = Settings.trackchanges.stores.doc_history

module.exports = TrackChangesClient = {
  flushAndGetCompressedUpdates(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, updates) {}
    }
    return TrackChangesClient.flushDoc(project_id, doc_id, (error) => {
      if (error != null) {
        return callback(error)
      }
      return TrackChangesClient.getCompressedUpdates(doc_id, callback)
    })
  },

  flushDoc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${project_id}/doc/${doc_id}/flush`
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  flushProject(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${project_id}/flush`
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  getCompressedUpdates(doc_id, callback) {
    if (callback == null) {
      callback = function (error, updates) {}
    }
    return db.docHistory
      .find({ doc_id: ObjectId(doc_id) })
      .sort({ 'meta.end_ts': 1 })
      .toArray(callback)
  },

  getProjectMetaData(project_id, callback) {
    if (callback == null) {
      callback = function (error, updates) {}
    }
    return db.projectHistoryMetaData.findOne(
      {
        project_id: ObjectId(project_id)
      },
      callback
    )
  },

  setPreserveHistoryForProject(project_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return db.projectHistoryMetaData.updateOne(
      {
        project_id: ObjectId(project_id)
      },
      {
        $set: { preserveHistory: true }
      },
      {
        upsert: true
      },
      callback
    )
  },

  pushRawUpdates(project_id, doc_id, updates, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return rclient.sadd(
      Keys.docsWithHistoryOps({ project_id }),
      doc_id,
      (error) => {
        if (error != null) {
          return callback(error)
        }
        return rclient.rpush(
          Keys.uncompressedHistoryOps({ doc_id }),
          ...Array.from(Array.from(updates).map((u) => JSON.stringify(u))),
          callback
        )
      }
    )
  },

  getDiff(project_id, doc_id, from, to, callback) {
    if (callback == null) {
      callback = function (error, diff) {}
    }
    return request.get(
      {
        url: `http://localhost:3015/project/${project_id}/doc/${doc_id}/diff?from=${from}&to=${to}`
      },
      (error, response, body) => {
        response.statusCode.should.equal(200)
        return callback(null, JSON.parse(body))
      }
    )
  },

  getUpdates(project_id, options, callback) {
    if (callback == null) {
      callback = function (error, body) {}
    }
    return request.get(
      {
        url: `http://localhost:3015/project/${project_id}/updates?before=${options.before}&min_count=${options.min_count}`
      },
      (error, response, body) => {
        response.statusCode.should.equal(200)
        return callback(null, JSON.parse(body))
      }
    )
  },

  restoreDoc(project_id, doc_id, version, user_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${project_id}/doc/${doc_id}/version/${version}/restore`,
        headers: {
          'X-User-Id': user_id
        }
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(null)
      }
    )
  },

  pushDocHistory(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${project_id}/doc/${doc_id}/push`
      },
      (error, response, body) => {
        response.statusCode.should.equal(204)
        return callback(error)
      }
    )
  },

  pullDocHistory(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return request.post(
      {
        url: `http://localhost:3015/project/${project_id}/doc/${doc_id}/pull`
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

  getS3Doc(project_id, doc_id, pack_id, callback) {
    if (callback == null) {
      callback = function (error, body) {}
    }
    const params = {
      Bucket: S3_BUCKET,
      Key: `${project_id}/changes-${doc_id}/pack-${pack_id}`
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

  removeS3Doc(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    let params = {
      Bucket: S3_BUCKET,
      Prefix: `${project_id}/changes-${doc_id}`
    }

    return s3.listObjects(params, (error, data) => {
      if (error != null) {
        return callback(error)
      }

      params = {
        Bucket: S3_BUCKET,
        Delete: {
          Objects: data.Contents.map((s3object) => ({ Key: s3object.Key }))
        }
      }

      return s3.deleteObjects(params, callback)
    })
  }
}
