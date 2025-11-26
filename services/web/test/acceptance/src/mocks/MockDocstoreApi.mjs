import { db, ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import AbstractMockApi from './AbstractMockApi.mjs'

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
      const { projectId, docId } = req.params
      const { lines, version, ranges } = req.body
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
      res.json(Object.values(this.docs[req.params.projectId] || {}))
    })

    this.app.get('/project/:projectId/ranges', (req, res) => {
      const { projectId } = req.params
      const docs = Object.values(this.docs[projectId] || {})
        .filter(doc => !doc.deleted)
        .map(doc => ({ _id: doc._id, ranges: doc.ranges }))
      res.json(docs)
    })

    this.app.get('/project/:projectId/doc-deleted', (req, res) => {
      res.json(this.getDeletedDocs(req.params.projectId))
    })

    this.app.get('/project/:projectId/doc/:docId', (req, res) => {
      const { projectId, docId } = req.params
      const doc = this.docs[projectId][docId]
      if (!doc || (doc.deleted && !req.query.include_deleted)) {
        res.sendStatus(404)
      } else {
        res.json(doc)
      }
    })

    this.app.get('/project/:projectId/doc/:docId/deleted', (req, res) => {
      const { projectId, docId } = req.params
      if (!this.docs[projectId] || !this.docs[projectId][docId]) {
        res.sendStatus(404)
      } else {
        res.json({ deleted: Boolean(this.docs[projectId][docId].deleted) })
      }
    })

    this.app.patch('/project/:projectId/doc/:docId', (req, res) => {
      const { projectId, docId } = req.params
      if (!this.docs[projectId]) {
        res.sendStatus(404)
      } else if (!this.docs[projectId][docId]) {
        res.sendStatus(404)
      } else {
        Object.assign(this.docs[projectId][docId], req.body)
        res.sendStatus(204)
      }
    })

    this.app.post('/project/:projectId/destroy', async (req, res) => {
      const { projectId } = req.params
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
