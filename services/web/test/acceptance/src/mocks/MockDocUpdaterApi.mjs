import AbstractMockApi from './AbstractMockApi.mjs'

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
    this.app.post('/project/:projectId/flush', (req, res) => {
      res.sendStatus(204)
    })

    this.app.post('/project/:projectId', (req, res) => {
      const { projectId } = req.params
      const { userId, updates, version } = req.body
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
      const { projectId, docId } = req.params
      this.receivedGetDocRequests.push({ projectId, docId, query: req.query })
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

    this.app.post('/project/:projectId/doc/:doc_id', (req, res) => {
      const { projectId, doc_id: docId } = req.params
      this.receivedSetDocRequests.push({ projectId, docId, body: req.body })
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
      const docsById = this.docsByProject.get(req.params.projectId)
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
