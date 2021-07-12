/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocstoreClient
const request = require('request').defaults({ jar: false })
const settings = require('@overleaf/settings')
const Persistor = require('../../../../app/js/PersistorManager')

async function streamToString(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
}

async function getStringFromPersistor(persistor, bucket, key) {
  const stream = await persistor.getObjectStream(bucket, key, {})
  stream.resume()
  return streamToString(stream)
}

module.exports = DocstoreClient = {
  createDoc(project_id, doc_id, lines, version, ranges, callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    return DocstoreClient.updateDoc(
      project_id,
      doc_id,
      lines,
      version,
      ranges,
      callback
    )
  },

  getDoc(project_id, doc_id, qs, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}`,
        json: true,
        qs
      },
      callback
    )
  },

  isDocDeleted(project_id, doc_id, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}/deleted`,
        json: true
      },
      callback
    )
  },

  getAllDocs(project_id, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc`,
        json: true
      },
      (req, res, body) => {
        callback(req, res, body)
      }
    )
  },

  getAllDeletedDocs(project_id, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc-deleted`,
        json: true
      },
      (error, res, body) => {
        if (error) return callback(error)
        if (res.statusCode !== 200) {
          return callback(new Error('unexpected statusCode'))
        }
        callback(null, body)
      }
    )
  },

  getAllRanges(project_id, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/ranges`,
        json: true
      },
      callback
    )
  },

  updateDoc(project_id, doc_id, lines, version, ranges, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}`,
        json: {
          lines,
          version,
          ranges
        }
      },
      callback
    )
  },

  deleteDoc(project_id, doc_id, callback) {
    DocstoreClient.deleteDocWithDateAndName(
      project_id,
      doc_id,
      new Date(),
      'main.tex',
      callback
    )
  },

  deleteDocWithDate(project_id, doc_id, date, callback) {
    DocstoreClient.deleteDocWithDateAndName(
      project_id,
      doc_id,
      date,
      'main.tex',
      callback
    )
  },

  deleteDocWithName(project_id, doc_id, name, callback) {
    DocstoreClient.deleteDocWithDateAndName(
      project_id,
      doc_id,
      new Date(),
      name,
      callback
    )
  },

  deleteDocWithDateAndName(project_id, doc_id, deletedAt, name, callback) {
    request.patch(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}`,
        json: { name, deleted: true, deletedAt }
      },
      callback
    )
  },

  archiveAllDoc(project_id, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/archive`
      },
      callback
    )
  },

  archiveDocById(project_id, doc_id, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/doc/${doc_id}/archive`
      },
      callback
    )
  },

  destroyAllDoc(project_id, callback) {
    if (callback == null) {
      callback = function (error, res, body) {}
    }
    return request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${project_id}/destroy`
      },
      callback
    )
  },

  getS3Doc(project_id, doc_id, callback) {
    getStringFromPersistor(
      Persistor,
      settings.docstore.bucket,
      `${project_id}/${doc_id}`
    )
      .then((data) => {
        callback(null, JSON.parse(data))
      })
      .catch(callback)
  }
}
