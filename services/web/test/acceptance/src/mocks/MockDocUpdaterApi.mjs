import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import editorCoreSchemas from 'overleaf-editor-core/lib/schemas.js'
import rangesSchemas from '@overleaf/ranges-tracker/schemas.js'

const docParamsSchema = z.strictObject({
  projectId: zz.objectId(),
  docId: zz.objectId(),
})

const getDocSchema = z.object({
  params: docParamsSchema,
  query: z.object({
    historyOTSupport: z.stringbool().default(false),
    fromVersion: z.coerce.number().int().default(-1),
  }),
})

const setDocSchema = z.object({
  params: docParamsSchema,
  body: z.strictObject({
    lines: z.array(z.string()),
    source: z.string(),
    user_id: zz.objectId().nullish(),
    undoing: z.boolean().optional(),
    trackChanges: z.boolean().optional(),
  }),
})

// Mirrors services/document-updater/app/js/HttpController.js's
// updateProjectSchema (renameUpdateSchema/addUpdateSchema) -- this mock's
// own routes use :projectId/:docId casing rather than document-updater's
// :project_id/:doc_id.
const renameUpdateSchema = z.strictObject({
  type: z.enum(['rename-doc', 'rename-file']),
  id: zz.objectId(),
  pathname: zz.safePath(),
  // deletes are renames to an empty newPathname
  newPathname: zz.safePath().or(z.literal('')),
})

const addUpdateSchema = z.strictObject({
  type: z.enum(['add-doc', 'add-file']),
  id: zz.objectId(),
  pathname: zz.safePath(),
  docLines: z.string().optional(),
  ranges: rangesSchemas.ranges.optional(),
  historyRangesSupport: z.boolean().optional(),
  // legacy filestore url for files without a created blob
  url: z.string().nullish(),
  hash: z.string().optional(),
  metadata: editorCoreSchemas.rawFileMetadata.optional(),
  createdBlob: z.boolean().optional(),
})

const projectParamsSchema = z.object({
  params: z.strictObject({ projectId: zz.objectId() }),
})

const updateProjectSchema = z.object({
  params: z.strictObject({ projectId: zz.objectId() }),
  body: z.strictObject({
    projectHistoryId: z.union([z.number(), z.string()]).optional(),
    userId: zz.objectId().nullish(),
    updates: z.array(renameUpdateSchema.or(addUpdateSchema)).default([]),
    version: z.union([z.number(), z.string()]),
    source: editorCoreSchemas.rawOrigin.or(z.string()).nullish(),
  }),
})

class MockDocUpdaterApi extends AbstractMockApi {
  reset() {
    this.updates = {}
    this.docsByProject = new Map()
    this.receivedSetDocRequests = []
    this.receivedGetDocRequests = []
  }

  getReceivedSetDocRequests(projectId) {
    return this.receivedSetDocRequests.filter(
      request => request.projectId === projectId
    )
  }

  getReceivedGetDocRequests(projectId) {
    return this.receivedGetDocRequests.filter(
      request => request.projectId === projectId
    )
  }

  getProjectStructureUpdates(projectId) {
    return this.updates[projectId] || { updates: [] }
  }

  addProjectStructureUpdates(projectId, userId, updates, version) {
    if (!this.updates[projectId]) {
      this.updates[projectId] = { updates: [] }
    }

    for (const update of updates) {
      update.userId = userId
      this.updates[projectId].updates.push(update)
    }

    this.updates[projectId].version = version
  }

  setDoc(projectId, docId, lines, ranges, version = 0) {
    let docsById = this.docsByProject.get(projectId)
    if (docsById == null) {
      docsById = new Map()
      this.docsByProject.set(projectId, docsById)
    }
    docsById.set(docId, { id: docId, lines, ranges, version })
  }

  applyRoutes() {
    this.app.get('/project/:projectId/last_updated_at', (req, res) => {
      // no project in this mock has ever been touched via document-updater,
      // matching the real service's response for a project it has no
      // knowledge of (see DocumentUpdaterHandler.getProjectLastUpdatedAt)
      res.json({ lastUpdatedAt: null })
    })

    this.app.post('/project/:projectId/flush', (req, res) => {
      res.sendStatus(204)
    })

    this.app.post('/project/:projectId', (req, res) => {
      const { params, body } = parseReq(req, updateProjectSchema)
      const { projectId } = params
      const { userId, updates, version } = body
      this.addProjectStructureUpdates(projectId, userId, updates, version)
      res.sendStatus(200)
    })

    this.app.post(
      '/project/:projectId/doc/:docId/change/accept',
      (req, res) => {
        res.status(200).json({
          // todo: return a list of change contributors based on doc ranges accepted similar to DocumentManager, and require tests to set real changes onto a doc before calling accept
          changeContributors: [],
        })
      }
    )

    this.app.get('/project/:projectId/doc/:docId', (req, res) => {
      const {
        query,
        params: { projectId, docId },
      } = parseReq(req, getDocSchema)
      this.receivedGetDocRequests.push({ projectId, docId, query })
      const doc = this.docsByProject.get(projectId)?.get(docId)
      if (doc == null) {
        return res.sendStatus(404)
      }
      res.json({
        id: doc.id,
        lines: doc.lines,
        version: doc.version,
        ranges: doc.ranges,
        ops: [],
      })
    })

    this.app.post('/project/:projectId/doc/:docId', (req, res) => {
      const {
        params: { projectId, docId },
        body,
      } = parseReq(req, setDocSchema)
      this.receivedSetDocRequests.push({ projectId, docId, body })
      res.sendStatus(204)
    })

    this.app.delete('/project/:projectId', (req, res) => {
      res.sendStatus(204)
    })

    this.app.post('/project/:projectId/doc/:doc_id/flush', (req, res) => {
      res.sendStatus(204)
    })

    this.app.delete('/project/:projectId/doc/:doc_id', (req, res) => {
      res.sendStatus(204)
    })

    this.app.post('/project/:projectId/history/resync', (req, res) => {
      res.sendStatus(204)
    })

    this.app.get('/project/:projectId/ranges', (req, res) => {
      const { params } = parseReq(req, projectParamsSchema)
      const docsById = this.docsByProject.get(params.projectId)
      const docs = docsById == null ? [] : Array.from(docsById.values())
      res.json({
        docs: docs.map(doc => ({
          id: doc.id,
          ranges: doc.ranges,
        })),
      })
    })
  }
}

export default MockDocUpdaterApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockDocUpdaterApi
 * @static
 * @returns {MockDocUpdaterApi}
 */
