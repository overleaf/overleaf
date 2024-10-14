import AbstractMockApi from './AbstractMockApi.js'

class MockGitBridgeApi extends AbstractMockApi {
  reset() {
    this.projects = {}
  }

  applyRoutes() {
    this.app.delete('/api/projects/:projectId', (req, res) => {
      this.deleteProject(req, res)
    })
  }

  deleteProject(req, res) {
    const projectId = req.params.projectId
    delete this.projects[projectId]
    res.sendStatus(204)
  }
}

export default MockGitBridgeApi
