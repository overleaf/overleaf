import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.mjs'
import ChatApiHandler from './ChatApiHandler.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import UserInfoManager from '../User/UserInfoManager.mjs'
import UserInfoController from '../User/UserInfoController.mjs'
import ChatManager from './ChatManager.mjs'

async function sendMessage(req, res) {
  const { project_id: projectId } = req.params
  const { content, client_id: clientId } = req.body
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

async function getMessages(req, res) {
  const { project_id: projectId } = req.params
  const { query } = req
  const messages = await ChatApiHandler.promises.getGlobalMessages(
    projectId,
    query.limit,
    query.before
  )

  await ChatManager.promises.injectUserInfoIntoThreads({ global: { messages } })
  res.json(messages)
}

async function deleteMessage(req, res) {
  const { project_id: projectId, message_id: messageId } = req.params
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

async function editMessage(req, res, next) {
  const { project_id: projectId, message_id: messageId } = req.params
  const { content } = req.body
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
