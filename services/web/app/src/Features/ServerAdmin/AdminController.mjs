import logger from '@overleaf/logger'
import http from 'node:http'
import https from 'node:https'
import Settings from '@overleaf/settings'
import TpdsUpdateSender from '../ThirdPartyDataStore/TpdsUpdateSender.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import SystemMessageManager from '../SystemMessages/SystemMessageManager.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import Features from '../../infrastructure/Features.mjs'
import { expressify } from '@overleaf/promise-utils'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const closeEditorSchema = z.object({
  body: z.strictObject({
    // the real form (views/admin/index.pug) never actually sends this
    // field; a falsy/missing value is treated as "closed"
    isOpen: z.boolean().optional(),
  }),
})

const disconnectAllUsersSchema = z.object({
  query: z.object({
    delay: z.coerce.number().optional(),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed. `delay` is used
// numerically below, so a raw passthrough still needs to coerce it.
const disconnectAllUsersFallbackSchema = z.object({
  query: z.object({
    delay: z
      .unknown()
      .optional()
      .transform(v => (v === undefined ? undefined : Number(v))),
  }),
})

const flushProjectToTpdsSchema = z.object({
  body: z.object({
    project_id: zz.objectId(),
  }),
})

const pollDropboxForUserSchema = z.object({
  body: z.object({
    user_id: zz.objectId(),
  }),
})

const createMessageSchema = z.object({
  body: z.strictObject({
    content: z.string(),
  }),
})

const AdminController = {
  _sendDisconnectAllUsersMessage: delay => {
    return EditorRealTimeController.emitToAll(
      'forceDisconnect',
      'Sorry, we are performing a quick update to the editor and need to close it down. Please refresh the page to continue.',
      delay
    )
  },
  index: expressify(async (req, res, next) => {
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

    const systemMessages =
      await SystemMessageManager.promises.getMessagesFromDB()

    const privilegesMatrixResults = await Modules.promises.hooks.fire(
      'getPrivilegesMatrix'
    )

    const privilegesMatrix = privilegesMatrixResults[0] || null

    const toRender = {
      title: 'System Admin',
      openSockets,
      systemMessages,
      privilegesMatrix,
    }

    if (Features.hasFeature('saas')) {
      const debugProjects = await ProjectGetter.promises.findAllDebugProjects(
        'name lastUpdated owner_ref'
      )
      toRender.debugProjects = debugProjects
    }
    res.render('admin/index', toRender)
  }),

  disconnectAllUsers: (req, res) => {
    logger.warn('disconecting everyone')
    const { query } = parseReq(req, disconnectAllUsersSchema, {
      logOnly: true,
      fallbackSchema: disconnectAllUsersFallbackSchema,
    })
    const delay = query.delay > 0 ? query.delay : 10
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
    const { body } = parseReq(req, closeEditorSchema, { logOnly: true })
    Settings.editorIsOpen = body.isOpen
    res.redirect('/admin#open-close-editor')
  },

  flushProjectToTpds(req, res, next) {
    const { body } = parseReq(req, flushProjectToTpdsSchema, {
      logOnly: true,
    })
    TpdsProjectFlusher.flushProjectToTpds(body.project_id, error => {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  pollDropboxForUser(req, res) {
    const { body } = parseReq(req, pollDropboxForUserSchema, {
      logOnly: true,
    })
    TpdsUpdateSender.pollDropboxForUser(body.user_id, () => res.sendStatus(200))
  },

  createMessage(req, res, next) {
    const { body } = parseReq(req, createMessageSchema, { logOnly: true })
    SystemMessageManager.createMessage(body.content, function (error) {
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
