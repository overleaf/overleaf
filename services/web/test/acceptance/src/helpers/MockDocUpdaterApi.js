const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()

const MockDocUpdaterApi = {
  updates: {},

  clearProjectStructureUpdates() {
    this.updates = {}
  },

  getProjectStructureUpdates(projectId) {
    return this.updates[projectId] || { updates: [] }
  },

  addProjectStructureUpdates(projectId, userId, updates, version) {
    if (!this.updates[projectId]) {
      this.updates[projectId] = { updates: [] }
    }

    for (const update of updates) {
      update.userId = userId
      this.updates[projectId].updates.push(update)
    }

    this.updates[projectId].version = version
  },

  run() {
    app.post('/project/:projectId/flush', (req, res, next) => {
      res.sendStatus(204)
    })

    app.post('/project/:projectId', jsonParser, (req, res, next) => {
      const { projectId } = req.params
      const { userId, updates, version } = req.body
      this.addProjectStructureUpdates(projectId, userId, updates, version)
      res.sendStatus(200)
    })

    app.post('/project/:projectId/doc/:doc_id', (req, res, next) => {
      res.sendStatus(204)
    })

    app.delete('/project/:projectId', (req, res) => {
      res.sendStatus(204)
    })

    app.post('/project/:projectId/doc/:doc_id/flush', (req, res, next) => {
      res.sendStatus(204)
    })

    app.delete('/project/:projectId/doc/:doc_id', (req, res, next) => {
      res.sendStatus(204)
    })

    app.post('/project/:projectId/history/resync', (req, res, next) => {
      res.sendStatus(204)
    })

    app
      .listen(3003, error => {
        if (error) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockDocUpdaterApi:', error.message)
        process.exit(1)
      })
  }
}

MockDocUpdaterApi.run()
module.exports = MockDocUpdaterApi
