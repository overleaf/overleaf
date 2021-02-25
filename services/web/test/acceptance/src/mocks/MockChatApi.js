const AbstractMockApi = require('./AbstractMockApi')

class MockChatApi extends AbstractMockApi {
  reset() {
    this.projects = {}
  }

  getGlobalMessages(req, res) {
    res.send(this.projects[req.params.project_id] || [])
  }

  sendGlobalMessage(req, res) {
    const projectId = req.params.project_id
    const message = {
      id: Math.random().toString(),
      content: req.body.content,
      timestamp: Date.now(),
      user_id: req.body.user_id
    }
    this.projects[projectId] = this.projects[projectId] || []
    this.projects[projectId].push(message)
    res.sendStatus(201).send(Object.assign({ room_id: projectId }, message))
  }

  applyRoutes() {
    this.app.get('/project/:project_id/messages', (req, res) =>
      this.getGlobalMessages(req, res)
    )
    this.app.post('/project/:project_id/messages', (req, res) =>
      this.sendGlobalMessage(req, res)
    )
  }
}

module.exports = MockChatApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockChatApi
 * @static
 * @returns {MockChatApi}
 */
