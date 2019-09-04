/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
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
let AdminController
const metrics = require('metrics-sharelatex')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const { User } = require('../../models/User')
const { Project } = require('../../models/Project')
const DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
const Settings = require('settings-sharelatex')
const util = require('util')
const RecurlyWrapper = require('../Subscription/RecurlyWrapper')
const SubscriptionHandler = require('../Subscription/SubscriptionHandler')
const projectEntityHandler = require('../Project/ProjectEntityHandler')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const EditorRealTimeController = require('../Editor/EditorRealTimeController')
const SystemMessageManager = require('../SystemMessages/SystemMessageManager')

const oneMinInMs = 60 * 1000

var updateOpenConnetionsMetrics = function() {
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
  return setTimeout(updateOpenConnetionsMetrics, oneMinInMs)
}

setTimeout(updateOpenConnetionsMetrics, oneMinInMs)

module.exports = AdminController = {
  index: (req, res, next) => {
    let agents, url
    let agent
    const http = require('http')
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

    return SystemMessageManager.getMessagesFromDB(function(
      error,
      systemMessages
    ) {
      if (error != null) {
        return next(error)
      }
      return res.render('admin/index', {
        title: 'System Admin',
        openSockets,
        systemMessages
      })
    })
  },

  registerNewUser(req, res, next) {
    return res.render('admin/register')
  },

  dissconectAllUsers: (req, res) => {
    logger.warn('disconecting everyone')
    EditorRealTimeController.emitToAll(
      'forceDisconnect',
      'Sorry, we are performing a quick update to the editor and need to close it down. Please refresh the page to continue.'
    )
    return res.sendStatus(200)
  },

  closeEditor(req, res) {
    logger.warn('closing editor')
    Settings.editorIsOpen = req.body.isOpen
    return res.sendStatus(200)
  },

  writeAllToMongo(req, res) {
    logger.log('writing all docs to mongo')
    Settings.mongo.writeAll = true
    return DocumentUpdaterHandler.flushAllDocsToMongo(function() {
      logger.log('all docs have been saved to mongo')
      return res.send()
    })
  },

  flushProjectToTpds(req, res) {
    return projectEntityHandler.flushProjectToThirdPartyDataStore(
      req.body.project_id,
      err => res.sendStatus(200)
    )
  },

  pollDropboxForUser(req, res) {
    const { user_id } = req.body
    return TpdsUpdateSender.pollDropboxForUser(user_id, () =>
      res.sendStatus(200)
    )
  },

  createMessage(req, res, next) {
    return SystemMessageManager.createMessage(req.body.content, function(
      error
    ) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  },

  clearMessages(req, res, next) {
    return SystemMessageManager.clearMessages(function(error) {
      if (error != null) {
        return next(error)
      }
      return res.sendStatus(200)
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
