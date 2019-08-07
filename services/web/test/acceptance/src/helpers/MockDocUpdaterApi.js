/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
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
let MockDocUpdaterApi
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()

module.exports = MockDocUpdaterApi = {
  updates: {},

  clearProjectStructureUpdates() {
    return (this.updates = {})
  },

  getProjectStructureUpdates(project_id) {
    return this.updates[project_id] || { docUpdates: [], fileUpdates: [] }
  },

  addProjectStructureUpdates(
    project_id,
    userId,
    docUpdates,
    fileUpdates,
    version
  ) {
    let update
    if (!this.updates[project_id]) {
      this.updates[project_id] = { docUpdates: [], fileUpdates: [] }
    }

    for (update of Array.from(docUpdates)) {
      update.userId = userId
      this.updates[project_id].docUpdates.push(update)
    }

    for (update of Array.from(fileUpdates)) {
      update.userId = userId
      this.updates[project_id].fileUpdates.push(update)
    }

    return (this.updates[project_id].version = version)
  },

  run() {
    app.post('/project/:project_id/flush', (req, res, next) => {
      return res.sendStatus(204)
    })

    app.post('/project/:project_id', jsonParser, (req, res, next) => {
      const { project_id } = req.params
      const { userId, docUpdates, fileUpdates, version } = req.body
      this.addProjectStructureUpdates(
        project_id,
        userId,
        docUpdates,
        fileUpdates,
        version
      )
      return res.sendStatus(200)
    })

    app.post('/project/:project_id/doc/:doc_id', (req, res, next) => {
      return res.sendStatus(204)
    })

    app.delete('/project/:project_id', (req, res) => {
      return res.sendStatus(204)
    })

    app.post('/project/:project_id/doc/:doc_id/flush', (req, res, next) => {
      return res.sendStatus(204)
    })

    app.delete('/project/:project_id/doc/:doc_id', (req, res, next) => {
      return res.sendStatus(204)
    })

    app.post('/project/:project_id/history/resync', (req, res, next) => {
      return res.sendStatus(204)
    })

    return app
      .listen(3003, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockDocUpdaterApi:', error.message)
        return process.exit(1)
      })
  }
}

MockDocUpdaterApi.run()
