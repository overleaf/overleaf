const WebsocketLoadBalancer = require('./WebsocketLoadBalancer')
const DrainManager = require('./DrainManager')
const logger = require('@overleaf/logger')

module.exports = {
  sendMessage(req, res) {
    logger.debug({ message: req.params.message }, 'sending message')
    if (Array.isArray(req.body)) {
      for (const payload of req.body) {
        WebsocketLoadBalancer.emitToRoom(
          req.params.project_id,
          req.params.message,
          payload
        )
      }
    } else {
      WebsocketLoadBalancer.emitToRoom(
        req.params.project_id,
        req.params.message,
        req.body
      )
    }
    res.sendStatus(204)
  },

  startDrain(req, res) {
    const io = req.app.get('io')
    let rate = req.query.rate || '4'
    rate = parseFloat(rate) || 0
    logger.info({ rate }, 'setting client drain rate')
    DrainManager.startDrain(io, rate)
    res.sendStatus(204)
  },

  disconnectClient(req, res, next) {
    const io = req.app.get('io')
    const { client_id: clientId } = req.params
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
