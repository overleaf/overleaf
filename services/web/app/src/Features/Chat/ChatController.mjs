import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'
import ChatApiHandler from './ChatApiHandler.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import UserInfoManager from '../User/UserInfoManager.mjs'
import UserInfoController from '../User/UserInfoController.mjs'
import ChatManager from './ChatManager.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const sendMessageSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
  body: z.strictObject({
    content: z.string(),
    client_id: z.string().optional(),
  }),
})

async function sendMessage(req, res) {
  const { params, body } = parseReq(req, sendMessageSchema, {
    logOnly: true,
  })
  const { project_id: projectId } = params
  const { content, client_id: clientId } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (userId == null) {
    throw new Error('no logged-in user')
  }

  const message = await ChatApiHandler.promises.sendGlobalMessage(
    projectId,
    userId,
    content
  )

  const user = await UserInfoManager.promises.getPersonalInfo(message.user_id)
  message.user = UserInfoController.formatPersonalInfo(user)
  message.clientId = clientId
  EditorRealTimeController.emitToRoom(projectId, 'new-chat-message', message)

  await Modules.promises.hooks.fire('chatMessageSent', {
    projectId,
    userId,
    messageId: message.id,
  })

  res.sendStatus(204)
}

const getMessagesSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
  query: z.object({
    limit: z.coerce.number().int().optional(),
    before: z.coerce.number().int().optional(),
  }),
})
// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const getMessagesFallbackSchema = z.object({
  params: z.object({
    project_id: z.string(),
  }),
  query: z.object({
    limit: z.coerce.number().optional(),
    before: z.coerce.number().optional(),
  }),
})

async function getMessages(req, res) {
  const { params, query } = parseReq(req, getMessagesSchema, {
    logOnly: true,
    fallbackSchema: getMessagesFallbackSchema,
  })
  const { project_id: projectId } = params
  const messages = await ChatApiHandler.promises.getGlobalMessages(
    projectId,
    query.limit,
    query.before
  )

  await ChatManager.promises.injectUserInfoIntoThreads({ global: { messages } })
  res.json(messages)
}

const deleteMessageSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    message_id: zz.objectId(),
  }),
})

async function deleteMessage(req, res) {
  const { params } = parseReq(req, deleteMessageSchema, { logOnly: true })
  const { project_id: projectId, message_id: messageId } = params
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (userId == null) {
    throw new Error('no logged-in user')
  }

  await ChatApiHandler.promises.deleteGlobalMessage(projectId, messageId)

  EditorRealTimeController.emitToRoom(projectId, 'delete-global-message', {
    messageId,
    userId,
  })
  res.sendStatus(204)
}

const editMessageSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    message_id: zz.objectId(),
  }),
  body: z.strictObject({
    content: z.string(),
  }),
})

async function editMessage(req, res, next) {
  const { params, body } = parseReq(req, editMessageSchema, {
    logOnly: true,
  })
  const { project_id: projectId, message_id: messageId } = params
  const { content } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (userId == null) {
    throw new Error('no logged-in user')
  }

  await ChatApiHandler.promises.editGlobalMessage(
    projectId,
    messageId,
    userId,
    content
  )

  EditorRealTimeController.emitToRoom(projectId, 'edit-global-message', {
    messageId,
    userId,
    content,
  })
  res.sendStatus(204)
}

export default {
  sendMessage: expressify(sendMessage),
  getMessages: expressify(getMessages),
  deleteMessage: expressify(deleteMessage),
  editMessage: expressify(editMessage),
}
