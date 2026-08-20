import { db, ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'
import rangesSchemas from '@overleaf/ranges-tracker/schemas.js'

const docParamsSchema = z.strictObject({
  projectId: zz.objectId(),
  docId: zz.objectId(),
})

const updateDocSchema = z.object({
  params: docParamsSchema,
  body: z.strictObject({
    lines: z.array(z.string()),
    version: z.number(),
    ranges: rangesSchemas.ranges,
  }),
})

const projectParamsSchema = z.object({
  params: z.strictObject({ projectId: zz.objectId() }),
})

const getDocSchema = z.object({
  params: docParamsSchema,
  query: z.object({
    include_deleted: z.stringbool().default(false),
  }),
})

const docParamsOnlySchema = z.object({ params: docParamsSchema })

const patchDocSchema = z.object({
  params: docParamsSchema,
  // matches docstore's own patchDocSchema -- DocstoreManager#deleteDoc is
  // the sole caller and always sends all three fields together.
  body: z.strictObject({
    deleted: z.literal(true),
    deletedAt: z.coerce.date(),
    name: z.string(),
  }),
})

const destroySchema = z.object({
  params: z.strictObject({ projectId: zz.objectId() }),
})

class MockDocstoreApi extends AbstractMockApi {
  reset() {
    this.docs = {}
  }

  addDocument(projectId, docId, { lines, version, ranges }) {
    if (!this.docs[projectId]) {
      this.docs[projectId] = {}
    }
    this.docs[projectId][docId] = {
      _id: docId,
      lines: lines || [],
      version: version || 1,
      ranges: ranges || {},
      rev: 1,
    }
    return this.docs[projectId][docId]
  }

  createLegacyDeletedDoc(projectId, docId) {
    if (!this.docs[projectId]) {
      this.docs[projectId] = {}
    }
    this.docs[projectId][docId] = {
      lines: [],
      version: 1,
      ranges: {},
      deleted: true,
    }
  }

  getDeletedDocs(projectId) {
    return Object.entries(this.docs[projectId] || {})
      .filter(([_, doc]) => doc.deleted)
      .map(([docId, doc]) => {
        return { _id: docId, name: doc.name }
      })
  }

  applyRoutes() {
    this.app.post('/project/:projectId/doc/:docId', (req, res) => {
      const { params, body } = parseReq(req, updateDocSchema)
      const { projectId, docId } = params
      const { lines, version, ranges } = body
      if (this.docs[projectId] == null) {
        this.docs[projectId] = {}
      }
      if (this.docs[projectId][docId] == null) {
        this.docs[projectId][docId] = {}
      }
      const { version: oldVersion, deleted } = this.docs[projectId][docId]
      this.docs[projectId][docId] = { lines, version, ranges, deleted }
      if (this.docs[projectId][docId].rev == null) {
        this.docs[projectId][docId].rev = 0
      }
      this.docs[projectId][docId].rev += 1
      this.docs[projectId][docId]._id = docId
      res.json({
        modified: oldVersion !== version,
        rev: this.docs[projectId][docId].rev,
      })
    })

    this.app.get('/project/:projectId/doc', (req, res) => {
      const { params } = parseReq(req, projectParamsSchema)
      res.json(Object.values(this.docs[params.projectId] || {}))
    })

    this.app.get('/project/:projectId/ranges', (req, res) => {
      const { params } = parseReq(req, projectParamsSchema)
      const { projectId } = params
      const docs = Object.values(this.docs[projectId] || {})
        .filter(doc => !doc.deleted)
        .map(doc => ({ _id: doc._id, ranges: doc.ranges }))
      res.json(docs)
    })

    this.app.get('/project/:projectId/doc-deleted', (req, res) => {
      const { params } = parseReq(req, projectParamsSchema)
      res.json(this.getDeletedDocs(params.projectId))
    })

    this.app.get('/project/:projectId/doc/:docId', (req, res) => {
      const { params, query } = parseReq(req, getDocSchema)
      const { projectId, docId } = params
      const doc = this.docs[projectId][docId]
      if (!doc || (doc.deleted && !query.include_deleted)) {
        res.sendStatus(404)
      } else {
        res.json(doc)
      }
    })

    this.app.get('/project/:projectId/doc/:docId/deleted', (req, res) => {
      const { params } = parseReq(req, docParamsOnlySchema)
      const { projectId, docId } = params
      if (!this.docs[projectId] || !this.docs[projectId][docId]) {
        res.sendStatus(404)
      } else {
        res.json({ deleted: Boolean(this.docs[projectId][docId].deleted) })
      }
    })

    this.app.patch('/project/:projectId/doc/:docId', (req, res) => {
      const { params, body } = parseReq(req, patchDocSchema)
      const { projectId, docId } = params
      if (!this.docs[projectId]) {
        res.sendStatus(404)
      } else if (!this.docs[projectId][docId]) {
        res.sendStatus(404)
      } else {
        Object.assign(this.docs[projectId][docId], body)
        res.sendStatus(204)
      }
    })

    this.app.post('/project/:projectId/destroy', async (req, res) => {
      const { params } = parseReq(req, destroySchema)
      const { projectId } = params
      delete this.docs[projectId]
      await db.docs.deleteMany({ project_id: new ObjectId(projectId) })
      res.sendStatus(204)
    })
  }
}

export default MockDocstoreApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockDocstoreApi
 * @static
 * @returns {MockDocstoreApi}
 */
