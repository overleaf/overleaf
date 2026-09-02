import AbstractMockApi from './AbstractMockApi.mjs'
import _ from 'lodash'
import mongodb from 'mongodb-legacy'
import { plainTextResponse } from '../../../../app/src/infrastructure/Response.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

const { ObjectId } = mongodb

// Mirrors services/project-history/app/js/HttpController.js's historyIdSchema
// (this mock stands in for project-history's own API in web's acceptance
// tests): most :projectId params accept either a Mongo ObjectId or a legacy
// v1-only numeric id.
const historyIdSchema = zz.objectId().or(z.coerce.number())

const oldFileParamsSchema = z.object({
  params: z.strictObject({
    projectId: historyIdSchema,
    version: z.coerce.number().int(),
    pathname: zz.filepath(),
  }),
})

const projectSnapshotParamsSchema = z.object({
  params: z.strictObject({
    projectId: historyIdSchema,
    version: z.coerce.number().int(),
  }),
})

const projectParamsSchema = z.object({
  params: z.strictObject({ projectId: historyIdSchema }),
})

// Mirrors HttpController.js's createLabelSchema body in full -- web's own
// HistoryController.createLabel is the only current caller and always sends
// just { comment, version, user_id }, but created_at/validate_exists are
// genuine fields of the real route (accepted -- with defaults -- from other,
// non-web callers), so they are modelled here too rather than narrowed to
// only what's exercised today.
const createLabelSchema = z.object({
  params: z.strictObject({ projectId: historyIdSchema }),
  body: z.strictObject({
    comment: z.string(),
    version: z.number().int(),
    created_at: zz.datetime().optional(),
    validate_exists: z.boolean().default(true),
    user_id: zz.objectId().nullable().optional(),
  }),
})

const deleteLabelForUserParamsSchema = z.object({
  params: z.strictObject({
    projectId: historyIdSchema,
    user_id: zz.objectId(),
    labelId: zz.objectId(),
  }),
})

const deleteLabelParamsSchema = z.object({
  params: z.strictObject({
    projectId: historyIdSchema,
    labelId: zz.objectId(),
  }),
})

class MockProjectHistoryApi extends AbstractMockApi {
  reset() {
    this.docs = {}
    this.oldFiles = {}
    this.projectVersions = {}
    this.labels = {}
    this.projectSnapshots = {}
    this.projectHistoryId = 1
    this.flushedProjects = []
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
        const { params } = parseReq(req, oldFileParamsSchema)
        const { projectId, version, pathname } = params
        const key = `${projectId}:${version}:${pathname}`
        if (this.oldFiles[key] != null) {
          plainTextResponse(res, this.oldFiles[key])
        } else {
          res.sendStatus(404)
        }
      }
    )

    this.app.get('/project/:projectId/version/:version', (req, res) => {
      const { params } = parseReq(req, projectSnapshotParamsSchema)
      const { projectId, version } = params
      const key = `${projectId}:${version}`
      if (this.projectSnapshots[key] != null) {
        res.json(this.projectSnapshots[key])
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get('/project/:projectId/version', (req, res) => {
      const { params } = parseReq(req, projectParamsSchema)
      const { projectId } = params
      if (this.projectVersions[projectId] != null) {
        res.json(this.projectVersions[projectId])
      } else {
        res.sendStatus(404)
      }
    })

    this.app.get('/project/:projectId/labels', (req, res) => {
      const { params } = parseReq(req, projectParamsSchema)
      const { projectId } = params
      const labels = this.getLabels(projectId)
      if (labels != null) {
        res.json(labels)
      } else {
        res.sendStatus(404)
      }
    })

    this.app.post('/project/:projectId/labels', (req, res) => {
      const { params, body } = parseReq(req, createLabelSchema)
      const { projectId } = params
      const { comment, version } = body
      const labelId = new ObjectId().toString()
      this.addLabel(projectId, { id: labelId, comment, version })
      res.json({ label_id: labelId, comment, version })
    })

    this.app.delete(
      '/project/:projectId/user/:user_id/labels/:labelId',
      (req, res) => {
        const { params } = parseReq(req, deleteLabelForUserParamsSchema)
        const { projectId, labelId } = params
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
      const { params } = parseReq(req, deleteLabelParamsSchema)
      const { projectId, labelId } = params
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
      const { params } = parseReq(req, projectParamsSchema)
      this.flushedProjects.push(params.projectId.toString())
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
