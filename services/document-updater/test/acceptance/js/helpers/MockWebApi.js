let MockWebApi
const express = require('express')
const bodyParser = require('body-parser')
const { expressify } = require('@overleaf/promise-utils')
const app = express()
const MAX_REQUEST_SIZE = 2 * (2 * 1024 * 1024 + 64 * 1024)

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
    const doc =
      this.docs[`${projectId}:${docId}`] ||
      (this.docs[`${projectId}:${docId}`] = {})
    doc.lines = lines
    doc.version = version
    doc.ranges = ranges
    doc.pathname = '/a/b/c.tex'
    doc.lastUpdatedAt = lastUpdatedAt
    doc.lastUpdatedBy = lastUpdatedBy
  },

  async getDocument(projectId, docId) {
    return this.docs[`${projectId}:${docId}`]
  },

  run() {
    app.get(
      '/project/:project_id/doc/:doc_id',
      expressify(async (req, res, next) => {
        try {
          const doc = await this.getDocument(
            req.params.project_id,
            req.params.doc_id
          )
          if (doc != null) {
            return res.send(JSON.stringify(doc))
          } else {
            return res.sendStatus(404)
          }
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    app.post(
      '/project/:project_id/doc/:doc_id',
      bodyParser.json({ limit: MAX_REQUEST_SIZE }),
      expressify(async (req, res, next) => {
        try {
          await MockWebApi.setDocument(
            req.params.project_id,
            req.params.doc_id,
            req.body.lines,
            req.body.version,
            req.body.ranges,
            req.body.lastUpdatedAt,
            req.body.lastUpdatedBy
          )
          return res.json({ rev: '123' })
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

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
