/* eslint-disable
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
  userMetadata: {},

  createMockProject(projectId, privileges, project, metadataByUser) {
    MockWebServer.privileges[projectId] = privileges
    MockWebServer.userMetadata[projectId] = metadataByUser
    return (MockWebServer.projects[projectId] = project)
  },

  joinProject(projectId, userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const project = MockWebServer.projects[projectId]
    const privilegeLevel =
      MockWebServer.privileges[projectId][userId] ||
      MockWebServer.privileges[projectId]['anonymous-user']
    const userMetadata = MockWebServer.userMetadata[projectId]?.[userId]
    return callback(null, project, privilegeLevel, userMetadata)
  },

  joinProjectRequest(req, res, next) {
    const { project_id: projectId } = req.params
    const { user_id: userId } = req.query
    if (projectId === '404404404404404404404404') {
      // not-found
      return res.status(404).send()
    }
    if (projectId === '403403403403403403403403') {
      // forbidden
      return res.status(403).send()
    }
    if (projectId === '429429429429429429429429') {
      // rate-limited
      return res.status(429).send()
    } else {
      return MockWebServer.joinProject(
        projectId,
        userId,
        (error, project, privilegeLevel, userMetadata) => {
          if (error != null) {
            return next(error)
          }
          return res.json({
            project,
            privilegeLevel,
            isRestrictedUser: !!userMetadata?.isRestrictedUser,
            isTokenMember: !!userMetadata?.isTokenMember,
            isInvitedMember: !!userMetadata?.isInvitedMember,
          })
        }
      )
    }
  },

  running: false,
  run(callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (MockWebServer.running) {
      return callback()
    }
    const app = express()
    app.post('/project/:project_id/join', MockWebServer.joinProjectRequest)
    return app
      .listen(3000, error => {
        MockWebServer.running = true
        return callback(error)
      })
      .on('error', error => {
        console.error('error starting MockWebServer:', error.message)
        return process.exit(1)
      })
  },
}

sinon.spy(MockWebServer, 'joinProject')
