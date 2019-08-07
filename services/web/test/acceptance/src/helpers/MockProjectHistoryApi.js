/* eslint-disable
    camelcase,
    max-len,
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

  addOldFile(project_id, version, pathname, content) {
    return (this.oldFiles[`${project_id}:${version}:${pathname}`] = content)
  },

  addProjectSnapshot(project_id, version, snapshot) {
    return (this.projectSnapshots[`${project_id}:${version}`] = snapshot)
  },

  setProjectVersion(project_id, version) {
    return (this.projectVersions[project_id] = { version })
  },

  setProjectVersionInfo(project_id, versionInfo) {
    return (this.projectVersions[project_id] = versionInfo)
  },

  addLabel(project_id, label) {
    if (label.id == null) {
      label.id = new ObjectId().toString()
    }
    if (this.labels[project_id] == null) {
      this.labels[project_id] = {}
    }
    return (this.labels[project_id][label.id] = label)
  },

  deleteLabel(project_id, label_id) {
    return delete this.labels[project_id][label_id]
  },

  getLabels(project_id) {
    if (this.labels[project_id] == null) {
      return null
    }
    return _.values(this.labels[project_id])
  },

  reset() {
    this.oldFiles = {}
    this.projectVersions = {}
    return (this.labels = {})
  },

  run() {
    app.post('/project', (req, res, next) => {
      return res.json({ project: { id: 1 } })
    })

    app.get(
      '/project/:project_id/version/:version/:pathname',
      (req, res, next) => {
        const { project_id, version, pathname } = req.params
        const key = `${project_id}:${version}:${pathname}`
        if (this.oldFiles[key] != null) {
          return res.send(this.oldFiles[key])
        } else {
          return res.send(404)
        }
      }
    )

    app.get('/project/:project_id/version/:version', (req, res, next) => {
      const { project_id, version } = req.params
      const key = `${project_id}:${version}`
      if (this.projectSnapshots[key] != null) {
        return res.json(this.projectSnapshots[key])
      } else {
        return res.sendStatus(404)
      }
    })

    app.get('/project/:project_id/version', (req, res, next) => {
      const { project_id } = req.params
      if (this.projectVersions[project_id] != null) {
        return res.json(this.projectVersions[project_id])
      } else {
        return res.send(404)
      }
    })

    app.get('/project/:project_id/labels', (req, res, next) => {
      const { project_id } = req.params
      const labels = this.getLabels(project_id)
      if (labels != null) {
        return res.json(labels)
      } else {
        return res.send(404)
      }
    })

    app.post(
      '/project/:project_id/user/:user_id/labels',
      bodyParser.json(),
      (req, res, next) => {
        const { project_id } = req.params
        const { comment, version } = req.body
        const label_id = new ObjectId().toString()
        this.addLabel(project_id, { id: label_id, comment, version })
        return res.json({ label_id, comment, version })
      }
    )

    app.delete(
      '/project/:project_id/user/:user_id/labels/:label_id',
      (req, res, next) => {
        const { project_id, label_id } = req.params
        const label =
          this.labels[project_id] != null
            ? this.labels[project_id][label_id]
            : undefined
        if (label != null) {
          this.deleteLabel(project_id, label_id)
          return res.send(204)
        } else {
          return res.send(404)
        }
      }
    )

    app.post('/project/:project_id/flush', (req, res, next) => {
      return res.sendStatus(200)
    })

    return app
      .listen(3054, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockProjectHistoryApi:', error.message)
        return process.exit(1)
      })
  }
}

MockProjectHistoryApi.run()
