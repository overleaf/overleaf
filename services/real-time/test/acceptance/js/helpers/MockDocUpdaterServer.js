/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockDocUpdaterServer
const sinon = require('sinon')
const express = require('express')

module.exports = MockDocUpdaterServer = {
  docs: {},

  createMockDoc(project_id, doc_id, data) {
    return (MockDocUpdaterServer.docs[`${project_id}:${doc_id}`] = data)
  },

  getDocument(project_id, doc_id, fromVersion, callback) {
    if (callback == null) {
      callback = function (error, data) {}
    }
    return callback(null, MockDocUpdaterServer.docs[`${project_id}:${doc_id}`])
  },

  deleteProject: sinon.stub().callsArg(1),

  getDocumentRequest(req, res, next) {
    const { project_id, doc_id } = req.params
    let { fromVersion } = req.query
    fromVersion = parseInt(fromVersion, 10)
    return MockDocUpdaterServer.getDocument(
      project_id,
      doc_id,
      fromVersion,
      (error, data) => {
        if (error != null) {
          return next(error)
        }
        if (!data) {
          return res.sendStatus(404)
        }
        return res.json(data)
      }
    )
  },

  deleteProjectRequest(req, res, next) {
    const { project_id } = req.params
    return MockDocUpdaterServer.deleteProject(project_id, error => {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(204)
    })
  },

  running: false,
  run(callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (MockDocUpdaterServer.running) {
      return callback()
    }
    const app = express()
    app.get(
      '/project/:project_id/doc/:doc_id',
      MockDocUpdaterServer.getDocumentRequest
    )
    app.delete(
      '/project/:project_id',
      MockDocUpdaterServer.deleteProjectRequest
    )
    return app
      .listen(3003, error => {
        MockDocUpdaterServer.running = true
        return callback(error)
      })
      .on('error', error => {
        console.error('error starting MockDocUpdaterServer:', error.message)
        return process.exit(1)
      })
  },
}

sinon.spy(MockDocUpdaterServer, 'getDocument')
