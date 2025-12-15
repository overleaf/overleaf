import AbstractMockApi from './AbstractMockApi.mjs'
import { ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'

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
      id: new ObjectId().toString(),
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
    this.app.get('/project/:project_id/messages/:message_id', (req, res) => {
      const projectId = req.params.project_id
      const messageId = req.params.message_id
      const thread = this.getThread(projectId, 'global')
      const message = thread.find(msg => msg.id === messageId)
      if (!message) {
        return res.status(404).json({ error: 'Message not found' })
      }
      res.json(message)
    })
    this.app.get(
      '/project/:project_id/thread/:thread_id/messages',
      (req, res) => {
        res.json(this.getThread(req.params.project_id, req.params.thread_id))
      }
    )
    this.app.get(
      '/project/:project_id/thread/:thread_id/messages/:message_id',
      (req, res) => {
        const projectId = req.params.project_id
        const threadId = req.params.thread_id
        const messageId = req.params.message_id
        const thread = this.getThread(projectId, threadId)
        const message = thread.find(msg => msg.id === messageId)
        if (!message) {
          return res.status(404).json({ error: 'Message not found' })
        }
        res.json(message)
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
