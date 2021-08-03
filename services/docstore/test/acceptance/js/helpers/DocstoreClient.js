let DocstoreClient
const request = require('request').defaults({ jar: false })
const settings = require('@overleaf/settings')
const Persistor = require('../../../../app/js/PersistorManager')

async function streamToString(stream) {
  const chunks = []
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(chunk))
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
  createDoc(projectId, docId, lines, version, ranges, callback) {
    return DocstoreClient.updateDoc(
      projectId,
      docId,
      lines,
      version,
      ranges,
      callback
    )
  },

  getDoc(projectId, docId, qs, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}`,
        json: true,
        qs,
      },
      callback
    )
  },

  peekDoc(projectId, docId, qs, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}/peek`,
        json: true,
        qs,
      },
      callback
    )
  },

  isDocDeleted(projectId, docId, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}/deleted`,
        json: true,
      },
      callback
    )
  },

  getAllDocs(projectId, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc`,
        json: true,
      },
      (req, res, body) => {
        callback(req, res, body)
      }
    )
  },

  getAllDeletedDocs(projectId, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc-deleted`,
        json: true,
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

  getAllRanges(projectId, callback) {
    request.get(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/ranges`,
        json: true,
      },
      callback
    )
  },

  updateDoc(projectId, docId, lines, version, ranges, callback) {
    return request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}`,
        json: {
          lines,
          version,
          ranges,
        },
      },
      callback
    )
  },

  deleteDoc(projectId, docId, callback) {
    DocstoreClient.deleteDocWithDateAndName(
      projectId,
      docId,
      new Date(),
      'main.tex',
      callback
    )
  },

  deleteDocWithDate(projectId, docId, date, callback) {
    DocstoreClient.deleteDocWithDateAndName(
      projectId,
      docId,
      date,
      'main.tex',
      callback
    )
  },

  deleteDocWithName(projectId, docId, name, callback) {
    DocstoreClient.deleteDocWithDateAndName(
      projectId,
      docId,
      new Date(),
      name,
      callback
    )
  },

  deleteDocWithDateAndName(projectId, docId, deletedAt, name, callback) {
    request.patch(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}`,
        json: { name, deleted: true, deletedAt },
      },
      callback
    )
  },

  archiveAllDoc(projectId, callback) {
    request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/archive`,
      },
      callback
    )
  },

  archiveDocById(projectId, docId, callback) {
    request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/doc/${docId}/archive`,
      },
      callback
    )
  },

  destroyAllDoc(projectId, callback) {
    request.post(
      {
        url: `http://localhost:${settings.internal.docstore.port}/project/${projectId}/destroy`,
      },
      callback
    )
  },

  getS3Doc(projectId, docId, callback) {
    getStringFromPersistor(
      Persistor,
      settings.docstore.bucket,
      `${projectId}/${docId}`
    )
      .then(data => {
        callback(null, JSON.parse(data))
      })
      .catch(callback)
  },
}
