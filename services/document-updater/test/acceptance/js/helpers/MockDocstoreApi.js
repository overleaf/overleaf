const express = require('express')
const bodyParser = require('body-parser')
const { expressify } = require('@overleaf/promise-utils')
const app = express()
const MAX_REQUEST_SIZE = 2 * (2 * 1024 * 1024 + 64 * 1024)

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
        try {
          const docs = await this.getAllDeletedDocs(req.params.project_id)
          return res.json(docs)
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

    app.get(
      '/project/:project_id/doc/:doc_id/peek',
      expressify(async (req, res) => {
        try {
          const doc = await this.peekDocument(
            req.params.project_id,
            req.params.doc_id
          )
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
      bodyParser.json({ limit: MAX_REQUEST_SIZE }),
      expressify(async (req, res) => {
        try {
          await MockDocstoreApi.patchDocument(
            req.params.project_id,
            req.params.doc_id,
            req.body
          )
          return res.sendStatus(204)
        } catch (error) {
          return res.sendStatus(500)
        }
      })
    )

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
