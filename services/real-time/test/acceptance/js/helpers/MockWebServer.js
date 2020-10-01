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
let MockWebServer
const sinon = require('sinon')
const express = require('express')

module.exports = MockWebServer = {
  projects: {},
  privileges: {},

  createMockProject(project_id, privileges, project) {
    MockWebServer.privileges[project_id] = privileges
    return (MockWebServer.projects[project_id] = project)
  },

  joinProject(project_id, user_id, callback) {
    if (callback == null) {
      callback = function (error, project, privilegeLevel) {}
    }
    return callback(
      null,
      MockWebServer.projects[project_id],
      MockWebServer.privileges[project_id][user_id] ||
        MockWebServer.privileges[project_id]['anonymous-user']
    )
  },

  joinProjectRequest(req, res, next) {
    const { project_id } = req.params
    const { user_id } = req.query
    if (project_id === 'not-found') {
      return res.status(404).send()
    }
    if (project_id === 'forbidden') {
      return res.status(403).send()
    }
    if (project_id === 'rate-limited') {
      return res.status(429).send()
    } else {
      return MockWebServer.joinProject(
        project_id,
        user_id,
        (error, project, privilegeLevel) => {
          if (error != null) {
            return next(error)
          }
          return res.json({
            project,
            privilegeLevel
          })
        }
      )
    }
  },

  running: false,
  run(callback) {
    if (callback == null) {
      callback = function (error) {}
    }
    if (MockWebServer.running) {
      return callback()
    }
    const app = express()
    app.post('/project/:project_id/join', MockWebServer.joinProjectRequest)
    return app
      .listen(3000, (error) => {
        MockWebServer.running = true
        return callback(error)
      })
      .on('error', (error) => {
        console.error('error starting MockWebServer:', error.message)
        return process.exit(1)
      })
  }
}

sinon.spy(MockWebServer, 'joinProject')
