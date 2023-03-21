const request = require('request')
const logger = require('@overleaf/logger')
const Settings = require('@overleaf/settings')
const Errors = require('./Errors')

function peekDocument(projectId, docId, callback) {
  const url = `${Settings.apis.docstore.url}/project/${projectId}/doc/${docId}/peek`
  logger.debug({ projectId, docId }, 'getting doc from docstore')
  request.get(url, function (error, res, body) {
    if (error != null) {
      return callback(error)
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        body = JSON.parse(body)
      } catch (error) {
        return callback(error)
      }
      logger.debug(
        { projectId, docId, version: body.version },
        'got doc from docstore'
      )
      return callback(null, body.lines.join('\n'), body.version)
    } else if (res.statusCode === 404) {
      return callback(
        new Errors.NotFoundError('doc not found', { projectId, docId })
      )
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
