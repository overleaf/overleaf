/* eslint-disable
    n/handle-callback-err,
    max-len
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const metrics = require('@overleaf/metrics')
const logger = require('@overleaf/logger')
const _ = require('underscore')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const Settings = require('@overleaf/settings')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const TpdsProjectFlusher = require('../ThirdPartyDataStore/TpdsProjectFlusher')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const SystemMessageManager = require('../SystemMessages/SystemMessageManager')
const {
  addOptionalCleanupHandlerAfterDrainingConnections,
} = require('../../infrastructure/GracefulShutdown')

const oneMinInMs = 60 * 1000

function updateOpenConnetionsMetrics() {
  metrics.gauge(
    'open_connections.socketio',
    __guard__(
      __guard__(
        __guard__(require('../../infrastructure/Server').io, x2 => x2.sockets),
        x1 => x1.clients()
      ),
      x => x.length
    )
  )
  metrics.gauge(
    'open_connections.http',
    _.size(__guard__(require('http').globalAgent, x3 => x3.sockets))
  )
  metrics.gauge(
    'open_connections.https',
    _.size(__guard__(require('https').globalAgent, x4 => x4.sockets))
  )
}

const intervalHandle = setInterval(updateOpenConnetionsMetrics, oneMinInMs)
addOptionalCleanupHandlerAfterDrainingConnections(
  'collect connection metrics',
  () => {
    clearInterval(intervalHandle)
  }
)

const AdminController = {
  _sendDisconnectAllUsersMessage: delay => {
    return EditorRealTimeController.emitToAll(
      'forceDisconnect',
      'Sorry, we are performing a quick update to the editor and need to close it down. Please refresh the page to continue.',
      delay
    )
  },
  index: (req, res, next) => {
    let agents, url
    let agent
    const openSockets = {}
    const object = require('http').globalAgent.sockets
    for (url in object) {
      agents = object[url]
      openSockets[`http://${url}`] = (() => {
        const result = []
        for (agent of Array.from(agents)) {
          result.push(agent._httpMessage.path)
        }
        return result
      })()
    }
    const object1 = require('https').globalAgent.sockets
    for (url in object1) {
      agents = object1[url]
      openSockets[`https://${url}`] = (() => {
        const result1 = []
        for (agent of Array.from(agents)) {
          result1.push(agent._httpMessage.path)
        }
        return result1
      })()
    }

    return SystemMessageManager.getMessagesFromDB(function (
      error,
      systemMessages
    ) {
      if (error != null) {
        return next(error)
      }
      return res.render('admin/index', {
        title: 'System Admin',
        openSockets,
        systemMessages,
      })
    })
  },

  disconnectAllUsers: (req, res) => {
    logger.warn('disconecting everyone')
    const delay = (req.query && req.query.delay) > 0 ? req.query.delay : 10
    AdminController._sendDisconnectAllUsersMessage(delay)
    return res.sendStatus(200)
  },

  openEditor(req, res) {
    logger.warn('opening editor')
    Settings.editorIsOpen = true
    return res.sendStatus(200)
  },

  closeEditor(req, res) {
    logger.warn('closing editor')
    Settings.editorIsOpen = req.body.isOpen
    return res.sendStatus(200)
  },

  writeAllToMongo(req, res) {
    logger.debug('writing all docs to mongo')
    Settings.mongo.writeAll = true
    return DocumentUpdaterHandler.flushAllDocsToMongo(function () {
      logger.debug('all docs have been saved to mongo')
      return res.sendStatus(200)
    })
  },

  flushProjectToTpds(req, res) {
    return TpdsProjectFlusher.flushProjectToTpds(req.body.project_id, err =>
      res.sendStatus(200)
    )
  },

  pollDropboxForUser(req, res) {
    const { user_id: userId } = req.body
    return TpdsUpdateSender.pollDropboxForUser(userId, () =>
      res.sendStatus(200)
    )
  },

  createMessage(req, res, next) {
    return SystemMessageManager.createMessage(
      req.body.content,
      function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(200)
      }
    )
  },

  clearMessages(req, res, next) {
    return SystemMessageManager.clearMessages(function (error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  },
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

module.exports = AdminController
