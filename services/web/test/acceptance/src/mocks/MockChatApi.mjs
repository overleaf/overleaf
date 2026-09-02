import AbstractMockApi from './AbstractMockApi.mjs'
import { ObjectId } from '../../../../app/src/infrastructure/mongodb.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

// Mirrors services/chat/app/js/Features/Messages/MessageHttpSchemas.js (this
// mock stands in for chat's own API in web's acceptance tests). This mock's
// own routes bind params as snake_case (project_id/thread_id/message_id)
// where chat's real Express routes bind the same URL shapes as camelCase
// (projectId/threadId/messageId) -- param names never travel over the wire,
// so the schemas below just follow this file's own route definitions.
// matches chat's MessageHttpSchemas.js MAX_MESSAGE_LENGTH (10kb, not 10,000
// bytes)
const MAX_MESSAGE_LENGTH = 10 * 1024
const messageContent = z.string().min(1).max(MAX_MESSAGE_LENGTH)

const projectParams = z.strictObject({ project_id: zz.objectId() })
const threadParams = projectParams.extend({ thread_id: zz.objectId() })
const messageParams = projectParams.extend({ message_id: zz.objectId() })
const threadMessageParams = threadParams.extend({ message_id: zz.objectId() })

// matches chat's sendMessageBody
const sendMessageBody = z.strictObject({
  user_id: zz.objectId(),
  content: messageContent,
})

// matches chat's editMessageBody -- web always sends both `content` and
// `userId` (camelCase, unlike send's `user_id`) even though the handlers
// below only read `content`.
const editMessageBody = z.strictObject({
  content: messageContent,
  userId: zz.objectId().optional(),
})

const getGlobalMessagesSchema = z.object({ params: projectParams })
const sendGlobalMessageSchema = z.object({
  params: projectParams,
  body: sendMessageBody,
})
const getGlobalMessageSchema = z.object({ params: messageParams })
const editGlobalMessageSchema = z.object({
  params: messageParams,
  body: editMessageBody,
})
const deleteGlobalMessageSchema = z.object({ params: messageParams })
const getThreadMessagesSchema = z.object({ params: threadParams })
const getThreadMessageSchema = z.object({ params: threadMessageParams })
const sendMessageSchema = z.object({
  params: threadParams,
  body: sendMessageBody,
})
const editMessageSchema = z.object({
  params: threadMessageParams,
  body: editMessageBody,
})
const destroyProjectSchema = z.object({ params: projectParams })
const getResolvedThreadIdsSchema = z.object({ params: projectParams })

class MockChatApi extends AbstractMockApi {
  reset() {
    this.projects = new Map()
    this.resolvedThreadIds = new Map()
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

  deleteMessage(projectId, threadId, messageId) {
    const thread = this.getThread(projectId, threadId)
    const index = thread.findIndex(message => message.id === messageId)
    if (index === -1) return false
    thread.splice(index, 1)
    return true
  }

  editMessage(projectId, threadId, messageId, content) {
    const thread = this.getThread(projectId, threadId)
    const message = thread.find(message => message.id === messageId)
    if (!message) return false
    message.content = content
    return true
  }

  setResolvedThreadIds(projectId, resolvedThreadIds) {
    this.resolvedThreadIds.set(projectId, resolvedThreadIds)
  }

  getResolvedThreadIds(projectId) {
    return this.resolvedThreadIds.get(projectId) || []
  }

  applyRoutes() {
    this.app.get('/project/:project_id/messages', (req, res) => {
      const { params } = parseReq(req, getGlobalMessagesSchema)
      res.json(this.getThread(params.project_id, 'global'))
    })
    this.app.post('/project/:project_id/messages', (req, res) => {
      const { params, body } = parseReq(req, sendGlobalMessageSchema)
      res.json(this.sendMessage(params.project_id, 'global', body))
    })
    this.app.get('/project/:project_id/messages/:message_id', (req, res) => {
      const { params } = parseReq(req, getGlobalMessageSchema)
      const { project_id: projectId, message_id: messageId } = params
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
        const { params } = parseReq(req, getThreadMessagesSchema)
        res.json(this.getThread(params.project_id, params.thread_id))
      }
    )
    this.app.get(
      '/project/:project_id/thread/:thread_id/messages/:message_id',
      (req, res) => {
        const { params } = parseReq(req, getThreadMessageSchema)
        const {
          project_id: projectId,
          thread_id: threadId,
          message_id: messageId,
        } = params
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
        const { params, body } = parseReq(req, sendMessageSchema)
        res.json(this.sendMessage(params.project_id, params.thread_id, body))
      }
    )
    this.app.post(
      '/project/:project_id/thread/:thread_id/messages/:message_id/edit',
      (req, res) => {
        const { params, body } = parseReq(req, editMessageSchema)
        const {
          project_id: projectId,
          thread_id: threadId,
          message_id: messageId,
        } = params
        const { content, userId } = body
        const thread = this.getThread(projectId, threadId)
        const message = thread.find(msg => msg.id === messageId)
        if (!message || (userId && message.user_id !== userId)) {
          return res.sendStatus(404)
        }
        message.content = content
        message.edited_at = Date.now()
        res.sendStatus(204)
      }
    )
    this.app.delete('/project/:project_id', (req, res) => {
      const { params } = parseReq(req, destroyProjectSchema)
      this.destroyProject(params.project_id)
      res.sendStatus(204)
    })
    this.app.delete('/project/:project_id/messages/:message_id', (req, res) => {
      const { params } = parseReq(req, deleteGlobalMessageSchema)
      const found = this.deleteMessage(
        params.project_id,
        'global',
        params.message_id
      )
      res.sendStatus(found ? 204 : 404)
    })
    this.app.post(
      '/project/:project_id/messages/:message_id/edit',
      (req, res) => {
        const { params, body } = parseReq(req, editGlobalMessageSchema)
        const found = this.editMessage(
          params.project_id,
          'global',
          params.message_id,
          body.content
        )
        res.sendStatus(found ? 204 : 404)
      }
    )
    this.app.get('/project/:project_id/resolved-thread-ids', (req, res) => {
      const { params } = parseReq(req, getResolvedThreadIdsSchema)
      res.json({
        resolvedThreadIds: this.getResolvedThreadIds(params.project_id),
      })
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
