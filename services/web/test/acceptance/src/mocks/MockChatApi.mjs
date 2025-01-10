import AbstractMockApi from './AbstractMockApi.mjs'

class MockChatApi extends AbstractMockApi {
  reset() {
    this.projects = {}
  }

  getGlobalMessages(req, res) {
    res.json(this.projects[req.params.project_id] || [])
  }

  sendGlobalMessage(req, res) {
    const projectId = req.params.project_id
    const message = {
      id: Math.random().toString(),
      content: req.body.content,
      timestamp: Date.now(),
      user_id: req.body.user_id,
    }
    this.projects[projectId] = this.projects[projectId] || []
    this.projects[projectId].push(message)
    res.json(Object.assign({ room_id: projectId }, message))
  }

  destroyProject(req, res) {
    const projectId = req.params.project_id
    delete this.projects[projectId]
    res.sendStatus(204)
  }

  applyRoutes() {
    this.app.get('/project/:project_id/messages', (req, res) =>
      this.getGlobalMessages(req, res)
    )
    this.app.post('/project/:project_id/messages', (req, res) =>
      this.sendGlobalMessage(req, res)
    )
    this.app.delete('/project/:project_id', (req, res) =>
      this.destroyProject(req, res)
    )
  }
}

export default MockChatApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockChatApi
 * @static
 * @returns {MockChatApi}
 */
