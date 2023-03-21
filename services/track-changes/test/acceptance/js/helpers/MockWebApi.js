// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let MockWebApi
const express = require('express')
const app = express()

module.exports = MockWebApi = {
  users: {},

  projects: {},

  getUserInfo(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return callback(null, this.users[userId] || null)
  },

  getProjectDetails(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return callback(null, this.projects[projectId])
  },

  run() {
    app.get('/user/:user_id/personal_info', (req, res, next) => {
      return this.getUserInfo(req.params.user_id, (error, user) => {
        if (error != null) {
          res.sendStatus(500)
        }
        if (user == null) {
          return res.sendStatus(404)
        } else {
          return res.send(JSON.stringify(user))
        }
      })
    })

    app.get('/project/:project_id/details', (req, res, next) => {
      return this.getProjectDetails(req.params.project_id, (error, project) => {
        if (error != null) {
          res.sendStatus(500)
        }
        if (project == null) {
          return res.sendStatus(404)
        } else {
          return res.send(JSON.stringify(project))
        }
      })
    })

    return app
      .listen(3000, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockWebApiServer:', error.message)
        return process.exit(1)
      })
  },
}

MockWebApi.run()
