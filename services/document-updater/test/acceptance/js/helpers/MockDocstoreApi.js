const express = require('express')
const bodyParser = require('body-parser')
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

  patchDocument(projectId, docId, meta, callback) {
    Object.assign(this.docs[`${projectId}:${docId}`], meta)
    callback(null)
  },

  peekDocument(projectId, docId, callback) {
    callback(null, this.docs[`${projectId}:${docId}`])
  },

  getAllDeletedDocs(projectId, callback) {
    callback(
      null,
      Object.entries(this.docs)
        .filter(([key, doc]) => key.startsWith(projectId) && doc.deleted)
        .map(([key, doc]) => {
          return {
            _id: key.split(':')[1],
            name: doc.name,
            deletedAt: doc.deletedAt,
          }
        })
    )
  },

  run() {
    app.get('/project/:project_id/doc-deleted', (req, res, next) => {
      this.getAllDeletedDocs(req.params.project_id, (error, docs) => {
        if (error) {
          res.sendStatus(500)
        } else {
          res.json(docs)
        }
      })
    })

    app.get('/project/:project_id/doc/:doc_id/peek', (req, res, next) => {
      this.peekDocument(
        req.params.project_id,
        req.params.doc_id,
        (error, doc) => {
          if (error) {
            res.sendStatus(500)
          } else if (doc) {
            res.json(doc)
          } else {
            res.sendStatus(404)
          }
        }
      )
    })

    app.patch(
      '/project/:project_id/doc/:doc_id',
      bodyParser.json({ limit: MAX_REQUEST_SIZE }),
      (req, res, next) => {
        MockDocstoreApi.patchDocument(
          req.params.project_id,
          req.params.doc_id,
          req.body,
          error => {
            if (error) {
              res.sendStatus(500)
            } else {
              res.sendStatus(204)
            }
          }
        )
      }
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
