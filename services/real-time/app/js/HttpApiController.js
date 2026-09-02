import WebsocketLoadBalancer from './WebsocketLoadBalancer.js'
import DrainManager from './DrainManager.js'
import ConnectedUsersManager from './ConnectedUsersManager.js'
import logger from '@overleaf/logger'
import { z, zz, parseReq } from '@overleaf/validation-tools'
import { clientIdSchema } from './schemas.js'

const countConnectedClientsSchema = z.object({
  params: z.strictObject({
    projectId: zz.objectId(),
  }),
})

// A generic relay: real-time never reads a named field from this payload,
// it forwards it verbatim to connected socket.io clients in the project's
// room (see WebsocketLoadBalancer.emitToRoom) as the named `message` event.
// The payload is a genuinely open, structured map (or an array of them, one
// message per element) -- there is no fixed shape to model here.
const sendMessageSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
    message: z.string().min(1),
  }),
  body: z
    .array(z.record(z.string(), z.unknown()))
    .or(z.record(z.string(), z.unknown())),
})

const startDrainSchema = z.object({
  query: z.strictObject({
    rate: z.coerce.number().default(4),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const startDrainFallbackSchema = z.object({
  query: z.object({
    rate: z.coerce.number().default(4),
  }),
})

const disconnectClientSchema = z.object({
  params: z.strictObject({
    client_id: clientIdSchema,
  }),
})

export default {
  countConnectedClients(req, res) {
    const {
      params: { projectId },
    } = parseReq(req, countConnectedClientsSchema, { logOnly: true })
    ConnectedUsersManager.countConnectedClients(
      projectId,
      (err, nConnectedClients) => {
        if (err) {
          logger.err({ err, projectId }, 'count connected clients failed')
          return res.sendStatus(500)
        }
        res.json({ nConnectedClients })
      }
    )
  },

  sendMessage(req, res) {
    const { params, body } = parseReq(req, sendMessageSchema, {
      logOnly: true,
    })
    logger.debug({ message: params.message }, 'sending message')
    if (Array.isArray(body)) {
      for (const payload of body) {
        WebsocketLoadBalancer.emitToRoom(
          params.project_id,
          params.message,
          payload
        )
      }
    } else {
      WebsocketLoadBalancer.emitToRoom(params.project_id, params.message, body)
    }
    res.sendStatus(204)
  },

  startDrain(req, res) {
    const io = req.app.get('io')
    const {
      query: { rate },
    } = parseReq(req, startDrainSchema, {
      logOnly: true,
      fallbackSchema: startDrainFallbackSchema,
    })
    logger.info({ rate }, 'setting client drain rate')
    DrainManager.startDrain(io, rate)
    res.sendStatus(204)
  },

  disconnectClient(req, res, next) {
    const io = req.app.get('io')
    const {
      params: { client_id: clientId },
    } = parseReq(req, disconnectClientSchema, { logOnly: true })
    const client = io.sockets.sockets[clientId]

    if (!client) {
      logger.debug({ clientId }, 'api: client already disconnected')
      res.sendStatus(404)
      return
    }
    logger.info({ clientId }, 'api: requesting client disconnect')
    client.on('disconnect', () => res.sendStatus(204))
    client.disconnect()
  },
}
