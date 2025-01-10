import AbstractMockApi from './AbstractMockApi.mjs'

class MockDocUpdaterApi extends AbstractMockApi {
  reset() {
    this.updates = {}
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
