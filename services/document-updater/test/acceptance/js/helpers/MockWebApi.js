let MockWebApi
const basicAuth = require('basic-auth')
const tsscmp = require('tsscmp')
const express = require('express')
const { expressify } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')
const {
  handleValidationError,
  parseReq,
  z,
  zz,
} = require('@overleaf/validation-tools')
const { rawStringFileData } = require('overleaf-editor-core/lib/schemas')
const schemas = require('@overleaf/ranges-tracker/schemas')
const app = express()
const MAX_REQUEST_SIZE = 2 * (2 * 1024 * 1024 + 64 * 1024)

const getDocumentSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
})

// the flush payload built by PersistenceManager.setDoc: lines are either
// sharejs lines or history-ot raw file data; lastUpdatedAt is a redis string
// (ms since epoch) unless freshly set in-process
const setDocumentSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    doc_id: zz.objectId(),
  }),
  body: z.strictObject({
    lines: z.array(z.string()).or(rawStringFileData),
    version: z.number().int(),
    ranges: schemas.ranges.nullish(),
    lastUpdatedAt: z.union([z.string(), z.number()]).nullish(),
    lastUpdatedBy: z.string().nullish(),
  }),
})

module.exports = MockWebApi = {
  docs: {},

  clearDocs() {
    return (this.docs = {})
  },

  insertDoc(projectId, docId, doc) {
    if (doc.version == null) {
      doc.version = 0
    }
    if (doc.lines == null) {
      doc.lines = []
    }
    doc.pathname = '/a/b/c.tex'
    return (this.docs[`${projectId}:${docId}`] = doc)
  },

  async setDocument(
    projectId,
    docId,
    lines,
    version,
    ranges,
    lastUpdatedAt,
    lastUpdatedBy
  ) {
    if (!(`${projectId}:${docId}` in this.docs)) {
      return false
    }
    const doc = this.docs[`${projectId}:${docId}`]
    doc.lines = lines
    doc.version = version
    doc.ranges = ranges
    doc.pathname = '/a/b/c.tex'
    doc.lastUpdatedAt = lastUpdatedAt
    doc.lastUpdatedBy = lastUpdatedBy
    return true
  },

  async getDocument(projectId, docId) {
    return this.docs[`${projectId}:${docId}`]
  },

  async getDocumentController(req, res, next) {
    const { params } = parseReq(req, getDocumentSchema)
    try {
      const doc = await this.getDocument(params.project_id, params.doc_id)
      if (doc != null) {
        return res.send(JSON.stringify(doc))
      } else {
        return res.sendStatus(404)
      }
    } catch (error) {
      return res.sendStatus(500)
    }
  },

  async setDocumentController(req, res, next) {
    const { params, body } = parseReq(req, setDocumentSchema)
    try {
      const ok = await this.setDocument(
        params.project_id,
        params.doc_id,
        body.lines,
        body.version,
        body.ranges,
        body.lastUpdatedAt,
        body.lastUpdatedBy
      )
      if (!ok) {
        return res.sendStatus(404)
      }
      return res.json({ rev: '123' })
    } catch (error) {
      return res.sendStatus(500)
    }
  },

  run() {
    app.use((req, res, next) => {
      const credentials = basicAuth(req)
      if (
        !credentials ||
        !Settings.apis.web.user ||
        credentials.name !== Settings.apis.web.user ||
        !Settings.apis.web.pass ||
        !tsscmp(credentials.pass, Settings.apis.web.pass)
      ) {
        return res.sendStatus(401)
      } else {
        next()
      }
    })

    app.get(
      '/project/:project_id/doc/:doc_id',
      expressify(async (req, res, next) => {
        await this.getDocumentController(req, res, next)
      })
    )

    app.post(
      '/project/:project_id/doc/:doc_id',
      express.json({ limit: MAX_REQUEST_SIZE }),
      expressify(async (req, res, next) => {
        await this.setDocumentController(req, res, next)
      })
    )

    app.use(handleValidationError)

    return app
      .listen(3000, error => {
        if (error != null) {
          throw error
        }
      })
      .on('error', error => {
        console.error('error starting MockWebApi:', error.message)
        return process.exit(1)
      })
  },
}

MockWebApi.run()
