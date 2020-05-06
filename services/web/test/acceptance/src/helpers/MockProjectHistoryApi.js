let MockProjectHistoryApi
const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const { ObjectId } = require('mongojs')

module.exports = MockProjectHistoryApi = {
  docs: {},

  oldFiles: {},

  projectVersions: {},

  labels: {},

  projectSnapshots: {},

  addOldFile(projectId, version, pathname, content) {
    this.oldFiles[`${projectId}:${version}:${pathname}`] = content
  },

  addProjectSnapshot(projectId, version, snapshot) {
    this.projectSnapshots[`${projectId}:${version}`] = snapshot
  },

  setProjectVersion(projectId, version) {
    this.projectVersions[projectId] = { version }
  },

  setProjectVersionInfo(projectId, versionInfo) {
    this.projectVersions[projectId] = versionInfo
  },

  addLabel(projectId, label) {
    if (label.id == null) {
      label.id = new ObjectId().toString()
    }
    if (this.labels[projectId] == null) {
      this.labels[projectId] = {}
    }
    this.labels[projectId][label.id] = label
  },

  deleteLabel(projectId, labelId) {
    delete this.labels[projectId][labelId]
  },

  getLabels(projectId) {
    if (this.labels[projectId] == null) {
      return null
    }
    return _.values(this.labels[projectId])
  },

  reset() {
    this.oldFiles = {}
    this.projectHistoryId = 1
    this.projectVersions = {}
    this.labels = {}
  },

  run() {
    this.reset()

    app.post('/project', (req, res, next) => {
      res.json({ project: { id: this.projectHistoryId++ } })
    })

    app.delete('/project/:projectId', (req, res, next) => {
      res.sendStatus(204)
    })

    app.get(
      '/project/:projectId/version/:version/:pathname',
      (req, res, next) => {
        const { projectId, version, pathname } = req.params
        const key = `${projectId}:${version}:${pathname}`
        if (this.oldFiles[key] != null) {
          res.send(this.oldFiles[key])
        } else {
          res.sendStatus(404)
        }
      }
    )

    app.get('/project/:projectId/version/:version', (req, res, next) => {
      const { projectId, version } = req.params
      const key = `${projectId}:${version}`
      if (this.projectSnapshots[key] != null) {
        res.json(this.projectSnapshots[key])
      } else {
        res.sendStatus(404)
      }
    })

    app.get('/project/:projectId/version', (req, res, next) => {
      const { projectId } = req.params
      if (this.projectVersions[projectId] != null) {
        res.json(this.projectVersions[projectId])
      } else {
        res.sendStatus(404)
      }
    })

    app.get('/project/:projectId/labels', (req, res, next) => {
      const { projectId } = req.params
      const labels = this.getLabels(projectId)
      if (labels != null) {
        res.json(labels)
      } else {
        res.sendStatus(404)
      }
    })

    app.post(
      '/project/:projectId/user/:user_id/labels',
      bodyParser.json(),
      (req, res, next) => {
        const { projectId } = req.params
        const { comment, version } = req.body
        const labelId = new ObjectId().toString()
        this.addLabel(projectId, { id: labelId, comment, version })
        res.json({ label_id: labelId, comment, version })
      }
    )

    app.delete(
      '/project/:projectId/user/:user_id/labels/:labelId',
      (req, res, next) => {
        const { projectId, labelId } = req.params
        const label =
          this.labels[projectId] != null
            ? this.labels[projectId][labelId]
            : undefined
        if (label != null) {
          this.deleteLabel(projectId, labelId)
          res.sendStatus(204)
        } else {
          res.sendStatus(404)
        }
      }
    )

    app.post('/project/:projectId/flush', (req, res, next) => {
      res.sendStatus(200)
    })

    app
      .listen(3054, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockProjectHistoryApi:', error.message)
        process.exit(1)
      })
  }
}

MockProjectHistoryApi.run()
