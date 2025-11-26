import logger from '@overleaf/logger'
import http from 'node:http'
import https from 'node:https'
import Settings from '@overleaf/settings'
import TpdsUpdateSender from '../ThirdPartyDataStore/TpdsUpdateSender.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import SystemMessageManager from '../SystemMessages/SystemMessageManager.mjs'
import Modules from '../../infrastructure/Modules.mjs'

const AdminController = {
  _sendDisconnectAllUsersMessage: delay => {
    return EditorRealTimeController.emitToAll(
      'forceDisconnect',
      'Sorry, we are performing a quick update to the editor and need to close it down. Please refresh the page to continue.',
      delay
    )
  },
  index: (req, res, next) => {
    let url
    const openSockets = {}
    for (url in http.globalAgent.sockets) {
      openSockets[`http://${url}`] = http.globalAgent.sockets[url].map(
        socket => socket._httpMessage.path
      )
    }

    for (url in https.globalAgent.sockets) {
      openSockets[`https://${url}`] = https.globalAgent.sockets[url].map(
        socket => socket._httpMessage.path
      )
    }

    SystemMessageManager.getMessagesFromDB(
      async function (error, systemMessages) {
        if (error) {
          return next(error)
        }
        const privilegesMatrixResults = await Modules.promises.hooks.fire(
          'getPrivilegesMatrix'
        )
        const privilegesMatrix = privilegesMatrixResults[0] || null
        res.render('admin/index', {
          title: 'System Admin',
          openSockets,
          systemMessages,
          privilegesMatrix,
        })
      }
    )
  },

  disconnectAllUsers: (req, res) => {
    logger.warn('disconecting everyone')
    const delay = (req.query && req.query.delay) > 0 ? req.query.delay : 10
    AdminController._sendDisconnectAllUsersMessage(delay)
    res.redirect('/admin#open-close-editor')
  },

  openEditor(req, res) {
    logger.warn('opening editor')
    Settings.editorIsOpen = true
    res.redirect('/admin#open-close-editor')
  },

  closeEditor(req, res) {
    logger.warn('closing editor')
    Settings.editorIsOpen = req.body.isOpen
    res.redirect('/admin#open-close-editor')
  },

  flushProjectToTpds(req, res, next) {
    TpdsProjectFlusher.flushProjectToTpds(req.body.project_id, error => {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  pollDropboxForUser(req, res) {
    const { user_id: userId } = req.body
    TpdsUpdateSender.pollDropboxForUser(userId, () => res.sendStatus(200))
  },

  createMessage(req, res, next) {
    SystemMessageManager.createMessage(req.body.content, function (error) {
      if (error) {
        return next(error)
      }
      res.redirect('/admin#system-messages')
    })
  },

  clearMessages(req, res, next) {
    SystemMessageManager.clearMessages(function (error) {
      if (error) {
        return next(error)
      }
      res.redirect('/admin#system-messages')
    })
  },
}

export default AdminController
