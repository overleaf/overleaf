import AbstractMockApi from './AbstractMockApi.mjs'

class MockDocUpdaterApi extends AbstractMockApi {
  reset() {
    this.updates = {}
    this.docsByProject = new Map()
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

  setDoc(projectId, docId, lines, ranges) {
    let docsById = this.docsByProject.get(projectId)
    if (docsById == null) {
      docsById = new Map()
      this.docsByProject.set(projectId, docsById)
    }
    docsById.set(docId, { id: docId, lines, ranges })
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
        res.sendStatus(204)
      }
    )

    this.app.post(
      '/project/:projectId/doc/:docId/change/reject',
      (req, res) => {
        const { change_ids: changeIds } = req.body
        res.json({ rejectedChangeIds: changeIds })
      }
    )

    this.app.post('/project/:projectId/doc/:doc_id', (req, res) => {
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
