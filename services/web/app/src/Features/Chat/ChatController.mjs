import { expressify } from '@overleaf/promise-utils'
import Modules from '../../infrastructure/Modules.js'
import ChatApiHandler from './ChatApiHandler.js'
import EditorRealTimeController from '../Editor/EditorRealTimeController.js'
import SessionManager from '../Authentication/SessionManager.js'
import UserInfoManager from '../User/UserInfoManager.js'
import UserInfoController from '../User/UserInfoController.js'
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

export default {
  sendMessage: expressify(sendMessage),
  getMessages: expressify(getMessages),
}
