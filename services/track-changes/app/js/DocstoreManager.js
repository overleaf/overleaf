const request = require('request')
const logger = require('logger-sharelatex')
const Settings = require('@overleaf/settings')

function peekDocument(projectId, docId, callback) {
  const url = `${Settings.apis.docstore.url}/project/${projectId}/doc/${docId}/peek`
  logger.log(
    { project_id: projectId, doc_id: docId },
    'getting doc from docstore'
  )
  request.get(url, function (error, res, body) {
    if (error != null) {
      return callback(error)
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        body = JSON.parse(body)
      } catch (error1) {
        error = error1
        return callback(error)
      }
      logger.log(
        { project_id: projectId, doc_id: docId, version: body.version },
        'got doc from docstore'
      )
      return callback(null, body.lines.join('\n'), body.version)
    } else {
      return callback(
        new Error(
          `docstore returned a non-success status code: ${res.statusCode}`
        )
      )
    }
  })
}

module.exports = {
  promises: {
    peekDocument: (projectId, docId) => {
      return new Promise((resolve, reject) => {
        peekDocument(projectId, docId, (err, content, version) => {
          if (err) {
            reject(err)
          } else {
            resolve([content, version])
          }
        })
      })
    },
  },
}
