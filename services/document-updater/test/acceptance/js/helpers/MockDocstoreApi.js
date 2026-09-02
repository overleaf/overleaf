const express = require('express')
const { expressify } = require('@overleaf/promise-utils')
const {
  handleValidationError,
  parseReq,
  z,
  zz,
} = require('@overleaf/validation-tools')
const app = express()
const MAX_REQUEST_SIZE = 2 * (2 * 1024 * 1024 + 64 * 1024)

const projectParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

const docParamsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
})

// the partially-deleted-doc fixup payload sent by
// scripts/check_redis_mongo_sync_state.js
const patchDocumentSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    name: z.string(),
    deleted: z.boolean(),
    deletedAt: z.iso.datetime(),
  }),
})

const MockDocstoreApi = {
  docs: {},

  clearDocs() {
    this.docs = {}
  },

  getDoc(projectId, docId) {
    return this.docs[`${projectId}:${docId}`]
  },

  insertDoc(projectId, docId, doc) {
    if (doc.version == null) {
      doc.version = 0
    }
    if (doc.lines == null) {
      doc.lines = []
    }
    this.docs[`${projectId}:${docId}`] = doc
  },

  async patchDocument(projectId, docId, meta) {
    Object.assign(this.docs[`${projectId}:${docId}`], meta)
  },

  async peekDocument(projectId, docId) {
    return this.docs[`${projectId}:${docId}`]
  },

  async getAllDeletedDocs(projectId) {
    return Object.entries(this.docs)
      .filter(([key, doc]) => key.startsWith(projectId) && doc.deleted)
      .map(([key, doc]) => {
        return {
          _id: key.split(':')[1],
          name: doc.name,
          deletedAt: doc.deletedAt,
        }
      })
  },

  run() {
    app.get(
      '/project/:project_id/doc-deleted',
      expressify(async (req, res) => {
        const { params } = parseReq(req, projectParamsSchema)
        try {
          const docs = await this.getAllDeletedDocs(params.project_id)
          return res.json(docs)
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    app.get(
      '/project/:project_id/doc/:doc_id/peek',
      expressify(async (req, res) => {
        const { params } = parseReq(req, docParamsSchema)
        try {
          const doc = await this.peekDocument(params.project_id, params.doc_id)
          if (doc) {
            return res.json(doc)
          } else {
            return res.sendStatus(404)
          }
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    app.patch(
      '/project/:project_id/doc/:doc_id',
      express.json({ limit: MAX_REQUEST_SIZE }),
      expressify(async (req, res) => {
        const { params, body } = parseReq(req, patchDocumentSchema)
        try {
          await MockDocstoreApi.patchDocument(
            params.project_id,
            params.doc_id,
            body
          )
          return res.sendStatus(204)
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    app.use(handleValidationError)

    app
      .listen(3016, error => {
        if (error) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockDocstoreApi:', error.message)
        process.exit(1)
      })
  },
}

MockDocstoreApi.run()
module.exports = MockDocstoreApi
