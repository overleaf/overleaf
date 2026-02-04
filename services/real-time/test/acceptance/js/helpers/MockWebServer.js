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
import sinon from 'sinon'
import express from 'express'
import bodyParser from 'body-parser'

let MockWebServer

export default MockWebServer = {
  projects: {},
  privileges: {},
  userMetadata: {},

  createMockProject(projectId, privileges, project, metadataByUser) {
    MockWebServer.privileges[projectId] = privileges
    MockWebServer.userMetadata[projectId] = metadataByUser
    return (MockWebServer.projects[projectId] = project)
  },

  inviteUserToProject(projectId, user, privileges) {
    MockWebServer.privileges[projectId][user._id] = privileges
    MockWebServer.userMetadata[projectId][user._id] = user
  },

  joinProject(projectId, userId, anonymousAccessToken, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const project = MockWebServer.projects[projectId]
    const privilegeLevel =
      MockWebServer.privileges[projectId]?.[userId] ||
      MockWebServer.privileges[projectId]?.[anonymousAccessToken]
    const userMetadata = MockWebServer.userMetadata[projectId]?.[userId]
    return callback(null, project, privilegeLevel, userMetadata)
  },

  joinProjectRequest(req, res, next) {
    const { project_id: projectId } = req.params
    const { anonymousAccessToken, userId } = req.body
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
        anonymousAccessToken,
        (error, project, privilegeLevel, userMetadata) => {
          if (error != null) {
            return next(error)
          }
          if (!project) {
            return res.sendStatus(404)
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
    app.use(bodyParser.json())
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
