import AbstractMockApi from './AbstractMockApi.mjs'

class MockChatApi extends AbstractMockApi {
  reset() {
    this.projects = new Map()
  }

  getThread(projectId, threadId) {
    let threads = this.projects.get(projectId)
    if (threads == null) {
      threads = new Map()
      this.projects.set(projectId, threads)
    }
    let thread = threads.get(threadId)
    if (thread == null) {
      thread = []
      threads.set(threadId, thread)
    }
    return thread
  }

  sendMessage(projectId, threadId, props) {
    const message = {
      id: Math.random().toString(),
      content: props.content,
      timestamp: Date.now(),
      user_id: props.user_id,
    }
    const thread = this.getThread(projectId, threadId)
    thread.push(message)
    return { room_id: projectId, ...message }
  }

  destroyProject(projectId) {
    this.projects.delete(projectId)
  }

  applyRoutes() {
    this.app.get('/project/:project_id/messages', (req, res) => {
      res.json(this.getThread(req.params.project_id, 'global'))
    })
    this.app.post('/project/:project_id/messages', (req, res) => {
      res.json(this.sendMessage(req.params.project_id, 'global', req.body))
    })
    this.app.get(
      '/project/:project_id/thread/:thread_id/messages',
      (req, res) => {
        res.json(this.getThread(req.params.project_id, req.params.thread_id))
      }
    )
    this.app.post(
      '/project/:project_id/thread/:thread_id/messages',
      (req, res) => {
        res.json(
          this.sendMessage(
            req.params.project_id,
            req.params.thread_id,
            req.body
          )
        )
      }
    )
    this.app.delete('/project/:project_id', (req, res) => {
      const projectId = req.params.project_id
      this.destroyProject(projectId)
      res.sendStatus(204)
    })
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
