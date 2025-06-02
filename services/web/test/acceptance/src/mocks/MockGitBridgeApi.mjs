import AbstractMockApi from './AbstractMockApi.mjs'

class MockGitBridgeApi extends AbstractMockApi {
  reset() {
    this.projects = {}
    this.postbacks = {}
  }

  applyRoutes() {
    this.app.delete('/api/projects/:projectId', (req, res) => {
      this.deleteProject(req, res)
    })
    this.app.post('/postback/:id', (req, res) => {
      this.postback(req, res)
    })
  }

  deleteProject(req, res) {
    const projectId = req.params.projectId
    delete this.projects[projectId]
    res.sendStatus(204)
  }

  // Git bridge accepts a postback to indicate when a operation is complete.
  // Each postback is identified by a unique ID.
  // Allow registering a handler which resolves when a postback is received.
  registerPostback(id) {
    return new Promise((resolve, reject) => {
      this.postbacks[id] = { resolve, reject }
    })
  }

  postback(req, res) {
    const { id } = req.params
    const postbackData = req.body
    if (this.postbacks[id]) {
      this.postbacks[id].resolve(postbackData)
    }
    res.sendStatus(204)
  }
}

export default MockGitBridgeApi
