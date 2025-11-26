import AbstractMockApi from './AbstractMockApi.mjs'
import _ from 'lodash'
import mongodb from 'mongodb-legacy'
import { plainTextResponse } from '../../../../app/src/infrastructure/Response.mjs'

const { ObjectId } = mongodb

class MockProjectHistoryApi extends AbstractMockApi {
  reset() {
    this.docs = {}
    this.oldFiles = {}
    this.projectVersions = {}
    this.labels = {}
    this.projectSnapshots = {}
    this.projectHistoryId = 1
  }

  addOldFile(projectId, version, pathname, content) {
    this.oldFiles[`${projectId}:${version}:${pathname}`] = content
  }

  addProjectSnapshot(projectId, version, snapshot) {
    this.projectSnapshots[`${projectId}:${version}`] = snapshot
  }

  setProjectVersion(projectId, version) {
    this.projectVersions[projectId] = { version }
  }

  setProjectVersionInfo(projectId, versionInfo) {
    this.projectVersions[projectId] = versionInfo
  }

  addLabel(projectId, label) {
    if (label.id == null) {
      label.id = new ObjectId().toString()
    }
    if (this.labels[projectId] == null) {
      this.labels[projectId] = {}
    }
    this.labels[projectId][label.id] = label
  }

  deleteLabel(projectId, labelId) {
    delete this.labels[projectId][labelId]
  }

  getLabels(projectId) {
    if (this.labels[projectId] == null) {
      return null
    }
    return _.values(this.labels[projectId])
  }

  applyRoutes() {
    this.app.post('/project', (req, res) => {
      res.json({ project: { id: this.projectHistoryId++ } })
    })

    this.app.delete('/project/:projectId', (req, res) => {
      res.sendStatus(204)
    })

    this.app.get(
      '/project/:projectId/version/:version/:pathname',
      (req, res) => {
        const { projectId, version, pathname } = req.params
        const key = `${projectId}:${version}:${pathname}`
        if (this.oldFiles[key] != null) {
          plainTextResponse(res, this.oldFiles[key])
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.get('/project/:projectId/version/:version', (req, res) => {
      const { projectId, version } = req.params
      const key = `${projectId}:${version}`
      if (this.projectSnapshots[key] != null) {
        res.json(this.projectSnapshots[key])
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get('/project/:projectId/version', (req, res) => {
      const { projectId } = req.params
      if (this.projectVersions[projectId] != null) {
        res.json(this.projectVersions[projectId])
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get('/project/:projectId/labels', (req, res) => {
      const { projectId } = req.params
      const labels = this.getLabels(projectId)
      if (labels != null) {
        res.json(labels)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.post('/project/:projectId/labels', (req, res) => {
      const { projectId } = req.params
      const { comment, version } = req.body
      const labelId = new ObjectId().toString()
      this.addLabel(projectId, { id: labelId, comment, version })
      res.json({ label_id: labelId, comment, version })
    })

    this.app.delete(
      '/project/:projectId/user/:user_id/labels/:labelId',
      (req, res) => {
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

    this.app.delete('/project/:projectId/labels/:labelId', (req, res) => {
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
    })

    this.app.post('/project/:projectId/flush', (req, res) => {
      res.sendStatus(200)
    })
  }
}

export default MockProjectHistoryApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockProjectHistoryApi
 * @static
 * @returns {MockProjectHistoryApi}
 */
